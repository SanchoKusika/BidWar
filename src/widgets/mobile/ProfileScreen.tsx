import { useRef, type ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { KeyRow } from '@/shared/ui/KeyRow';
import { OgPreview } from '@/shared/ui/OgPreview';
import { ProjectCard } from '@/shared/ui/ProjectCard';
import { ReferralShareCard } from '@/shared/ui/ReferralShareCard';
import { SectionLabel } from '@/shared/ui/SectionLabel';
import {
  CURRENCY_SUFFIX,
  formatCharged,
  formatMoney,
  formatVotes,
  type DisplayCurrency,
} from '@/shared/lib/format';
import { strings } from '@/shared/i18n/strings';
import type { ProjectListItem } from '@/entities/project';
import { PageHeader } from './PageHeader';
import { Gutter, RowsCard, ScreenBody, Section } from './ScreenLayout';
import { SettingsPanel, type SettingsPanelProps } from './SettingsPanel';
import styles from './ProfileScreen.module.css';

const t = strings.profile;

/** Строка чека: что списали, когда и через кого. */
export interface Receipt {
  id: string;
  label: string;
  when: string;
  provider?: string;
  /**
   * Сумма и валюта списания — ровно те, что ушли с карты. В валюту показа не
   * пересчитываются никогда (04 Платежи и валюты): чек отвечает на вопрос
   * «сколько с меня сняли», а не «сколько это сегодня в долларах».
   */
  charged: number;
  currency: string;
  kind: 'raise' | 'attack' | 'entry';
}

export interface ProfileScreenProps {
  /** Имя из Telegram — оно же подпись аккаунта. */
  name: string;
  /** Телеграм-хендл без «@». null — у аккаунта его нет, строка тогда короче. */
  username: string | null;
  /** Полная дата регистрации, уже отформатированная вызывающим кодом. */
  joined: string;
  avatarUrl: string | null;
  voteBalance: number | null;
  /**
   * Траты: за 30 дней, за всё время и построчно — из функции `my-spending`
   * (у payment_transactions нет политики на чтение, а auth.uid() у мини-аппа
   * не существует, поэтому читать их можно только своей функцией).
   *
   * Не передан ⇒ ответа ещё нет: блок трат и карточка «PAID» не рисуются.
   * Ноль тут был бы неправдой — платежи в таблице есть, просто не прочитаны.
   */
  spending?: {
    month: number;
    total: number;
    receipts: readonly Receipt[];
  };
  projects: readonly { project: ProjectListItem; rank: number | null }[];
  /**
   * Перечитать свои записи. Витрина обновляется сама после оплаты, но профиль
   * открывают и просто так — а ставка и позиция к этому моменту могли уже
   * измениться от чужого Raise или Attack.
   */
  onRefresh?: () => void;
  refreshing?: boolean;
  referralLink: string;
  referralInvited: number;
  referralEarned: number;
  /** Награда за друга из app_config.task_rewards — своего числа у карточки нет. */
  referralReward: number;
  /**
   * Поделиться ссылкой. Не передан ⇒ кнопки в карточке нет: она и так до
   * 02.09.2026 висела без обработчика и просто ничего не делала.
   */
  onShareReferral?: () => void;
  currency?: DisplayCurrency;
  /** «12.5 mln» вместо «12 500 000» — настройка профиля (shared/settings). */
  compactAmounts?: boolean;
  settings: SettingsPanelProps;
  onEarn: () => void;
  onAdd?: () => void;
  onOpenProject: (project: ProjectListItem) => void;
  /** Raise у платной записи, Give votes у бесплатной — по одной на карточку. */
  onRaise: (project: ProjectListItem) => void;
  onVote: (project: ProjectListItem) => void;
}

/**
 * Профиль (design/ui_kits/mini_app/Screens.jsx).
 *
 * Денежного баланса в продукте нет: вторая карточка показывает не «сколько у
 * тебя лежит», а «сколько ты заплатил». Настройки живут здесь же — пятой
 * вкладки под них в мини-аппе нет.
 */
export function ProfileScreen({
  name,
  username,
  joined,
  avatarUrl,
  voteBalance,
  spending,
  projects,
  onRefresh,
  refreshing = false,
  referralLink,
  referralInvited,
  referralEarned,
  referralReward,
  onShareReferral,
  currency = 'UZS',
  compactAmounts = false,
  settings,
  onEarn,
  onAdd,
  onOpenProject,
  onRaise,
  onVote,
}: ProfileScreenProps) {
  const money = (v: number) => formatMoney(v, { currency, compact: compactAmounts });
  const receiptsRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <PageHeader
        title={t.title}
        meta={t.meta(name, username, joined)}
        right={
          <OgPreview
            src={avatarUrl ?? undefined}
            name={name}
            size={46}
            radius="var(--radius-pill)"
          />
        }
      />

      <ScreenBody>
        <Gutter className={styles.balances}>
          <Balance
            label={t.votesLabel}
            value={
              voteBalance !== null ? formatVotes(voteBalance, { compact: compactAmounts }) : '—'
            }
            unit={t.votesUnit}
            tone="free"
            action={
              <Button variant="free" size="sm" block icon="list-checks" onClick={onEarn}>
                {t.earn}
              </Button>
            }
          />
          {spending && (
            // Итог — не чек: он складывает платежи, которые могли пройти в
            // разных валютах, а сложить их можно только в очках. Поэтому здесь
            // пересчёт в валюту зрителя уместен, а строкой ниже, в самих
            // чеках, — запрещён. Граница проходит ровно тут.
            <Balance
              label={t.paidLabel}
              value={money(spending.total)}
              unit={CURRENCY_SUFFIX[currency]}
              tone="paid"
              action={<span className={styles.balanceNote}>{t.noWallet}</span>}
            />
          )}
        </Gutter>

        <Section>
          <SectionLabel
            right={
              <span className={styles.sectionActions}>
                {onRefresh && (
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={onRefresh}
                    disabled={refreshing}
                    aria-label={t.refresh}
                  >
                    <Icon name="rotate-ccw" size={13} />
                    {t.refresh}
                  </button>
                )}
                {onAdd ? (
                  <button type="button" className={styles.addButton} onClick={onAdd}>
                    <Icon name="plus" size={13} />
                    {t.add}
                  </button>
                ) : projects.length >= 2 ? (
                  // onAdd отсутствует по двум разным причинам: оба слота реально заняты
                  // (тогда это честно) или добавление ещё не подключено на этом экране
                  // (тогда данных для утверждения «оба слота заняты» просто нет — молчим).
                  <span className={styles.slotsNote}>{t.bothSlotsUsed}</span>
                ) : null}
              </span>
            }
          >
            {t.myProjects}
          </SectionLabel>

          <Gutter className={styles.projects}>
            {projects.length > 0 ? (
              projects.map(({ project, rank }) => (
                <ProjectCard
                  key={`${project.type}-${project.id}`}
                  segment={project.type}
                  rank={rank ?? undefined}
                  name={project.name}
                  url={project.url}
                  description={project.ogDescription ?? undefined}
                  ogImage={project.ogImageUrl ?? undefined}
                  value={project.type === 'paid' ? project.paidAmount : project.votes}
                  currency={currency}
                  compactAmounts={compactAmounts}
                  clicks={project.clicks}
                  isOwn
                  onDetails={() => onOpenProject(project)}
                  onRaise={project.type === 'paid' ? () => onRaise(project) : undefined}
                  onVote={project.type === 'free' ? () => onVote(project) : undefined}
                  // Обе кнопки ведут на свою вкладку, где живут шторка и
                  // баланс: Raise на Paid (с 1.5), Give votes на Free (с 1.7).
                />
              ))
            ) : (
              <EmptyState
                icon="folder-plus"
                title={t.noProjectsTitle}
                description={t.noProjectsNote}
                actionLabel={onAdd ? t.addProject : undefined}
                onAction={onAdd}
                compact
              />
            )}
          </Gutter>
        </Section>

        <Gutter>
          <ReferralShareCard
            link={referralLink}
            invited={referralInvited}
            earned={referralEarned}
            rewardPerInvite={referralReward}
            onShare={onShareReferral}
          />
        </Gutter>

        <Gutter>
          {/* Строка «история платежей» ведёт не на отдельный экран, а к чекам
              ниже по этой же странице: они уже здесь, и заводить ради них
              второй экран значило бы показать то же самое дважды. Нет ответа
              `my-spending` — нет и строки. */}
          <SettingsPanel
            {...settings}
            onPaymentHistory={
              spending
                ? () => receiptsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                : undefined
            }
          />
        </Gutter>

        {spending && (
          <div ref={receiptsRef}>
            <Section>
              <SectionLabel>{t.receipts}</SectionLabel>
              <Gutter>
                <RowsCard>
                  {/* Итог за всё время стоит плашкой наверху экрана, здесь —
                    второе число, месячное: дублировать одно и то же незачем. */}
                  <KeyRow
                    label={t.paidLast30}
                    value={`${money(spending.month)} ${CURRENCY_SUFFIX[currency]}`}
                    strong
                    tone="paid"
                  />
                  {spending.receipts.length > 0 ? (
                    spending.receipts.map((r) => (
                      <KeyRow
                        key={r.id}
                        label={`${r.label} · ${r.when}${r.provider ? ` · ${r.provider}` : ''}`}
                        // `money` здесь был бы ошибкой: он переводит очки в
                        // валюту зрителя, а чек показывает списанное как есть.
                        value={`−${formatCharged(r.charged, r.currency)}`}
                        tone={r.kind === 'attack' ? 'attack' : undefined}
                      />
                    ))
                  ) : (
                    <KeyRow label={t.noReceipts} value="" />
                  )}
                </RowsCard>
              </Gutter>
            </Section>
          </div>
        )}
      </ScreenBody>
    </>
  );
}

function Balance({
  label,
  value,
  unit,
  tone,
  action,
}: {
  label: string;
  value: string;
  unit: string;
  tone: 'free' | 'paid';
  action: ReactNode;
}) {
  return (
    <div className={styles.balance}>
      <span className={styles.balanceLabel}>{label}</span>
      <span className={styles.balanceValue}>
        <span className={styles.balanceAmount} data-tone={tone}>
          {value}
        </span>
        <span className={styles.balanceUnit}>{unit}</span>
      </span>
      {action}
    </div>
  );
}
