import { useState } from 'react';
import { useSession } from '@/entities/user';
import { brand } from '@/shared/content';
import { PREVIEW } from '@/shared/config/preview';
import type { DisplayCurrency } from '@/shared/lib/format';
import { setSetting, useSettings, type AppSettings, type ThemeChoice } from '@/shared/settings';
import { ProfileScreen } from '@/widgets/mobile/ProfileScreen';
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
      // spending не передаётся: читать payment_transactions клиенту нечем
      // (см. паспорт пропа в ProfileScreen) — блок трат прячется целиком,
      // вместо того чтобы показывать ноль поверх настоящих платежей.
      projects={mine.projects}
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
      // Путь Raise живёт на вкладке Paid — оттуда шторка и оплата. Кнопка на
      // карточке профиля отправляет туда, а не изображает второй вход.
      onRaise={() => nav.setTab('paid')}
      onVote={() => {}}
    />
  );
}
