import { Segmented } from '@/shared/ui/Segmented';
import { SettingsGroup, SettingsRow } from '@/shared/ui/Settings';
import { Switch } from '@/shared/ui/Switch';
import type { DisplayCurrency } from '@/shared/lib/format';
import type { AppSettings, ThemeChoice } from '@/shared/settings';
import { brand, getPaymentProviders, type DocId } from '@/shared/content';
import { strings } from '@/shared/i18n/strings';
import { LOCALES, type Locale } from '@/shared/i18n/locale';
import styles from './SettingsPanel.module.css';

const t = strings.settings;

export type { ThemeChoice };

/**
 * Настройки устройства — тема, валюта показа, компактные суммы, вибрация, язык
 * — приходят из `shared/settings` и применяются прямо в браузере.
 *
 * Заглушек в панели не осталось (11.09.2026, срез 1.9): последние три тумблера
 * — уведомления — стали настоящими и уехали на сервер, потому что решает по ним
 * бот. Флага `PREVIEW.settingsStubs` вместе с ними не стало.
 */
export type SettingsState = AppSettings;

/** Четыре вида сообщений бота — по одному на событие из 06 Telegram-бот. */
export interface NotificationSettings {
  notifyAttacked: boolean;
  notifyRankLost: boolean;
  notifyVotes: boolean;
  notifyReferral: boolean;
}

export interface NotificationsProps {
  value: NotificationSettings;
  onChange: <K extends keyof NotificationSettings>(key: K, next: boolean) => void;
  /** Сохранение не доехало. Тумблеры при этом показывают то, что в базе. */
  error?: string | null;
}

export interface SettingsPanelProps {
  value: SettingsState;
  onChange: <K extends keyof SettingsState>(key: K, next: SettingsState[K]) => void;
  /**
   * Настройки уведомлений. Не переданы ⇒ группы нет вовсе: пока сервер не
   * ответил (или его некому спросить — веб-гость без initData), тумблер показал
   * бы выдуманное состояние. Источник вместо флага, как у ленты событий.
   */
  notifications?: NotificationsProps;
  onRules: () => void;
  onDoc: (id: DocId) => void;
  /**
   * Убрать свои записи из обоих топов. Не передан ⇒ строки нет вовсе: без
   * initData (веб-гость) действие невозможно, а неактивная строка врала бы про
   * доступное действие (CLAUDE.md).
   */
  onRemoveProjects?: () => void;
  /**
   * Прокрутить к чекам — они на том же экране, ниже настроек. Не передан ⇒
   * строки нет: пока `my-spending` не ответил, прокручивать не к чему.
   */
  onPaymentHistory?: () => void;
}

// Функция, а не константа: словарь читает язык в момент обращения, и массив,
// собранный один раз при импорте, оставил бы подписи темы на языке первого
// запуска — прямо в той панели, где язык и переключают.
const themeOptions = () => [
  { value: 'auto', label: t.themeAuto },
  { value: 'light', label: t.themeLight },
  { value: 'dark', label: t.themeDark },
];

// Функция: список читает язык в момент отрисовки. Провайдеры продукта, а не
// сегодняшние способы оплаты: под моком строка иначе сообщала бы, что площадка
// принимает «Test payment».
const providers = () =>
  getPaymentProviders()
    .map((p) => p.name)
    .join(' · ');

/**
 * Настройки живут внутри профиля (design/ui_kits/mini_app/Screens.jsx):
 * у мини-аппа четыре вкладки внизу и ни одна из них не «Настройки».
 *
 * Группа Demo из кита сюда не перенесена — это была витринная кнопка «пройди
 * продукт с нуля», у продукта такой функции нет.
 */
export function SettingsPanel({
  value,
  onChange,
  notifications,
  onRules,
  onDoc,
  onRemoveProjects,
  onPaymentHistory,
}: SettingsPanelProps) {
  return (
    <div className={styles.panel}>
      <SettingsGroup label={t.appearance} footnote={t.appearanceNote}>
        <SettingsRow
          icon="languages"
          title={t.language}
          control={
            <Segmented
              options={[...LOCALES]}
              value={value.language}
              onChange={(v) => onChange('language', v as Locale)}
              size="sm"
            />
          }
        />
        <SettingsRow
          icon="sun-moon"
          title={t.theme}
          description={t.themeNote}
          control={
            <Segmented
              options={themeOptions()}
              value={value.theme}
              onChange={(v) => onChange('theme', v as ThemeChoice)}
              size="sm"
            />
          }
        />
        <SettingsRow
          icon="vibrate"
          title={t.vibration}
          description={t.vibrationNote}
          control={
            <Switch
              checked={value.haptics}
              onChange={(v) => onChange('haptics', v)}
              label={t.vibration}
            />
          }
        />
        <SettingsRow
          icon="banknote"
          title={t.currency}
          description={t.currencyNote}
          control={
            <Segmented
              options={['UZS', 'USD', 'RUB']}
              value={value.currency}
              onChange={(v) => onChange('currency', v as DisplayCurrency)}
              size="sm"
            />
          }
        />
        <SettingsRow
          icon="hash"
          title={t.compact}
          description={t.compactNote}
          control={
            <Switch
              checked={value.compactAmounts}
              onChange={(v) => onChange('compactAmounts', v)}
              label={t.compact}
            />
          }
        />
      </SettingsGroup>

      {notifications && (
        <SettingsGroup
          label={t.notifications}
          footnote={notifications.error ?? t.notificationsNote}
        >
          <SettingsRow
            icon="swords"
            title={t.attacked}
            control={
              <Switch
                checked={notifications.value.notifyAttacked}
                onChange={(v) => notifications.onChange('notifyAttacked', v)}
                label={t.attacked}
              />
            }
          />
          <SettingsRow
            icon="trending-down"
            title={t.lostPosition}
            control={
              <Switch
                checked={notifications.value.notifyRankLost}
                onChange={(v) => notifications.onChange('notifyRankLost', v)}
                label={t.lostPosition}
              />
            }
          />
          <SettingsRow
            icon="vote"
            title={t.votesDigest}
            description={t.votesDigestNote}
            control={
              <Switch
                checked={notifications.value.notifyVotes}
                onChange={(v) => notifications.onChange('notifyVotes', v)}
                segment="free"
                label={t.votesDigest}
              />
            }
          />
          <SettingsRow
            icon="user-plus"
            title={t.referralAlert}
            control={
              <Switch
                checked={notifications.value.notifyReferral}
                onChange={(v) => notifications.onChange('notifyReferral', v)}
                segment="free"
                label={t.referralAlert}
              />
            }
          />
        </SettingsGroup>
      )}

      <SettingsGroup label={t.payments} footnote={t.paymentsNote}>
        {/* Строка со значением и без действия: список провайдеров — сведение,
            а не кнопка. Открывать по ней нечего, и `disabled` тут врал бы про
            действие, которого не задумано. */}
        <SettingsRow icon="credit-card" title={t.paymentMethods} value={providers()} />
        {onPaymentHistory && (
          <SettingsRow icon="receipt-text" title={t.paymentHistory} onPress={onPaymentHistory} />
        )}
      </SettingsGroup>

      <SettingsGroup label={t.account}>
        <SettingsRow icon="gavel" title={t.rules} onPress={onRules} />
        <SettingsRow icon="send" title={t.bot} value={brand.bot} onPress={() => onDoc('bot')} />
        <SettingsRow icon="life-buoy" title={t.support} onPress={() => onDoc('support')} />
        <SettingsRow
          icon="file-text"
          title={t.terms}
          value={brand.legalVersion}
          onPress={() => onDoc('terms')}
        />
        {onRemoveProjects && (
          <SettingsRow
            icon="trash-2"
            title={t.removeProjects}
            description={t.removeProjectsNote}
            danger
            onPress={onRemoveProjects}
          />
        )}
      </SettingsGroup>
    </div>
  );
}
