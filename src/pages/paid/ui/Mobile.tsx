import { useState } from 'react';
import type { Navigation } from '@/app/navigation';
import { useSession } from '@/entities/user';
import { getPlatform } from '@/shared/platform';
import { registerClick, type ProjectListItem } from '@/entities/project';
import { createRaisePayment, type PaymentResult } from '@/features/raise';
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
  const topProject = usePaidTopProject();
  const minStep = useMinPaidAmount();

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const refresh = () => {
    showcase.retry();
    categories.retry();
    topProject.retry();
    own.retry();
  };

  const pay = async () => {
    if (!pending) return;
    const initData = getPlatform().getInitData();
    if (!initData) {
      // В вебе initData пустой — платёж пройти не может, это ожидаемо.
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
      setPayError(error instanceof Error ? error.message : strings.raise.failed);
      return;
    }

    setPending(null);
    if (outcome.status !== 'confirmed') {
      setPayError(strings.raise.failed);
      return;
    }

    // Позицию считает витрина после перечитывания; до тех пор показываем ту,
    // что была, — цифра в квитанции справочная.
    refresh();
    setResult({
      kind: 'raise',
      title:
        pending.kind === 'raise' ? strings.raise.resultTitle : strings.raise.openingResultTitle,
      rank: own.rank ?? 1,
      note: strings.raise.resultNote(
        formatMoney(pending.amount, { compact: false }),
        CURRENCY_SUFFIX.UZS,
      ),
    });
  };

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
        taken={{ paid: Boolean(own.project) }}
        minPaidAmount={minStep}
        onSubmit={async ({ url, categoryId, bid }) => {
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
        onConfirm={pay}
      />

      <ResultSheet open={result !== null} result={result} onClose={() => setResult(null)} />

      {payError && (
        <div className={styles.payError}>
          <SheetNote tone="attack" icon="triangle-alert">
            {payError}
          </SheetNote>
        </div>
      )}
    </>
  );
}
