import { useEffect, useState } from 'react';
import { getPlatform } from '@/shared/platform';
import { useJoinOnline } from '@/shared/lib/online';
import { setSetting, useSettings } from '@/shared/settings';
import { LayoutContext } from '@/shared/lib/layout';
import type { Locale } from '@/shared/i18n/locale';
import { brand } from '@/shared/content';
import { SessionProvider, useSession } from '@/entities/user';
import { PaidMobile } from '@/pages/paid/ui/Mobile';
import { FreeMobile } from '@/pages/free/ui/Mobile';
import { TasksPage } from '@/pages/tasks/ui/Mobile';
import { ProfilePage } from '@/pages/profile/ui/Mobile';
import { ProjectPage } from '@/pages/project/ui/Mobile';
import { SiteFooter, TopBar, type TopBarItem } from '@/widgets/desktop/Chrome';
import { DocPage, RulesPage } from '@/widgets/desktop/InfoPages';
import { bindTheme } from '../theme';
import { useWebNavigation } from './navigation';
import { AccountButton } from './AccountButton';
import { SiteSignIn } from './SiteSignIn';
import styles from './WebShell.module.css';

const HTML_LANG: Record<Locale, string> = { RU: 'ru', EN: 'en' };

/**
 * The desktop site (ui_kits/web): a top bar, the page, a footer. The pages
 * are the mini app's — the same logic, payments and cache — and draw their
 * desktop screens because the layout here says so; sheets open as dialogs.
 */
export function WebShell() {
  return (
    <LayoutContext.Provider value="desktop">
      <SessionProvider>
        <SiteSignIn>
          <OnlinePresence />
          <Site />
        </SiteSignIn>
      </SessionProvider>
    </LayoutContext.Provider>
  );
}

function Site() {
  const [platform] = useState(getPlatform);
  const nav = useWebNavigation();
  const { language, theme } = useSettings();
  const [systemDark, setSystemDark] = useState(() => platform.getColorScheme() === 'dark');

  useEffect(() => {
    platform.ready();
    const unbind = bindTheme(platform);
    const unwatch = platform.onColorSchemeChange((scheme) => setSystemDark(scheme === 'dark'));
    return () => {
      unbind();
      unwatch();
    };
  }, [platform]);

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[language];
  }, [language]);

  const dark = theme === 'auto' ? systemDark : theme === 'dark';
  const route = nav.current;
  const active: TopBarItem | 'profile' | null =
    route?.name === 'rules' ? 'rules' : route?.name === 'doc' ? null : nav.tab;

  const openRules = (anchor?: string) => nav.push({ name: 'rules', anchor });

  return (
    <div className={styles.site}>
      <TopBar
        active={active}
        onHome={() => nav.setTab('paid')}
        onNavigate={(item) => (item === 'rules' ? openRules() : nav.setTab(item))}
        dark={dark}
        onToggleTheme={() => setSetting('theme', dark ? 'light' : 'dark')}
        account={
          <AccountButton active={active === 'profile'} onOpen={() => nav.setTab('profile')} />
        }
      />

      <div className={styles.page}>
        {route === null && nav.tab === 'paid' && <PaidMobile nav={nav} />}
        {route === null && nav.tab === 'free' && <FreeMobile nav={nav} />}
        {route === null && nav.tab === 'tasks' && <TasksPage nav={nav} />}
        {route === null && nav.tab === 'profile' && <ProfilePage nav={nav} />}

        {route?.name === 'project' && (
          <ProjectPage
            key={route.id}
            id={route.id}
            segment={route.segment}
            onBack={nav.back}
            onRules={openRules}
            onGoPaid={() => nav.setTab('paid')}
            onAttack={(target, rank) => nav.requestAttack(target, rank)}
            onBoost={(target, rank) => nav.requestBoost(target, rank)}
            onVote={(target, rank) => nav.requestVote(target, rank)}
            onOpenProject={(projectId, projectSegment) =>
              nav.push({ name: 'project', id: projectId, segment: projectSegment })
            }
          />
        )}
        {route?.name === 'rules' && (
          <RulesPage
            anchor={route.anchor}
            onAnchor={(anchor) => nav.push({ name: 'rules', anchor })}
            onSupport={() => nav.push({ name: 'doc', id: 'support' })}
          />
        )}
        {route?.name === 'doc' && (
          <DocPage
            id={route.id}
            onDoc={(id) => nav.push({ name: 'doc', id })}
            onRules={() => openRules()}
            onOpenBot={() => platform.openLink(brand.botLink)}
          />
        )}
      </div>

      <SiteFooter onDoc={(id) => nav.push({ name: 'doc', id })} />
    </div>
  );
}

/** Joins the online counter as this account — or this browser, for a guest. */
function OnlinePresence() {
  useJoinOnline(useSession().userId);
  return null;
}
