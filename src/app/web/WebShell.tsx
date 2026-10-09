import { useCallback, useEffect, useState } from 'react';
import { getPlatform, signInWithTelegram } from '@/shared/platform';
import { fetchHealth } from '@/shared/api';
import { dropQueryCache } from '@/shared/lib/query';
import { SignInContext } from '@/shared/lib/signIn';
import { strings } from '@/shared/i18n/strings';
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
import { Dialog } from '@/widgets/desktop/Dialog';
import { PageBand, PageGrid } from '@/widgets/desktop/Chrome';
import { SignInCard } from '@/widgets/desktop/SignIn';
import { bindTheme } from '../theme';
import { useWebNavigation } from './navigation';
import { AccountButton } from './AccountButton';
import styles from './WebShell.module.css';

const HTML_LANG: Record<Locale, string> = { RU: 'ru', EN: 'en' };

/**
 * The desktop site (ui_kits/web): a top bar, the page, a footer. The pages
 * are the mini app's — the same logic, payments and cache — and draw their
 * desktop screens because the layout here says so; sheets open as dialogs.
 */
export function WebShell() {
  const { language } = useSettings();
  const [signInError, setSignInError] = useState(false);

  /**
   * Telegram's own sign-in window for the bot the server checks against
   * (its id comes from `health`, never from a build setting that could name
   * another bot). A successful sign-in reloads the site: the session, the
   * cache and every screen start over as this account.
   */
  const signIn = useCallback(() => {
    setSignInError(false);
    void (async () => {
      try {
        const { botId } = await fetchHealth();
        if (!botId) throw new Error('no bot');
        if (await signInWithTelegram(botId, language.toLowerCase())) {
          dropQueryCache();
          window.location.reload();
        }
      } catch {
        setSignInError(true);
      }
    })();
  }, [language]);

  return (
    <LayoutContext.Provider value="desktop">
      <SignInContext.Provider value={signIn}>
        <SessionProvider>
          <Site onSignIn={signIn} />
          <Dialog open={signInError} onClose={() => setSignInError(false)}>
            <p className={styles.dialogText}>{strings.web.signInFailed}</p>
          </Dialog>
        </SessionProvider>
      </SignInContext.Provider>
    </LayoutContext.Provider>
  );
}

function Site({ onSignIn }: { onSignIn: () => void }) {
  const [platform] = useState(getPlatform);
  const session = useSession();
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
  const guest = session.status === 'guest';

  return (
    <div className={styles.site}>
      <TopBar
        active={active}
        onHome={() => nav.setTab('paid')}
        onNavigate={(item) => (item === 'rules' ? openRules() : nav.setTab(item))}
        dark={dark}
        onToggleTheme={() => setSetting('theme', dark ? 'light' : 'dark')}
        account={
          <AccountButton
            active={active === 'profile'}
            onOpen={() => nav.setTab('profile')}
            onSignIn={onSignIn}
          />
        }
      />

      <div className={styles.page}>
        {route === null && nav.tab === 'paid' && <PaidMobile nav={nav} />}
        {route === null && nav.tab === 'free' && <FreeMobile nav={nav} />}
        {route === null && nav.tab === 'tasks' && <TasksPage nav={nav} />}
        {route === null &&
          nav.tab === 'profile' &&
          (guest ? (
            <>
              <PageBand title={strings.web.profile} />
              <PageGrid>
                <SignInCard onSignIn={onSignIn} note={strings.web.signInProfile} />
              </PageGrid>
            </>
          ) : (
            <ProfilePage nav={nav} />
          ))}

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
