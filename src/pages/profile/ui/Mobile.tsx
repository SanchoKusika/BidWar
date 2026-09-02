import { useState } from 'react';
import { useSession } from '@/entities/user';
import { removeMyProjects } from '@/entities/project';
import { brand } from '@/shared/content';
import { getPlatform } from '@/shared/platform';
import { formatFullDate, formatReceiptDate, type DisplayCurrency } from '@/shared/lib/format';
import { dropQueryCache } from '@/shared/lib/query';
import { strings } from '@/shared/i18n/strings';
import { setSetting, useSettings, type AppSettings, type ThemeChoice } from '@/shared/settings';
import { ProfileScreen, type Receipt } from '@/widgets/mobile/ProfileScreen';
import { ConfirmSheet } from '@/widgets/mobile/ConfirmSheet';
import type { SettingsState } from '@/widgets/mobile/SettingsPanel';
import type { Navigation } from '@/app/navigation';
import { useMyProjects, useMySpending } from '../model';

export interface ProfilePageProps {
  nav: Navigation;
}

/**
 * Поля настроек без единого обработчика: язык, вибрация, три уведомления и
 * подтверждение платежей. Панель их рисует только под PREVIEW.settingsStubs —
 * состояние им нужно, чтобы тумблер в этом режиме хотя бы двигался, и дальше
 * профиля оно не уходит.
 */
type StubSettings = Omit<SettingsState, keyof AppSettings>;

const STUB_DEFAULTS: StubSettings = {
  language: 'RU',
  haptics: true,
  alertAttacked: true,
  alertLostPosition: true,
  alertNewTasks: false,
  confirmPayments: true,
};

/** Строка чека из ответа `my-spending`. Провайдер в подписи — как в ките. */
function toReceipt(row: {
  id: string;
  intent: 'raise' | 'attack';
  subject: string | null;
  amount: number;
  provider: string;
  confirmedAt: string;
}): Receipt {
  const subject = row.subject ?? strings.profile.unknownProject;
  return {
    id: row.id,
    label:
      row.intent === 'attack'
        ? strings.profile.receiptAttack(subject)
        : strings.profile.receiptRaise(subject),
    when: formatReceiptDate(row.confirmedAt),
    provider: row.provider,
    amount: row.amount,
    kind: row.intent,
  };
}

/**
 * Профиль. Всё, что здесь показано, — настоящее: хендл, дата регистрации,
 * аватар и число приглашённых из сессии, свои записи в обоих топах, траты и
 * чеки из `my-spending`. Заглушек в профиле не осталось; поля настроек без
 * обработчика по-прежнему живут за PREVIEW.settingsStubs.
 */
export function ProfilePage({ nav }: ProfilePageProps) {
  const { userId, displayName, username, avatarUrl, joinedAt, invitedCount, voteBalance } =
    useSession();
  const settings = useSettings();
  const [stubs, setStubs] = useState(STUB_DEFAULTS);
  const mine = useMyProjects(userId);
  const { spending, retry: retrySpending } = useMySpending(userId);

  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const refresh = () => {
    mine.retry();
    retrySpending();
  };

  const remove = async () => {
    const initData = getPlatform().getInitData();
    if (!initData) {
      setRemoveError(strings.settings.removeFailed);
      return;
    }
    setRemoving(true);
    setRemoveError(null);
    try {
      await removeMyProjects(initData);
      setRemoveOpen(false);
      // Витрины и плитки категорий лежат в общем кэше и обеими вкладками уже
      // показаны — после ухода своей записи из топа они устарели все разом,
      // поэтому сбрасывается кэш целиком, а не только свои запросы.
      dropQueryCache();
      refresh();
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : strings.settings.removeFailed);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <ProfileScreen
        name={displayName ?? '—'}
        username={username}
        joined={joinedAt ? formatFullDate(joinedAt) : '—'}
        avatarUrl={avatarUrl}
        voteBalance={voteBalance}
        spending={
          spending
            ? {
                month: spending.month,
                total: spending.total,
                receipts: spending.receipts.map(toReceipt),
              }
            : undefined
        }
        projects={mine.projects}
        onRefresh={refresh}
        refreshing={mine.refreshing}
        // Формат ссылки — t.me/<bot>?start=<users.id> (01 Механики): раньше
        // здесь стоял общий для всех BW-9F2K, ни к какому аккаунту не привязанный.
        referralLink={userId ? `${brand.botLink}?start=${userId}` : brand.botLink}
        referralInvited={invitedCount}
        // Ноль здесь — факт, а не заглушка: наград за приглашённых пока не
        // начисляет никто (vote_transactions пустая до среза 1.7), значит
        // получено ровно ноль. Раньше на этом месте стояло выдуманное 350.
        referralEarned={0}
        currency={settings.currency}
        compactAmounts={settings.compactAmounts}
        settings={{
          value: { ...settings, ...stubs },
          // Разбор по ключу, а не один setSetting(key, next): сузить сам ключ
          // TypeScript умеет, а связанное с ним значение — нет, поэтому тип
          // значения подтверждается здесь по одной ветке на настройку.
          onChange: (key, next) => {
            if (key === 'theme') setSetting('theme', next as ThemeChoice);
            else if (key === 'currency') setSetting('currency', next as DisplayCurrency);
            else if (key === 'compactAmounts') setSetting('compactAmounts', next as boolean);
            else setStubs((prev) => ({ ...prev, [key]: next }));
          },
          onRules: () => nav.push({ name: 'rules', anchor: 'bidding' }),
          onDoc: (id) => nav.push({ name: 'doc', id }),
          onRemoveProjects:
            mine.projects.length > 0
              ? () => {
                  setRemoveError(null);
                  setRemoveOpen(true);
                }
              : undefined,
        }}
        onEarn={() => nav.setTab('tasks')}
        onOpenProject={(project) =>
          nav.push({ name: 'project', id: project.id, segment: project.type })
        }
        // Путь Raise живёт на вкладке Paid — оттуда шторка и оплата. Кнопка на
        // карточке профиля отправляет туда, а не изображает второй вход.
        onRaise={() => nav.setTab('paid')}
        onVote={() => {}}
      />

      <ConfirmSheet
        open={removeOpen}
        title={strings.settings.removeTitle}
        body={strings.settings.removeBody}
        confirmLabel={strings.settings.removeConfirm}
        cancelLabel={strings.settings.removeCancel}
        busy={removing}
        error={removeError}
        onConfirm={() => void remove()}
        onClose={() => setRemoveOpen(false)}
      />
    </>
  );
}
