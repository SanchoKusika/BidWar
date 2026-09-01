import { useState } from 'react';
import { useSession } from '@/entities/user';
import { brand } from '@/shared/content';
import { PREVIEW } from '@/shared/config/preview';
import type { DisplayCurrency } from '@/shared/lib/format';
import { setSetting, useSettings, type AppSettings, type ThemeChoice } from '@/shared/settings';
import { ProfileScreen, type Receipt } from '@/widgets/mobile/ProfileScreen';
import type { SettingsState } from '@/widgets/mobile/SettingsPanel';
import type { Navigation } from '@/app/navigation';
import { useMyProjects } from '../model';

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

/**
 * Чеки для витрины: payment_transactions в схеме есть, но записей туда никто
 * не делает до платёжного слоя (PREVIEW.receipts). Суммы — из дизайн-кита.
 */
const RECEIPT_FIXTURES: readonly Receipt[] = [
  {
    id: 'h1',
    kind: 'raise',
    label: 'Raise · Mebel Savdo',
    amount: 150000,
    when: 'Today 14:20',
    provider: 'GlobalPay',
  },
  {
    id: 'h2',
    kind: 'attack',
    label: 'Attack · Toshkent Auto',
    amount: 250000,
    when: 'Yesterday 19:05',
    provider: 'Platega',
  },
  {
    id: 'h3',
    kind: 'entry',
    label: 'Opening bid · Mebel Savdo',
    amount: 480000,
    when: '22 Aug',
    provider: 'GlobalPay',
  },
];

/**
 * Профиль. Реальны хендл и баланс голосов из сессии, свои записи в обоих топах
 * и настройки отображения; траты, чеки и рефералка ждут своих срезов — см.
 * PREVIEW.
 */
export function ProfilePage({ nav }: ProfilePageProps) {
  const { userId, displayName, voteBalance } = useSession();
  const settings = useSettings();
  const [stubs, setStubs] = useState(STUB_DEFAULTS);
  const mine = useMyProjects(userId);

  return (
    <ProfileScreen
      handle={displayName ?? '—'}
      joined="—"
      voteBalance={voteBalance}
      paidMonth={PREVIEW.receipts ? 3250000 : 0}
      paidTotal={PREVIEW.receipts ? 18400000 : 0}
      projects={mine.projects}
      receipts={PREVIEW.receipts ? RECEIPT_FIXTURES : []}
      referralLink={`${brand.botLink}?start=BW-9F2K`}
      referralInvited={PREVIEW.referral ? 7 : 0}
      referralEarned={PREVIEW.referral ? 350 : 0}
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
      }}
      onEarn={() => nav.setTab('tasks')}
      onOpenProject={(project) =>
        nav.push({ name: 'project', id: project.id, segment: project.type })
      }
      // Экономика подключается в Срезах 1.5 и 1.7 — кнопки на карточках уже
      // на месте, но выключены (ProjectCard.actionsDisabled).
      onRaise={() => {}}
      onVote={() => {}}
    />
  );
}
