import { useState } from 'react';
import { useSession } from '@/entities/user';
import { removeMyProjects } from '@/entities/project';
import { useTaskBoard } from '@/entities/task';
import { brand } from '@/shared/content';
import { PREVIEW } from '@/shared/config/preview';
import { getPlatform } from '@/shared/platform';
import { formatFullDate, formatReceiptDate, type DisplayCurrency } from '@/shared/lib/format';
import { dropQueryCache } from '@/shared/lib/query';
import { strings } from '@/shared/i18n/strings';
import { setSetting, useSettings, type ThemeChoice } from '@/shared/settings';
import type { Locale } from '@/shared/i18n/locale';
import { ProfileScreen, type Receipt } from '@/widgets/mobile/ProfileScreen';
import { ConfirmSheet } from '@/widgets/mobile/ConfirmSheet';
import type { Navigation } from '@/app/navigation';
import { useMyProjects, useMySpending, useNotificationPrefs } from '../model';

export interface ProfilePageProps {
  nav: Navigation;
}

/** Строка чека из ответа `my-spending`. Провайдер в подписи — как в ките. */
function toReceipt(row: {
  id: string;
  intent: 'raise' | 'attack';
  subject: string | null;
  charged: number;
  currency: string;
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
    charged: row.charged,
    currency: row.currency,
    kind: row.intent,
  };
}

/**
 * Числа реферальной карточки берутся из того же ответа, что и экран заданий:
 * награда — из строки задания (а она засеяна из `app_config.task_rewards`),
 * а «сколько друзей дошли до первого задания» — из его прогресса. Считать
 * награду константой в клиенте нельзя: карточка ровно так и обещала «+50
 * голосов за друга» при трёх по механике.
 *
 * Пока ответа нет, показывается ноль наград — это факт, а не заглушка: без
 * ответа неизвестно ни одной выданной.
 */
function useReferralNumbers(): { reward: number; rewarded: number; loading: boolean } {
  const board = useTaskBoard();
  const task = board.data?.tasks.find((item) => item.type === 'referral');
  return {
    reward: task?.rewardVotes ?? 0,
    rewarded: task?.progress?.current ?? 0,
    loading: board.loading,
  };
}

/**
 * Профиль. Всё, что здесь показано, — настоящее: хендл, дата регистрации,
 * аватар и число приглашённых из сессии, свои записи в обоих топах, траты и
 * чеки из `my-spending`, настройки уведомлений из `preferences`. Ни заглушек,
 * ни полей без обработчика в профиле больше не осталось (11.09.2026).
 */
export function ProfilePage({ nav }: ProfilePageProps) {
  const { status, userId, displayName, username, avatarUrl, joinedAt, invitedCount, voteBalance } =
    useSession();
  // Until the session lands there is no userId, so the queries below have no
  // key and report "not loading" — which would draw "no projects" and hide the
  // spending blocks for a moment. Unknown is not empty.
  const sessionLoading = status === 'loading';
  const settings = useSettings();
  const prefs = useNotificationPrefs(userId);
  const mine = useMyProjects(userId);
  const { spending, loading: spendingLoading, retry: retrySpending } = useMySpending(userId);
  const referral = useReferralNumbers();

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
        voteBalanceLoading={sessionLoading}
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
        projectsLoading={sessionLoading || mine.loading}
        spendingLoading={sessionLoading || spendingLoading}
        referralLoading={sessionLoading || referral.loading}
        onRefresh={refresh}
        refreshing={mine.refreshing}
        // Формат ссылки — t.me/<bot>?start=<users.id> (01 Механики): раньше
        // здесь стоял общий для всех BW-9F2K, ни к какому аккаунту не привязанный.
        referralLink={userId ? `${brand.botLink}?start=${userId}` : brand.botLink}
        // Кнопка «поделиться» до 02.09.2026 не имела обработчика вовсе.
        // t.me/share — штатный способ: platform.openLink уводит его в
        // openTelegramLink, и мини-апп при этом не закрывается.
        onShareReferral={
          userId
            ? () =>
                getPlatform().openLink(
                  `https://t.me/share/url?url=${encodeURIComponent(`${brand.botLink}?start=${userId}`)}` +
                    `&text=${encodeURIComponent(strings.profile.referralShareText)}`,
                )
            : undefined
        }
        referralInvited={invitedCount}
        // Приглашённый и приглашённый, дошедший до первого задания, — разные
        // числа (01 Механики): награда идёт за второе. Разрыв между ними виден
        // прямо в карточке и объясняет, почему «приглашено 5, получено 9».
        referralEarned={referral.rewarded * referral.reward}
        referralReward={referral.reward}
        currency={settings.currency}
        compactAmounts={settings.compactAmounts}
        settings={{
          value: settings,
          // Разбор по ключу, а не один setSetting(key, next): сузить сам ключ
          // TypeScript умеет, а связанное с ним значение — нет, поэтому тип
          // значения подтверждается здесь по одной ветке на настройку.
          onChange: (key, next) => {
            if (key === 'theme') setSetting('theme', next as ThemeChoice);
            else if (key === 'currency') setSetting('currency', next as DisplayCurrency);
            else if (key === 'compactAmounts') setSetting('compactAmounts', next as boolean);
            else if (key === 'haptics') setSetting('haptics', next as boolean);
            else if (key === 'language') {
              setSetting('language', next as Locale);
              // Язык уезжает и на сервер: тем же языком бот пишет уведомления,
              // и подпись группы это прямо обещает. Экран при этом не ждёт
              // ответа — интерфейс переключается сразу, локально.
              prefs.set({ language: next as Locale });
            }
          },
          // Группы нет, пока сервер не ответил: тумблер с выдуманным
          // состоянием врал бы про то, что придёт в Telegram.
          notifications: prefs.value
            ? {
                value: prefs.value,
                onChange: (key, nextValue) => prefs.set({ [key]: nextValue }),
                error: prefs.error,
              }
            : undefined,
          notificationsLoading: sessionLoading || prefs.loading,
          onRules: () => nav.push({ name: 'rules', anchor: 'bidding' }),
          onDoc: (id) => nav.push({ name: 'doc', id }),
          // Development tool: wipes projects and payment history for real. Shown
          // only while payments run on the mock, the same boundary the server
          // function checks; in production this lives in the admin panel.
          onRemoveProjects:
            PREVIEW.mockPayments && mine.projects.length > 0
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
        // Голоса отдаются на вкладке Free — там шторка и там же баланс. Пустой
        // обработчик стоял здесь, пока механики не было (Срез 1.7).
        onVote={() => nav.setTab('free')}
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
