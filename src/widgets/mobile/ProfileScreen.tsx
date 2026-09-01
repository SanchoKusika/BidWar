import type { ReactNode } from 'react';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { Icon } from '@/shared/ui/Icon';
import { KeyRow } from '@/shared/ui/KeyRow';
import { ProjectCard } from '@/shared/ui/ProjectCard';
import { ReferralShareCard } from '@/shared/ui/ReferralShareCard';
import { SectionLabel } from '@/shared/ui/SectionLabel';
import {
  CURRENCY_SUFFIX,
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
  amount: number;
  kind: 'raise' | 'attack' | 'entry';
}

export interface ProfileScreenProps {
  handle: string;
  joined: string;
  voteBalance: number | null;
  /**
   * Траты: за 30 дней, за всё время и построчно. Баланса у продукта нет —
   * карточка показывает не «сколько лежит», а «сколько заплачено».
   *
   * Не передан ⇒ источника ещё нет, и блок трат вместе с карточкой «Paid»
   * не рисуется вовсе. Ноль тут был бы неправдой: платежи в
   * payment_transactions уже есть, просто клиент их не читает — политики на
   * чтение у таблицы нет, а сессии Supabase (и значит auth.uid()) у мини-аппа
   * нет вообще, личность живёт в initData и проверяется на сервере. Нужна своя
   * edge-функция — Срез 1.8.
   */
  spending?: {
    month: number;
    total: number;
    receipts: readonly Receipt[];
  };
  projects: readonly { project: ProjectListItem; rank: number | null }[];
  referralLink: string;
  referralInvited: number;
  referralEarned: number;
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
  handle,
  joined,
  voteBalance,
  spending,
  projects,
  referralLink,
  referralInvited,
  referralEarned,
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

  return (
    <>
      <PageHeader title={t.title} meta={t.meta(handle, joined)} />

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
            <Balance
              label={t.paidLabel}
              value={money(spending.month)}
              unit={CURRENCY_SUFFIX[currency]}
              tone="paid"
              action={<span className={styles.balanceNote}>{t.noWallet}</span>}
            />
          )}
        </Gutter>

        <Section>
          <SectionLabel
            right={
              onAdd ? (
                <button type="button" className={styles.addButton} onClick={onAdd}>
                  <Icon name="plus" size={13} />
                  {t.add}
                </button>
              ) : projects.length >= 2 ? (
                // onAdd отсутствует по двум разным причинам: оба слота реально заняты
                // (тогда это честно) или добавление ещё не подключено на этом экране
                // (тогда данных для утверждения «оба слота заняты» просто нет — молчим).
                <span className={styles.slotsNote}>{t.bothSlotsUsed}</span>
              ) : null
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
                  // Raise работает с 1.5 и ведёт на вкладку Paid; Give votes
                  // ждёт Среза 1.7 и потому остаётся выключенным.
                  actionsDisabled={project.type === 'free'}
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
          />
        </Gutter>

        <Gutter>
          <SettingsPanel {...settings} />
        </Gutter>

        {spending && (
          <Section>
            <SectionLabel>{t.receipts}</SectionLabel>
            <Gutter>
              <RowsCard>
                <KeyRow
                  label={t.paidAllTime}
                  value={`${money(spending.total)} ${CURRENCY_SUFFIX[currency]}`}
                  strong
                  tone="paid"
                />
                {spending.receipts.map((r) => (
                  <KeyRow
                    key={r.id}
                    label={`${r.label} · ${r.when}${r.provider ? ` · ${r.provider}` : ''}`}
                    value={`−${money(r.amount)}`}
                    tone={r.kind === 'attack' ? 'attack' : undefined}
                  />
                ))}
              </RowsCard>
            </Gutter>
          </Section>
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
