import { useState } from 'react';
import { useSession } from '@/entities/user';
import { brand } from '@/shared/content';
import { PREVIEW } from '@/shared/config/preview';
import { ProfileScreen, type Receipt } from '@/widgets/mobile/ProfileScreen';
import type { SettingsState } from '@/widgets/mobile/SettingsPanel';
import type { Navigation } from '@/app/navigation';

export interface ProfilePageProps {
  nav: Navigation;
}

const DEFAULT_SETTINGS: SettingsState = {
  language: 'RU',
  theme: 'auto',
  haptics: true,
  currency: 'UZS',
  compactAmounts: true,
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
  { id: 'h1', kind: 'raise', label: 'Raise · Mebel Savdo', amount: 150000, when: 'Today 14:20', provider: 'GlobalPay' },
  { id: 'h2', kind: 'attack', label: 'Attack · Toshkent Auto', amount: 250000, when: 'Yesterday 19:05', provider: 'Platega' },
  { id: 'h3', kind: 'entry', label: 'Opening bid · Mebel Savdo', amount: 480000, when: '22 Aug', provider: 'GlobalPay' },
];

/**
 * Профиль. Реальны только хендл и баланс голосов из сессии; проекты, траты,
 * чеки и рефералка ждут своих срезов — см. PREVIEW.
 */
export function ProfilePage({ nav }: ProfilePageProps) {
  const { displayName, voteBalance } = useSession();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  return (
    <ProfileScreen
      handle={displayName ?? '—'}
      joined="—"
      voteBalance={voteBalance}
      paidMonth={PREVIEW.receipts ? 3250000 : 0}
      paidTotal={PREVIEW.receipts ? 18400000 : 0}
      projects={[]}
      receipts={PREVIEW.receipts ? RECEIPT_FIXTURES : []}
      referralLink={`${brand.botLink}?start=BW-9F2K`}
      referralInvited={PREVIEW.referral ? 7 : 0}
      referralEarned={PREVIEW.referral ? 350 : 0}
      settings={{
        value: settings,
        onChange: (key, next) => setSettings((prev) => ({ ...prev, [key]: next })),
        onRules: () => nav.push({ name: 'rules', anchor: 'bidding' }),
        onDoc: (id) => nav.push({ name: 'doc', id }),
      }}
      onEarn={() => nav.setTab('tasks')}
      onOpenProject={(project) =>
        nav.push({ name: 'project', id: project.id, segment: project.type })
      }
    />
  );
}
