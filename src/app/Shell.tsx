import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getPlatform } from '@/shared/platform';
import { useSettings } from '@/shared/settings';
import type { Locale } from '@/shared/i18n/locale';
import { SessionProvider } from '@/entities/user';
import { TabBar } from '@/shared/ui/TabBar';
import { PaidMobile } from '@/pages/paid/ui/Mobile';
import { FreeMobile } from '@/pages/free/ui/Mobile';
import { TasksPage } from '@/pages/tasks/ui/Mobile';
import { ProfilePage } from '@/pages/profile/ui/Mobile';
import { ProjectPage } from '@/pages/project/ui/Mobile';
import { RulesScreen } from '@/widgets/mobile/RulesScreen';
import { DocScreen } from '@/widgets/mobile/DocScreen';
import { availableCount, useTaskBoard } from '@/entities/task';
import { useNavigation } from './navigation';
import { bindTheme } from './theme';
import styles from './Shell.module.css';

/** Наш код языка → значение атрибута `lang` по BCP-47. */
const HTML_LANG: Record<Locale, string> = { RU: 'ru', EN: 'en' };

/**
 * Каркас мини-аппа: TabBar снизу переключает вкладки, поверх любой из них
 * ложится стек экранов (проект, правила, документ) — см. app/navigation.ts.
 */
export function Shell() {
  const [platform] = useState(getPlatform);
  const nav = useNavigation(platform);
  const scroller = useRef<HTMLElement>(null);
  // Каркас подписан на язык ради одного: словарь читает его в момент
  // обращения к строке, но сам по себе перерисовку не запускает. Подписка
  // здесь, а не перемонтирование по `key`, потому что перемонтирование сбросило
  // бы вкладку и прокрутку — человек менял язык, а не уходил с экрана.
  const { language } = useSettings();
  const board = useTaskBoard();
  const availableTasks = board.data ? availableCount(board.data.tasks) : 0;

  useEffect(() => {
    platform.ready();
    return bindTheme(platform);
  }, [platform]);

  // Тот же язык — и для программ чтения с экрана, и для переносов слов.
  useEffect(() => {
    document.documentElement.lang = HTML_LANG[language];
  }, [language]);

  // A new screen starts at the top; going back returns to where the person
  // left the screen underneath. Before, «back» from the rules also landed at
  // the top of the profile, far from the link that had been tapped.
  //
  // Positions are kept per stack level. The tab page remounts on the way back
  // and its content may still be arriving, so the restore retries for a few
  // frames until the page is tall enough to scroll that far.
  const lastScroll = useRef(0);
  const scrollStack = useRef<number[]>([]);
  const shown = useRef({ tab: nav.tab, depth: nav.depth });

  useLayoutEffect(() => {
    const el = scroller.current;
    const prev = shown.current;
    shown.current = { tab: nav.tab, depth: nav.depth };
    if (!el) return;

    if (nav.tab !== prev.tab) {
      scrollStack.current = [];
      el.scrollTop = 0;
      return;
    }
    if (nav.depth > prev.depth) {
      scrollStack.current.push(lastScroll.current);
      el.scrollTop = 0;
      return;
    }
    if (nav.depth < prev.depth) {
      const target = scrollStack.current.splice(nav.depth).at(0) ?? 0;
      let frames = 0;
      let raf = 0;
      const restore = () => {
        el.scrollTop = target;
        if (el.scrollTop < target - 1 && frames++ < 30) raf = requestAnimationFrame(restore);
      };
      restore();
      return () => cancelAnimationFrame(raf);
    }
  }, [nav.tab, nav.depth]);

  const openRules = (anchor?: string) => nav.push({ name: 'rules', anchor });

  return (
    <SessionProvider>
      <div className={styles.app}>
        <main
          className={styles.content}
          ref={scroller}
          onScroll={(e) => {
            lastScroll.current = e.currentTarget.scrollTop;
          }}
        >
          {nav.current === null && nav.tab === 'paid' && <PaidMobile nav={nav} />}
          {nav.current === null && nav.tab === 'free' && <FreeMobile nav={nav} />}
          {nav.current === null && nav.tab === 'tasks' && <TasksPage nav={nav} />}
          {nav.current === null && nav.tab === 'profile' && <ProfilePage nav={nav} />}

          {nav.current?.name === 'project' && (
            <ProjectPage
              id={nav.current.id}
              segment={nav.current.segment}
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
          {nav.current?.name === 'rules' && (
            <RulesScreen
              anchor={nav.current.anchor}
              onBack={nav.back}
              onSupport={() => nav.push({ name: 'doc', id: 'support' })}
            />
          )}
          {nav.current?.name === 'doc' && (
            <DocScreen
              id={nav.current.id}
              onBack={nav.back}
              onDoc={(id) => nav.push({ name: 'doc', id })}
            />
          )}
        </main>

        {/* Счётчик на вкладке заданий — сколько прямо сейчас можно выполнить.
            Ключ кэша тот же, что у экрана заданий: первый запрос у них общий, а
            засчитанное задание доезжает сюда подпиской — без неё число замерло
            бы до перезапуска мини-аппа. Ноль числа не рисует: пустая плашка
            врала бы про работу, которой нет. */}
        <TabBar active={nav.tab} onChange={nav.setTab} badges={{ tasks: availableTasks }} />
      </div>
    </SessionProvider>
  );
}
