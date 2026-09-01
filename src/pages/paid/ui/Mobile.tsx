import { useEffect, useRef, useState } from 'react';
import type { AttackRequest, Navigation } from '@/app/navigation';
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
import { createAttackPayment, fetchAttackQuote, type AttackQuote } from '@/features/attack';
import { CURRENCY_SUFFIX, formatMoney } from '@/shared/lib/format';
import { useSettings } from '@/shared/settings';
import { strings } from '@/shared/i18n/strings';
import { ShowcaseScreen } from '@/widgets/mobile/ShowcaseScreen';
import { AddProjectSheet } from '@/widgets/mobile/AddProjectSheet';
import { RaiseSheet } from '@/widgets/mobile/RaiseSheet';
import { AttackSheet } from '@/widgets/mobile/AttackSheet';
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

/** Что оплачиваем: довзнос, открывающий вход новым проектом или атаку. */
type Pending =
  | { kind: 'raise'; amount: number; project: ProjectListItem }
  | { kind: 'opening'; amount: number; url: string; categoryId: number }
  /** `credited` — сколько долетит до своей ставки после хейрката, для квитанции. */
  | { kind: 'attack'; amount: number; credited: number; target: ProjectListItem };

/**
 * Путь «кнопка → шторка → оплата → новая позиция» на Paid Top (Срез 1.5).
 * Своей истории состояния у страницы почти нет — она только сводит вместе
 * шторки и результат одного платежа (`pay`), которые сами по себе не знают
 * друг о друге.
 */
export function PaidMobile({ nav }: PaidMobileProps) {
  const { userId, status: sessionStatus, errorMessage: sessionErrorMessage } = useSession();
  const { currency, compactAmounts } = useSettings();
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
  /**
   * Сумма, предзаполненная из «занять это место». Это доплата, а не итоговая
   * ставка: цена на карточке — абсолютная («столько будет стоить позиция»), а
   * Raise прибавляется к своей текущей. Минимальный шаг всё равно снизу —
   * доплатить меньше него нельзя, даже если позиция ниже своей.
   */
  const [raisePreset, setRaisePreset] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  /** Открывающая ставка, предзаполненная из «занять это место». */
  const [takeSpotBid, setTakeSpotBid] = useState<number | null>(null);
  /** Цель открытой шторки Attack; null — шторка закрыта. */
  const [attackTarget, setAttackTarget] = useState<ProjectListItem | null>(null);
  const [attackRank, setAttackRank] = useState<number | null>(null);
  const [attackQuote, setAttackQuote] = useState<AttackQuote | null>(null);
  const [attackQuoteError, setAttackQuoteError] = useState<string | null>(null);
  /**
   * Последний забранный запрос атаки со страницы проекта — зеркало для
   * сравнения в рендере (react-hooks/set-state-in-effect, CLAUDE.md), чтобы
   * один и тот же nav.attackRequest не открывал шторку повторно на каждый
   * ререндер.
   */
  const [handledAttackRequest, setHandledAttackRequest] = useState<AttackRequest | null>(null);
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

  // Пол цели, коэффициент зачисления и остаток скользящих лимитов считает
  // сервер: это правила баланса, и вторая их копия в клиенте разъехалась бы с
  // той, по которой спишут деньги. Запрашиваем на открытии шторки — к моменту
  // оплаты числа всё равно перепроверит apply_payment под блокировкой строк.
  useEffect(() => {
    const target = attackTarget;
    if (!target) return;
    let alive = true;
    // Асинхронная обёртка обязательна: setState прямо в теле эффекта запрещён
    // (react-hooks/set-state-in-effect, CLAUDE.md).
    void (async () => {
      const initData = getPlatform().getInitData();
      if (!initData) {
        if (alive) setAttackQuoteError(strings.raise.failed);
        return;
      }
      try {
        const quote = await fetchAttackQuote({ initData, targetProjectId: target.id });
        if (!alive) return;
        setAttackQuote(quote);
        setAttackQuoteError(null);
      } catch (error) {
        if (!alive) return;
        setAttackQuoteError(error instanceof Error ? error.message : strings.attack.quoteFailed);
      }
    })();
    return () => {
      alive = false;
    };
  }, [attackTarget]);

  const closeAttack = () => {
    setAttackTarget(null);
    setAttackQuote(null);
    setAttackQuoteError(null);
  };

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
      outcome =
        pending.kind === 'attack'
          ? await createAttackPayment({
              initData,
              amount: pending.amount,
              // Свою запись сервер находит по подписанному initData — передавать
              // её нельзя, иначе можно было бы бить в чужую пользу.
              targetProjectId: pending.target.id,
            })
          : await createRaisePayment({
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

    if (pending.kind === 'attack') {
      // Числа берём из ответа сервера, а не из предпросмотра: урон и зачисление
      // считает apply_payment, и если между расчётом и оплатой коэффициент
      // успел измениться, показать надо то, что реально произошло.
      setResult({
        kind: 'attack',
        title: strings.attack.resultTitle,
        rank: null,
        note: strings.attack.resultNote(
          formatMoney(outcome.pointsGranted, { compact: false }),
          formatMoney(outcome.creditedPoints, { compact: false }),
          CURRENCY_SUFFIX.UZS,
        ),
      });
      return;
    }

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

  // Запрос атаки со страницы проекта (nav.requestAttack) открывает шторку
  // прямо здесь — сравнение в рендере, не в эффекте, по той же причине, что
  // и выше: страница проекта — отдельный экран, и к моменту перехода на
  // вкладку Paid этот компонент монтируется заново, так что useEffect от
  // самого attackTarget тут не срабатывает первым.
  if (nav.attackRequest && nav.attackRequest !== handledAttackRequest) {
    setHandledAttackRequest(nav.attackRequest);
    setAttackTarget(nav.attackRequest.target);
    setAttackRank(nav.attackRequest.rank);
    setAttackQuote(null);
    setAttackQuoteError(null);
  }

  return (
    <>
      <ShowcaseScreen
        segment="paid"
        currency={currency}
        compactAmounts={compactAmounts}
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
        onAction={
          own.project
            ? () => {
                setRaisePreset(null);
                setRaiseOpen(true);
              }
            : undefined
        }
        onAttack={
          own.project
            ? (item, rank) => {
                setAttackTarget(item);
                setAttackRank(rank);
                setAttackQuote(null);
                setAttackQuoteError(null);
              }
            : undefined
        }
        onTakeSpot={(item) => {
          const target = item.paidAmount + minStep;
          if (own.project) {
            setRaisePreset(Math.max(minStep, target - own.project.paidAmount));
            setRaiseOpen(true);
            return;
          }
          // Своей платной записи ещё нет — место занимается открывающим входом,
          // и цена с карточки становится начальной ставкой.
          setTakeSpotBid(target);
          setAddOpen(true);
        }}
        onAddProject={
          userId && !own.project
            ? () => {
                setTakeSpotBid(null);
                setAddOpen(true);
              }
            : undefined
        }
      />

      <RaiseSheet
        open={raiseOpen}
        project={own.project}
        rank={own.rank}
        preset={raisePreset}
        minAmount={minStep}
        onClose={() => setRaiseOpen(false)}
        onConfirm={(amount) => {
          if (!own.project) return;
          setRaiseOpen(false);
          setPending({ kind: 'raise', amount, project: own.project });
        }}
      />

      <AttackSheet
        open={attackTarget !== null}
        target={attackTarget}
        rank={attackRank}
        quote={attackQuote}
        quoteError={attackQuoteError}
        currency={currency}
        onClose={closeAttack}
        onConfirm={(landed, credited) => {
          if (!attackTarget) return;
          const target = attackTarget;
          closeAttack();
          setPending({ kind: 'attack', amount: landed, credited, target });
        }}
      />

      <AddProjectSheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setTakeSpotBid(null);
        }}
        categories={categories.categories}
        taken={{ paid: Boolean(own.project), free: Boolean(ownFree.project) }}
        minPaidAmount={minStep}
        bidPreset={takeSpotBid}
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
                kind:
                  pending.kind === 'raise'
                    ? 'raise'
                    : pending.kind === 'attack'
                      ? 'attack'
                      : 'project',
                amount: pending.amount,
                subtitle:
                  pending.kind === 'raise'
                    ? pending.project.name
                    : pending.kind === 'attack'
                      ? pending.target.name
                      : pending.url,
                ...(pending.kind === 'attack' ? { rival: pending.target.name } : {}),
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
