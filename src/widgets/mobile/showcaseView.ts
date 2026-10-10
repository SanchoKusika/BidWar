import {
  CURRENCY_SUFFIX,
  formatMoney,
  formatVotes,
  type DisplayCurrency,
  DEFAULT_CURRENCY,
} from '@/shared/lib/format';
import { categoryTitle, type CategoryStat } from '@/entities/category';
import type { NeighborProject, ProjectListItem, ShowcaseType } from '@/entities/project';
import { useGuestSignIn } from '@/entities/user';
import { strings } from '@/shared/i18n/strings';
import type { ShowcaseScreenProps } from './ShowcaseScreen';

/*
  The showcase's arithmetic, apart from its markup: the mini app's screen and
  the desktop site lay the same blocks out differently, and both read what to
  show from here.
*/

const s = strings.showcase;

// Ярусы делят длинный список на цели, к которым тянуться — чисто читательская
// подсказка, механики за ней нет (design/components/board/TierDivider.jsx).
// end — последний ранг яруса: у первых двух по 10 строк, у третьего — 30
// (21..50), поэтому цену "от" нужно брать со строки end, не rank+9 — на
// фиксированном шаге третий ярус называл "Top 50" цену 30-й строки.
const TIER_BANDS: Record<number, { end: number }> = {
  1: { end: 10 },
  11: { end: 20 },
  21: { end: 50 },
};

export function metricOf(item: Pick<ProjectListItem, 'type' | 'paidAmount' | 'votes'>): number {
  return item.type === 'paid' ? item.paidAmount : item.votes;
}

/**
 * Валюта показа и «сокращать ли суммы» — обе из настроек профиля, и ходят
 * вместе везде, где число попадает на экран.
 */
interface MoneyFormat {
  currency: DisplayCurrency;
  compact: boolean;
}

function formatMetric(value: number, segment: ShowcaseType, money: MoneyFormat): string {
  return segment === 'paid' ? formatMoney(value, money) : formatVotes(value, money);
}

function unitOf(segment: ShowcaseType, currency: DisplayCurrency): string {
  return segment === 'paid' ? CURRENCY_SUFFIX[currency] : strings.vote.unit;
}

type CategoryById = Map<number, CategoryStat>;

interface ScopedTotals {
  count: number;
  pool: number;
}

function totalsFor(
  categories: CategoryStat[],
  byId: CategoryById,
  categoryId: number | null,
): ScopedTotals {
  if (categoryId != null) {
    const cat = byId.get(categoryId);
    return { count: cat?.projectCount ?? 0, pool: cat?.pool ?? 0 };
  }
  return categories.reduce(
    (acc, c) => ({ count: acc.count + c.projectCount, pool: acc.pool + c.pool }),
    { count: 0, pool: 0 },
  );
}

export function catLeaderOf(item: ProjectListItem, byId: CategoryById): string | undefined {
  // Сверка по id, не по имени — у projects.name нет уникальности, два
  // проекта с одинаковым названием в категории иначе получали бы корону
  // оба или не тот (код-ревью PR #10).
  const cat = byId.get(item.categoryId);
  return cat && cat.leaderId === item.id ? categoryTitle(cat.slug, cat.title) : undefined;
}

export function tierFor(
  rank: number,
  items: ProjectListItem[],
  segment: ShowcaseType,
  money: MoneyFormat,
  unit: string,
): { label: string; note?: string } | null {
  const band = TIER_BANDS[rank];
  if (!band) return null;

  const last = items[Math.min(items.length, band.end) - 1];
  const note = last
    ? s.tierFrom(`${formatMetric(metricOf(last), segment, money)} ${unit}`)
    : undefined;

  return { label: s.tier(band.end), note };
}

export function spotFor(
  item: ProjectListItem,
  segment: ShowcaseType,
  money: MoneyFormat,
  minStep: number,
  unit: string,
): { price: string; unit: string } {
  const price = metricOf(item) + minStep;
  return { price: formatMetric(price, segment, money), unit };
}

/**
 * rank и neighborAbove — два независимых запроса (useOwnPosition ловит сбой
 * каждого отдельно, см. код-ревью PR #10), поэтому "первое место" здесь
 * решается по факту rank === 1, а не по отсутствию neighborAbove — иначе
 * сбой второго запроса при rank === 5 показал бы «ты держишь первое место».
 * Когда соседа сверху посчитать не удалось, а рангов 1 тоже нет — подсказки
 * не показываем вообще: врать числом не выйти, а без числа хинт бессмыслен.
 */
function gapHint(
  rank: number | null,
  neighborAbove: NeighborProject | null,
  mine: ProjectListItem,
  segment: ShowcaseType,
  money: MoneyFormat,
  minStep: number,
  unit: string,
): string | undefined {
  if (rank === 1) {
    return segment === 'paid' ? s.holdFirstPaid : s.holdFirstFree;
  }
  // Без своего ранга нельзя назвать и позицию соседа — врать числом не станем.
  if (!neighborAbove || rank === null) return undefined;
  const diff = neighborAbove.metric - metricOf(mine) + minStep;
  const amount = formatMetric(diff, segment, money);
  return segment === 'paid'
    ? s.gapPaid(`${amount} ${unit}`, neighborAbove.name, rank - 1)
    : s.gapFree(amount, neighborAbove.name, rank - 1);
}

/**
 * A viewer the site has no account for sees the buttons a signed-in stranger
 * would — raise a row, give votes, take a spot, add a project — and each one
 * asks to sign in instead of opening a payment with no account behind it.
 * Anyone else, and everyone in the mini app, gets the props as they came.
 */
export function useGuestActions(props: ShowcaseScreenProps): ShowcaseScreenProps {
  const signIn = useGuestSignIn();
  if (!signIn) return props;
  return {
    ...props,
    onBoost: props.segment === 'paid' ? () => signIn() : undefined,
    onVote: props.segment === 'free' ? () => signIn() : undefined,
    onTakeSpot: () => signIn(),
    onAddProject: () => signIn(),
  };
}

/** Everything the blocks below derive from the props — one place for both layouts. */
export function useShowcaseView(props: ShowcaseScreenProps) {
  const {
    segment,
    currency = DEFAULT_CURRENCY,
    compactAmounts = false,
    minStep,
    categories,
    categoryId,
    ownProject,
    ownRank,
    ownNeighborAbove,
    items,
    loading,
    hasMore,
    today,
  } = props;

  // Without a day board the showcase always shows all time: a scope left
  // over from another tab would draw an empty list with no switch to undo it.
  const todayScope = today?.scope === 'today';
  const rows = todayScope && today ? today.items : items;
  const feedLoading = todayScope && today ? today.loading : loading;
  const todayPool = todayScope
    ? rows.reduce((sum, item) => sum + (item.todayAmount ?? 0), 0)
    : null;
  const ownMetric = ownProject ? metricOf(ownProject) : null;
  const money: MoneyFormat = { currency, compact: compactAmounts };
  // The spot price and the gap to the next row are numbers people pay by:
  // shortening them would make someone underpay.
  const exact: MoneyFormat = { currency, compact: false };
  const categoryById: CategoryById = new Map(categories.map((c) => [c.categoryId, c]));
  const globalTotals = totalsFor(categories, categoryById, null);
  const scopedTotals = totalsFor(categories, categoryById, categoryId);
  const unit = unitOf(segment, currency);

  const activeCategory = categoryId != null ? categoryById.get(categoryId) : undefined;
  const scopeLabel =
    categoryId === null
      ? segment === 'paid'
        ? s.paidRanking
        : s.freeRanking
      : activeCategory
        ? categoryTitle(activeCategory.slug, activeCategory.title)
        : '';

  const meta = segment === 'paid' ? s.paidMeta(globalTotals.count) : s.freeMeta(globalTotals.count);

  // The exact price of the last position is honest only when the list is
  // loaded to the end — otherwise the last LOADED row need not be the last.
  const lastItem = items.at(-1);
  const cheapest = !hasMore && lastItem ? spotFor(lastItem, segment, exact, minStep, unit) : null;
  const entryHint =
    segment === 'paid'
      ? cheapest
        ? s.entryHintPaid(`${cheapest.price} ${cheapest.unit}`)
        : s.entryHintPaidUnknown
      : s.entryHintFree;

  const ownValue = ownProject ? formatMetric(metricOf(ownProject), segment, money) : undefined;
  const ownHint = ownProject
    ? gapHint(ownRank, ownNeighborAbove, ownProject, segment, exact, minStep, unit)
    : undefined;

  return {
    todayScope,
    rows,
    feedLoading,
    todayPool,
    ownMetric,
    money,
    exact,
    categoryById,
    globalTotals,
    scopedTotals,
    unit,
    scopeLabel,
    meta,
    cheapest,
    entryHint,
    ownValue,
    ownHint,
    format: (value: number) => formatMetric(value, segment, money),
  };
}

export type ShowcaseView = ReturnType<typeof useShowcaseView>;
