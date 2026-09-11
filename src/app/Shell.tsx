import { useEffect, useRef, useState } from 'react';
import { getPlatform } from '@/shared/platform';
import { fetchFxRates } from '@/shared/api';
import { setRates } from '@/shared/lib/format';
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
const HTML_LANG: Record<Locale, string> = { RU: 'ru', UZ: 'uz', EN: 'en' };

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

  // Курсы валюты показа — с сервера, одним запросом на старте. Отказ не
  // страшен: у formatMoney остаются свои значения, просто без обновления.
  useEffect(() => {
    fetchFxRates()
      .then(setRates)
      .catch(() => {});
  }, []);

  // Новый экран начинается сверху, а не там, где остался прошлый.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [nav.tab, nav.depth]);

  const openRules = (anchor?: string) => nav.push({ name: 'rules', anchor });

  return (
    <SessionProvider>
      <div className={styles.app}>
        <main className={styles.content} ref={scroller}>
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
