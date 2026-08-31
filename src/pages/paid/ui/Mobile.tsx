import { useEffect, useRef, useState } from 'react';
import type { Navigation } from '@/app/navigation';
import { useSession } from '@/entities/user';
import { getPlatform } from '@/shared/platform';
import {
  registerClick,
  createProject,
  useOwnPosition,
  type ProjectListItem,
} from '@/entities/project';
import {
  createRaisePayment,
  PaymentOutcomeUnknownError,
  type PaymentResult,
} from '@/features/raise';
import { CURRENCY_SUFFIX, formatMoney } from '@/shared/lib/format';
import { strings } from '@/shared/i18n/strings';
import { ShowcaseScreen } from '@/widgets/mobile/ShowcaseScreen';
import { AddProjectSheet } from '@/widgets/mobile/AddProjectSheet';
import { RaiseSheet } from '@/widgets/mobile/RaiseSheet';
import { PaySheet, type PayPayload } from '@/widgets/mobile/PaySheet';
import { ResultSheet, type ActionResult } from '@/widgets/mobile/ResultSheet';
import { SheetNote } from '@/widgets/mobile/SheetParts';
import {
  usePaidCategories,
  usePaidOwnPosition,
  usePaidShowcase,
  usePaidTopProject,
  useMinPaidAmount,
} from '../model';
import styles from './Mobile.module.css';

export interface PaidMobileProps {
  nav: Navigation;
}

/** Что оплачиваем: довзнос к своей ставке или открывающий вход новым проектом. */
type Pending =
  | { kind: 'raise'; amount: number; project: ProjectListItem }
  | { kind: 'opening'; amount: number; url: string; categoryId: number };

/**
 * Путь «кнопка → шторка → оплата → новая позиция» на Paid Top (Срез 1.5).
 * Своей истории состояния у страницы почти нет — она только сводит вместе
 * шторки и результат одного платежа (`pay`), которые сами по себе не знают
 * друг о друге.
 */
export function PaidMobile({ nav }: PaidMobileProps) {
  const { userId, status: sessionStatus, errorMessage: sessionErrorMessage } = useSession();
  const showcase = usePaidShowcase();
  const categories = usePaidCategories();
  const own = usePaidOwnPosition(showcase.categoryId, userId);
  // Только чтобы честно показать занятость Free-слота в AddProjectSheet —
  // own выше знает исключительно про Paid (находка I3 финального ревью:
  // AddProjectSheet.taken.free раньше не приходил вообще, подпись «свободно»
  // врала, даже если бесплатный проект у пользователя уже есть).
  const ownFree = useOwnPosition('free', null, userId);
  const topProject = usePaidTopProject();
  const minStep = useMinPaidAmount();

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const payErrorRef = useRef<HTMLDivElement>(null);

  // Баннер отказа лежит последним блоком в потоке страницы — на проскроленной
  // витрине его не видно, и человек жмёт Pay ещё раз (мелкая находка
  // финального ревью). Эффект, не setState — обычный DOM-побочный эффект,
  // под react-hooks/set-state-in-effect не подпадает.
  useEffect(() => {
    if (payError) payErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [payError]);

  const refresh = () => {
    showcase.retry();
    categories.retry();
    topProject.retry();
    own.retry();
    ownFree.retry();
  };

  const pay = async () => {
    if (!pending) return;
    const initData = getPlatform().getInitData();
    if (!initData) {
      // В вебе initData пустой — платёж пройти не может, это ожидаемо. Шторку
      // закрываем сразу же: PaySheet — портал с position: fixed, он рисуется
      // поверх баннера payError, лежащего в обычном потоке, — отказ иначе
      // остаётся не виден, пока не закрыть шторку руками (код-ревью раунд 1).
      setPending(null);
      setPayError(strings.raise.failed);
      return;
    }

    setPayError(null);
    let outcome: PaymentResult;
    try {
      outcome = await createRaisePayment({
        initData,
        amount: pending.amount,
        ...(pending.kind === 'raise'
          ? { projectId: pending.project.id }
          : { categoryId: pending.categoryId, url: pending.url }),
      });
    } catch (error) {
      // Сеть/функция могут упасть на любом шаге — обычный путь отказа, не
      // экзотика. Шторку закрываем по той же причине, что и в ветке выше.
      setPending(null);
      // Находка I6 финального ревью: PaymentOutcomeUnknownError — это разрыв
      // соединения ПОСЛЕ отправки запроса, когда неизвестно, успел ли сервер
      // применить платёж. «Ничего не списано» здесь была бы непроверяемой
      // ложью — для любой другой ошибки (провайдер/сервер ответили, пусть и
      // отказом) это по-прежнему честно.
      setPayError(
        error instanceof PaymentOutcomeUnknownError
          ? strings.raise.unknownOutcome
          : error instanceof Error
            ? error.message
            : strings.raise.failed,
      );
      return;
    }

    setPending(null);
    if (outcome.status === 'pending') {
      // Мок отдаёт pending только по команде stuck_pending (тестам), у
      // настоящего провайдера это будет нормальный путь до Среза 1.10 —
      // называть это отказом нельзя (мелкая находка финального ревью).
      setPayError(strings.raise.pendingConfirmation);
      return;
    }
    if (outcome.status !== 'confirmed') {
      setPayError(strings.raise.failed);
      return;
    }

    // Ранг не гадаем: own.rank сразу после этой строки — ещё дораисовый (его
    // обновит только retry() внутри refresh(), см. код-ревью раунд 1).
    // Квитанция открывается с прочерком, а свежий ранг подставляет сравнение
    // в рендере ниже, когда own.loading подтвердит, что пришли новые данные.
    refresh();
    setResult({
      kind: 'raise',
      title:
        pending.kind === 'raise' ? strings.raise.resultTitle : strings.raise.openingResultTitle,
      rank: null,
      note: strings.raise.resultNote(
        formatMoney(pending.amount, { compact: false }),
        CURRENCY_SUFFIX.UZS,
      ),
    });
  };

  // Квитанция открыта и ждёт подтверждённый ранг — как только own.rank
  // перечитался (own.loading снова false), разово подставляем его. Сравнение
  // в рендере, не в эффекте (react-hooks/set-state-in-effect); own.loading —
  // обязательное условие, иначе сюда сразу же попал бы старый own.rank,
  // который useOwnPosition отдаёт до завершения перезапроса.
  if (result && result.rank === null && !own.loading && own.rank !== null) {
    setResult({ ...result, rank: own.rank });
  }

  return (
    <>
      <ShowcaseScreen
        segment="paid"
        minStep={minStep}
        categories={categories.categories}
        topProjectName={topProject.name}
        categoryId={showcase.categoryId}
        onCategoryChange={showcase.setCategoryId}
        ownProject={own.project}
        ownRank={own.rank}
        ownNeighborAbove={own.neighborAbove}
        ownLoading={own.loading}
        voteBalance={null}
        userId={userId}
        sessionStatus={sessionStatus}
        sessionErrorMessage={sessionErrorMessage}
        items={showcase.items}
        loading={showcase.loading}
        loadingMore={showcase.loadingMore}
        hasMore={showcase.hasMore}
        error={showcase.error}
        onLoadMore={showcase.loadMore}
        onRetry={showcase.retry}
        onOpenRules={() => nav.push({ name: 'rules', anchor: 'bidding' })}
        onOpenProject={(item) => {
          const initData = getPlatform().getInitData();
          if (initData) registerClick({ initData, projectId: item.id }).catch(() => {});
          getPlatform().openLink(item.url);
        }}
        onAction={own.project ? () => setRaiseOpen(true) : undefined}
        onAddProject={userId && !own.project ? () => setAddOpen(true) : undefined}
      />

      <RaiseSheet
        open={raiseOpen}
        project={own.project}
        rank={own.rank}
        minAmount={minStep}
        onClose={() => setRaiseOpen(false)}
        onConfirm={(amount) => {
          if (!own.project) return;
          setRaiseOpen(false);
          setPending({ kind: 'raise', amount, project: own.project });
        }}
      />

      <AddProjectSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        categories={categories.categories}
        taken={{ paid: Boolean(own.project), free: Boolean(ownFree.project) }}
        minPaidAmount={minStep}
        preferredSegment="paid"
        onSubmit={async ({ url, categoryId, segment, bid }) => {
          // Находка I3 финального ревью: выбор пользователя в шторке обязан
          // соблюдаться — Free с вкладки Paid должен вести в бесплатное
          // добавление (как на Free-странице), а не безусловно в платёжную
          // шторку с заголовком "Pay the opening bid".
          if (segment === 'free') {
            const initData = getPlatform().getInitData();
            if (!initData) throw new Error('Открой мини-апп в Telegram, чтобы добавить проект');
            await createProject({ initData, categoryId, url });
            setAddOpen(false);
            refresh();
            return;
          }
          setAddOpen(false);
          setPending({ kind: 'opening', amount: bid, url, categoryId });
        }}
      />

      <PaySheet
        open={pending !== null}
        payload={
          pending
            ? ({
                kind: pending.kind === 'raise' ? 'raise' : 'project',
                amount: pending.amount,
                subtitle: pending.kind === 'raise' ? pending.project.name : pending.url,
              } satisfies PayPayload)
            : null
        }
        onClose={() => setPending(null)}
        // providerId игнорируется: сейчас активен один способ (mock, флаг
        // PREVIEW.mockPayments), и createRaisePayment вообще не принимает
        // провайдера. Как только в Срезе 1.10 включатся настоящие способы,
        // это место придётся пересмотреть — сигнала одному providerId нет.
        onConfirm={pay}
      />

      <ResultSheet open={result !== null} result={result} onClose={() => setResult(null)} />

      {payError && (
        <div ref={payErrorRef} className={styles.payError}>
          {/* muted, не attack: тон «необратимое» тут неверен — платёж как раз
              НЕ прошёл, ничего не списано (комментарий SheetParts.tsx,
              код-ревью раунд 1). Кроме unknownOutcome — там как раз неизвестно,
              но и его лучше не пугать тоном "необратимое". */}
          <SheetNote tone="muted" icon="triangle-alert">
            {payError}
          </SheetNote>
        </div>
      )}
    </>
  );
}
