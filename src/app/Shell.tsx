import { useEffect, useState } from 'react';
import { getPlatform } from '@/shared/platform';
import { SessionProvider } from '@/entities/user';
import { TabBar, type TabId } from '@/shared/ui/TabBar';
import { EmptyState } from '@/shared/ui/EmptyState';
import { PaidMobile } from '@/pages/paid/ui/Mobile';
import { FreeMobile } from '@/pages/free/ui/Mobile';
import { bindTheme } from './theme';
import styles from './Shell.module.css';

const COMING_SOON: Partial<Record<TabId, string>> = {
  tasks: 'Задания',
  profile: 'Профиль',
};

/**
 * Каркас мини-аппа: TabBar снизу переключает витрины (07 Экраны.md — мобильная
 * навигация). Tasks и Profile — заглушки, экраны появятся в Срезах 1.7/1.8.
 */
export function Shell() {
  const platform = getPlatform();
  const [tab, setTab] = useState<TabId>('paid');

  useEffect(() => {
    platform.ready();
    return bindTheme(platform);
  }, [platform]);

  const comingSoon = COMING_SOON[tab];

  return (
    <SessionProvider>
      <div className={styles.app}>
        <main className={styles.content}>
          {tab === 'paid' && <PaidMobile />}
          {tab === 'free' && <FreeMobile />}
          {comingSoon && (
            <div className={styles.comingSoon}>
              <EmptyState
                icon="clock"
                title={comingSoon}
                description="Появится в одном из следующих срезов."
              />
            </div>
          )}
        </main>
        <TabBar active={tab} onChange={setTab} />
      </div>
    </SessionProvider>
  );
}
