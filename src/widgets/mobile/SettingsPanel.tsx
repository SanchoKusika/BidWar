import { Segmented } from '@/shared/ui/Segmented';
import { SettingsGroup, SettingsRow } from '@/shared/ui/Settings';
import { Switch } from '@/shared/ui/Switch';
import type { DisplayCurrency } from '@/shared/lib/format';
import type { AppSettings, ThemeChoice } from '@/shared/settings';
import { PREVIEW } from '@/shared/config/preview';
import { brand, payments, type DocId } from '@/shared/content';
import { strings } from '@/shared/i18n/strings';
import styles from './SettingsPanel.module.css';

const t = strings.settings;

export type Language = 'RU' | 'UZ' | 'EN';
export type { ThemeChoice };

/**
 * Работающие настройки приходят из `shared/settings`, остальные поля — только
 * заглушки кита и живут за `PREVIEW.settingsStubs`.
 */
export interface SettingsState extends AppSettings {
  language: Language;
  haptics: boolean;
  alertAttacked: boolean;
  alertLostPosition: boolean;
  alertNewTasks: boolean;
  confirmPayments: boolean;
}

export interface SettingsPanelProps {
  value: SettingsState;
  onChange: <K extends keyof SettingsState>(key: K, next: SettingsState[K]) => void;
  onRules: () => void;
  onDoc: (id: DocId) => void;
}

const THEME_OPTIONS = [
  { value: 'auto', label: t.themeAuto },
  { value: 'light', label: t.themeLight },
  { value: 'dark', label: t.themeDark },
];

const PROVIDERS = payments.map((p) => p.name).join(' · ');

/**
 * Настройки живут внутри профиля (design/ui_kits/mini_app/Screens.jsx):
 * у мини-аппа четыре вкладки внизу и ни одна из них не «Настройки».
 *
 * Группа Demo из кита сюда не перенесена — это была витринная кнопка «пройди
 * продукт с нуля», у продукта такой функции нет.
 */
export function SettingsPanel({ value, onChange, onRules, onDoc }: SettingsPanelProps) {
  return (
    <div className={styles.panel}>
      <SettingsGroup label={t.appearance} footnote={t.appearanceNote}>
        {PREVIEW.settingsStubs && (
          <SettingsRow
            icon="languages"
            title={t.language}
            control={
              <Segmented
                options={['RU', 'UZ', 'EN']}
                value={value.language}
                onChange={(v) => onChange('language', v as Language)}
                size="sm"
              />
            }
          />
        )}
        <SettingsRow
          icon="sun-moon"
          title={t.theme}
          description={t.themeNote}
          control={
            <Segmented
              options={THEME_OPTIONS}
              value={value.theme}
              onChange={(v) => onChange('theme', v as ThemeChoice)}
              size="sm"
            />
          }
        />
        {PREVIEW.settingsStubs && (
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
        )}
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

      {PREVIEW.settingsStubs && (
        <SettingsGroup label={t.notifications} footnote={t.notificationsNote}>
          <SettingsRow
            icon="swords"
            title={t.attacked}
            control={
              <Switch
                checked={value.alertAttacked}
                onChange={(v) => onChange('alertAttacked', v)}
                label={t.attacked}
              />
            }
          />
          <SettingsRow
            icon="trending-down"
            title={t.lostPosition}
            control={
              <Switch
                checked={value.alertLostPosition}
                onChange={(v) => onChange('alertLostPosition', v)}
                label={t.lostPosition}
              />
            }
          />
          <SettingsRow
            icon="list-checks"
            title={t.newTasks}
            description={t.newTasksNote}
            control={
              <Switch
                checked={value.alertNewTasks}
                onChange={(v) => onChange('alertNewTasks', v)}
                segment="free"
                label={t.newTasks}
              />
            }
          />
        </SettingsGroup>
      )}

      <SettingsGroup label={t.payments} footnote={t.paymentsNote}>
        {PREVIEW.settingsStubs && (
          <SettingsRow
            icon="shield-check"
            title={t.confirmPayments}
            description={t.confirmPaymentsNote}
            control={
              <Switch
                checked={value.confirmPayments}
                onChange={(v) => onChange('confirmPayments', v)}
                label={t.confirmPayments}
              />
            }
          />
        )}
        <SettingsRow icon="credit-card" title={t.paymentMethods} value={PROVIDERS} disabled />
        <SettingsRow icon="receipt-text" title={t.paymentHistory} disabled />
      </SettingsGroup>

      <SettingsGroup label={t.account}>
        <SettingsRow icon="gavel" title={t.rules} onPress={onRules} />
        <SettingsRow icon="send" title={t.bot} value={brand.bot} onPress={() => onDoc('bot')} />
        <SettingsRow icon="life-buoy" title={t.support} onPress={() => onDoc('support')} />
        <SettingsRow icon="file-text" title={t.terms} onPress={() => onDoc('terms')} />
        <SettingsRow icon="log-out" title={t.logOut} disabled />
        <SettingsRow icon="trash-2" title={t.deleteAccount} danger disabled />
      </SettingsGroup>
    </div>
  );
}
