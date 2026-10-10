import { CategoryTile, CategoryTileSkeleton } from '@/shared/ui/CategoryTile';
import { ProjectCard, ProjectCardSkeleton } from '@/shared/ui/ProjectCard';
import { TierDivider } from '@/shared/ui/TierDivider';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Button } from '@/shared/ui/Button';
import { StatBlock } from '@/shared/ui/StatBlock';
import { SignInCard } from '@/shared/ui/SignInCard';
import { formatHeldDuration, type DisplayCurrency, DEFAULT_CURRENCY } from '@/shared/lib/format';
import {
  CATEGORY_ICON,
  allCategoriesTitle,
  categoryTitle,
  type CategoryStat,
} from '@/entities/category';
import type {
  Movement24h,
  NeighborProject,
  ProjectListItem,
  ShowcaseType,
} from '@/entities/project';
import { useGuestSignIn, type SessionStatus } from '@/entities/user';
import { ActivityFeed, type ActivityItem } from '@/shared/ui/ActivityFeed';
import { strings } from '@/shared/i18n/strings';
import { cx } from '@/shared/lib/cx';
import { PageHeader } from './PageHeader';
import { HeaderAction } from './HeaderAction';
import { OwnPositionPanel } from './OwnPositionPanel';
import { ScopeToggle, type Scope } from './ScopeToggle';
import { Gutter, Section } from './ScreenLayout';
import {
  catLeaderOf,
  metricOf,
  spotFor,
  tierFor,
  useGuestActions,
  useShowcaseView,
  type ShowcaseView,
} from './showcaseView';
import styles from './ShowcaseScreen.module.css';

const s = strings.showcase;

export interface ShowcaseScreenProps {
  segment: ShowcaseType;
  currency?: DisplayCurrency;
  /** «12.5 mln» вместо «12 500 000» — настройка профиля (shared/settings). */
  compactAmounts?: boolean;
  /** Минимальный шаг ставки/голоса — цена «занять место» и подсказки дистанции. */
  minStep: number;
  categories: CategoryStat[];
  /** Category stats are on the way and nothing is cached: the tile row is held with placeholders. */
  categoriesLoading?: boolean;
  topProjectName: string | null;
  categoryId: number | null;
  onCategoryChange: (id: number | null) => void;
  ownProject: ProjectListItem | null;
  ownRank: number | null;
  ownNeighborAbove: NeighborProject | null;
  ownLoading: boolean;
  /** Баланс голосов — только для Free Top, справа в шапке. */
  voteBalance: number | null;
  userId: string | null;
  /** 'error' — initData не прошёл проверку/сеть моргнула, показываем это явно. */
  sessionStatus: SessionStatus;
  sessionErrorMessage: string | null;
  items: ProjectListItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onOpenProject: (item: ProjectListItem) => void;
  /**
   * Открыть страницу проекта. Отдельно от `onOpenProject`: тап по телу
   * карточки уводит на сам сайт проекта (это и есть обещанный трафик), а
   * страница со ставкой, кликами и историей — по своей кнопке, как в профиле.
   */
  onOpenDetails?: (item: ProjectListItem) => void;
  /**
   * «Занять это место» на чужой карточке. Не передан ⇒ блок остаётся ценником
   * без нажатия: показать цену позиции честно и без него.
   */
  onTakeSpot?: (item: ProjectListItem) => void;
  /**
   * Attack по чужой платной строке (Срез 1.6). Не передан ⇒ кнопки нет вовсе:
   * атаковать нечем, пока у самого нет записи в платном топе, и неактивная
   * кнопка врала бы про доступное действие сильнее, чем её отсутствие.
   */
  onAttack?: (item: ProjectListItem, rank: number) => void;
  /**
   * Raise чужой строки — донат в её ставку (01 Механики). Своей записи для
   * этого не нужно: платит человек, растёт чужая позиция.
   */
  onBoost?: (item: ProjectListItem, rank: number) => void;
  /**
   * Give votes по чужой строке бесплатного топа (Срез 1.7). Своей записи для
   * этого не нужно и владение не проверяется: голоса можно отдавать кому
   * угодно, в этом и смысл механики (01 Механики).
   */
  onVote?: (item: ProjectListItem, rank: number) => void;
  /**
   * Изменения за скользящие сутки: позиция и ставка. Проекта, которого сутки
   * назад не существовало, в карте нет, и стрелок у него не рисуется вовсе —
   * «изменение» требует того, что менялось.
   */
  movement?: ReadonlyMap<number, Movement24h>;
  /**
   * Суточный борд под переключателем «All time / Today». Не передан ⇒
   * переключателя нет вовсе: у бесплатного топа источника для него пока нет —
   * `vote_transactions` наполняется с 1.7, но своей вьюхи вроде
   * `paid_today_top` под голоса ещё не написано, — и вкладка, которая ничего
   * не покажет, врала бы про наличие данных.
   *
   * Разрез держит вызывающая страница, а не экран: от него зависит, какой
   * запрос вообще уходит, а решать это внутри вёрстки — значит грузить
   * суточный борд тем, кто его не открывал.
   */
  today?: {
    scope: Scope;
    onScopeChange: (scope: Scope) => void;
    items: ProjectListItem[];
    loading: boolean;
  };
  /** Есть только на Free Top — на Paid Top вход требует оплаты (Срез 1.5), кнопка неактивна. */
  onAddProject?: () => void;
  /** Raise своей ставки — приходит с Paid Top начиная со Среза 1.5. */
  onAction?: () => void;
  onOpenRules: () => void;
  /**
   * Лента «только что» — события ставок из вьюхи `stake_activity`. Пустой
   * список ⇒ блок не рисуется: у бесплатного топа своих событий пока нет
   * вовсе (vote_transactions пустая до среза 1.7).
   */
  activity?: readonly ActivityItem[];
}

interface PartProps {
  props: ShowcaseScreenProps;
  view: ShowcaseView;
  className?: string;
}

/** The vote balance in the header: Free Top only, held while the session is on the way. */
export function ShowcaseBalance({ props, size = 'md' }: PartProps & { size?: 'md' | 'lg' }) {
  const { segment, voteBalance, sessionStatus } = props;
  if (segment !== 'free') return null;
  // `null` is both «still loading» and «there will be no number»: a guest's
  // balance stays empty for good. The placeholder stands only while the
  // session is on the way.
  if (voteBalance !== null) {
    return (
      <StatBlock
        segment="free"
        value={voteBalance}
        label={s.yourVotes}
        size={size}
        showUnit={false}
      />
    );
  }
  if (sessionStatus === 'loading') {
    return (
      <StatBlock
        segment="free"
        value={0}
        label={s.yourVotes}
        size={size}
        showUnit={false}
        loading
      />
    );
  }
  return null;
}

/**
 * The «your position» panel, the sign-in failure — and on the site, for a
 * viewer with no account, the way in: the slot a position would take.
 */
export function ShowcaseOwn({
  props,
  view,
  className,
  panelClassName,
}: PartProps & { panelClassName?: string }) {
  const { segment, userId, sessionStatus, sessionErrorMessage, ownLoading, ownRank } = props;
  const actionLabel = segment === 'paid' ? s.raiseMine : s.voteMine;
  const signIn = useGuestSignIn();

  if (signIn) {
    return (
      <div className={className}>
        <SignInCard onSignIn={signIn} note={strings.web.signInRail} compact />
      </div>
    );
  }

  return (
    <>
      {sessionStatus === 'error' && (
        <div className={className}>
          <EmptyState
            icon="triangle-alert"
            title={s.signInFailed}
            description={sessionErrorMessage ?? s.signInNote}
          />
        </div>
      )}

      {(userId || sessionStatus === 'loading') && (
        <div className={className}>
          {ownLoading || !userId ? (
            // The panel itself with placeholders, held while the session is
            // on the way too: it belongs to every signed-in viewer, and
            // without the placeholder it dropped in once userId landed.
            <OwnPositionPanel
              segment={segment}
              actionLabel={actionLabel}
              className={panelClassName}
              loading
            />
          ) : (
            <OwnPositionPanel
              segment={segment}
              className={panelClassName}
              rank={ownRank}
              value={view.ownValue}
              unit={view.unit}
              hint={view.ownHint}
              entryHint={view.entryHint}
              actionLabel={actionLabel}
              // No handler — no action: the button is inactive rather than lying.
              actionDisabled={!props.onAction}
              onAction={props.onAction}
              addDisabled={!props.onAddProject}
              onAdd={props.onAddProject}
            />
          )}
        </div>
      )}
    </>
  );
}

/** «All» plus one tile per category; a tile filters the feed. */
export function ShowcaseCategories({
  props,
  view,
  className,
  tileClassName,
}: PartProps & { tileClassName?: string }) {
  const { segment, categories, categoriesLoading, items, categoryId, onCategoryChange } = props;

  if (categories.length === 0 && items.length === 0) {
    if (!categoriesLoading) return null;
    return (
      <div className={className}>
        {[0, 1, 2].map((i) => (
          <CategoryTileSkeleton key={i} segment={segment} className={tileClassName} />
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      <CategoryTile
        name={allCategoriesTitle()}
        icon="layout-grid"
        segment={segment}
        pool={view.format(view.globalTotals.pool)}
        unit={view.unit}
        projects={view.globalTotals.count}
        leader={props.topProjectName ?? undefined}
        active={categoryId === null}
        onPress={() => onCategoryChange(null)}
        className={tileClassName}
      />
      {categories.map((cat) => (
        <CategoryTile
          key={cat.categoryId}
          name={categoryTitle(cat.slug, cat.title)}
          icon={CATEGORY_ICON[cat.slug] ?? 'folder'}
          segment={segment}
          pool={view.format(cat.pool)}
          unit={view.unit}
          projects={cat.projectCount}
          leader={cat.leaderName ?? undefined}
          active={categoryId === cat.categoryId}
          onPress={() => onCategoryChange(categoryId === cat.categoryId ? null : cat.categoryId)}
          className={tileClassName}
        />
      ))}
    </div>
  );
}

/** Which list this is, how much is in play, and the all-time / today switch. */
export function ShowcaseRankingHead({ props, view, className }: PartProps) {
  const { segment, today } = props;
  return (
    <>
      <div className={cx(styles.rankingHead, className)}>
        <span className={styles.rankingLines}>
          <span className={styles.rankingTitle}>
            {view.scopeLabel} · {view.todayScope ? view.rows.length : view.scopedTotals.count}
          </span>
          <span className={styles.rankingSub}>
            {/* For the day, «in play» is what actually moved, not the pool. */}
            {s.inPlay(view.format(view.todayPool ?? view.scopedTotals.pool), view.unit)}
          </span>
        </span>
        {today && (
          <ScopeToggle value={today.scope} onChange={today.onScopeChange} segment={segment} />
        )}
      </div>
      {view.todayScope && (
        <span className={cx(styles.todayNote, className)}>{s.todayNote(segment)}</span>
      )}
    </>
  );
}

/** The ranked list itself, with tier dividers, spot prices and «load more». */
export function ShowcaseFeed({ props, view, className }: PartProps) {
  const {
    segment,
    currency = DEFAULT_CURRENCY,
    compactAmounts = false,
    minStep,
    categoryId,
    userId,
    items,
    loadingMore,
    hasMore,
    error,
    onLoadMore,
    onRetry,
    onOpenProject,
    onOpenDetails,
    onTakeSpot,
    onAttack,
    onBoost,
    onVote,
    movement,
    onAddProject,
  } = props;
  const { todayScope, rows } = view;

  return (
    <section className={cx(styles.feed, className)}>
      {view.feedLoading ? (
        // Same parts the rows will have: the spot price in the all-time view,
        // and as many buttons as this viewer gets on a stranger's row.
        Array.from({ length: 6 }, (_, i) => (
          <ProjectCardSkeleton
            key={i}
            segment={segment}
            spot={!todayScope}
            actions={segment === 'paid' ? (onAttack ? 2 : onBoost ? 1 : 0) : onVote ? 1 : 0}
            style={{ opacity: 1 - i * 0.14 }}
          />
        ))
      ) : error && !todayScope ? (
        <EmptyState
          icon="triangle-alert"
          title={s.errorTitle}
          description={s.errorNote}
          actionLabel={s.retry}
          onAction={onRetry}
        />
      ) : rows.length === 0 ? (
        todayScope ? (
          <EmptyState
            segment={segment}
            icon="clock"
            title={s.todayEmptyTitle}
            description={s.todayEmptyNote}
            compact
          />
        ) : (
          <EmptyState
            segment={segment}
            icon={segment === 'paid' ? 'coins' : 'vote'}
            title={segment === 'paid' ? s.emptyPaidTitle : s.emptyFreeTitle}
            description={segment === 'paid' ? s.emptyPaidNote : s.emptyFreeNote}
            actionLabel={onAddProject ? strings.profile.addProject : undefined}
            onAction={onAddProject}
            compact
          />
        )
      ) : (
        <>
          {rows.map((item, index) => {
            const rank = index + 1;
            // Tiers make sense only in the all-time view of the whole top:
            // inside a category positions are already 1..N of its own list,
            // and for the day «Top 10» would name the day's movement.
            const tier =
              categoryId === null && !todayScope
                ? tierFor(rank, items, segment, view.money, view.unit)
                : null;
            const isOwn = userId !== null && item.userId === userId;
            // A row below your own is an offer that gives nothing: compared by
            // the bid, not the rank — ranks inside a filter are the filter's.
            const worthTaking = view.ownMetric === null || view.ownMetric < metricOf(item);
            // Both arrows stay silent for the day: there the rank and the
            // number are the day's movement already.
            const moved = todayScope ? undefined : movement?.get(item.id);
            const pastRank = moved && (categoryId === null ? moved.rank : moved.categoryRank);
            const spot =
              !isOwn && !todayScope && worthTaking
                ? spotFor(item, segment, view.exact, minStep, view.unit)
                : null;

            return (
              <div key={item.id} className={styles.row}>
                {tier && (
                  <TierDivider
                    label={tier.label}
                    note={tier.note}
                    icon={rank === 1 ? 'trophy' : undefined}
                  />
                )}
                <ProjectCard
                  segment={segment}
                  rank={rank}
                  rankDelta={pastRank === undefined ? undefined : pastRank - rank}
                  name={item.name}
                  url={item.url}
                  description={item.ogDescription ?? undefined}
                  ogImage={item.ogImageUrl ?? undefined}
                  value={todayScope ? (item.todayAmount ?? 0) : metricOf(item)}
                  valueDelta={moved?.amountDelta}
                  currency={currency}
                  compactAmounts={compactAmounts}
                  clicks={item.clicks}
                  heldFor={
                    !todayScope && rank === 1 && item.rank1Since
                      ? formatHeldDuration(item.rank1Since)
                      : undefined
                  }
                  catLeader={todayScope ? undefined : catLeaderOf(item, view.categoryById)}
                  spotPrice={spot?.price}
                  spotUnit={spot?.unit}
                  isOwn={isOwn}
                  onPress={() => onOpenProject(item)}
                  onDetails={onOpenDetails ? () => onOpenDetails(item) : undefined}
                  onTakeSpot={spot && onTakeSpot ? () => onTakeSpot(item) : undefined}
                  onRaise={
                    !isOwn && onBoost && segment === 'paid' ? () => onBoost(item, rank) : undefined
                  }
                  onAttack={
                    !isOwn && onAttack && segment === 'paid'
                      ? () => onAttack(item, rank)
                      : undefined
                  }
                  onVote={
                    !isOwn && onVote && segment === 'free' ? () => onVote(item, rank) : undefined
                  }
                />
              </div>
            );
          })}

          {hasMore && !todayScope && (
            <Button
              variant="secondary"
              onClick={onLoadMore}
              loading={loadingMore}
              block
              className={styles.loadMore}
            >
              {s.loadMore}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

/**
 * Общая композиция Paid/Free для мобильного мини-аппа — сверено с
 * design/ui_kits/mini_app/TopFeed.jsx: шапка → «твоя позиция» → плитки
 * категорий (All + по одной на категорию) → сводка топа → лента с ярусами.
 * The blocks are shared with the desktop site, which lays them out around a
 * rail instead of in one column.
 */
export function ShowcaseScreen(screenProps: ShowcaseScreenProps) {
  const props = useGuestActions(screenProps);
  const view = useShowcaseView(props);
  const { segment, onOpenRules, activity } = props;
  const part = { props, view };

  return (
    <div className={styles.screen}>
      <PageHeader
        segment={segment}
        title={segment === 'paid' ? s.paidTitle : s.freeTitle}
        meta={view.meta}
        right={<ShowcaseBalance {...part} />}
        action={<HeaderAction icon="gavel" label={strings.rules.chip} onClick={onOpenRules} />}
      />

      <div className={styles.body}>
        <ShowcaseOwn {...part} className={styles.ownSkeleton} />
        <ShowcaseCategories
          {...part}
          className={styles.categoriesScroll}
          tileClassName={styles.categoryTile}
        />
        <ShowcaseRankingHead {...part} className={styles.gutter} />
        <ShowcaseFeed {...part} className={styles.gutter} />

        {activity && activity.length > 0 && (
          <Section>
            <Gutter>
              <ActivityFeed dense max={5} title={s.justHappened} items={[...activity]} />
            </Gutter>
          </Section>
        )}
      </div>
    </div>
  );
}
