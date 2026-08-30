import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon, type IconName } from '@/shared/ui/Icon';
import { KeyRow } from '@/shared/ui/KeyRow';
import { rules } from '@/shared/content';
import { strings } from '@/shared/i18n/strings';
import { PageHeader } from './PageHeader';
import { ChipRow } from './ChipRow';
import { Card, Gutter, ScreenBody } from './ScreenLayout';
import styles from './RulesScreen.module.css';

const t = strings.rules;

export interface RulesScreenProps {
  /** Раздел, с которого открыли: из чипа в шапке ленты или из настроек. */
  anchor?: string;
  onBack: () => void;
  onSupport: () => void;
}

const CHIPS = rules.map((r) => ({ id: r.id, label: r.title, icon: r.icon as IconName }));

/**
 * Правила игры (design/ui_kits/mini_app/Screens.jsx). Текст берётся из
 * shared/content/rules — того же модуля, что читает сайт: правила обязаны
 * читаться одинаково на обеих площадках, иначе спор о списании не разрешить.
 */
export function RulesScreen({ anchor, onBack, onSupport }: RulesScreenProps) {
  const [active, setActive] = useState(anchor ?? rules[0]?.id ?? '');
  const rule = rules.find((r) => r.id === active) ?? rules[0];

  if (!rule) return null;

  return (
    <>
      <PageHeader title={t.title} meta={t.meta} onBack={onBack} />

      <ScreenBody>
        <ChipRow items={CHIPS} value={active} onChange={setActive} />

        <Gutter>
          <Card>
            <div className={styles.head}>
              <span className={styles.icon}>
                <Icon name={rule.icon as IconName} size={19} />
              </span>
              <h2 className={styles.title}>{rule.title}</h2>
            </div>

            <p className={styles.lead}>{rule.lead}</p>

            <div>
              {rule.facts.map(([label, value]) => (
                <KeyRow key={label} label={label} value={value} />
              ))}
            </div>

            {rule.example && (
              <div className={styles.example}>
                <span className={styles.exampleTitle}>{rule.example.title}</span>
                <div className={styles.exampleRows}>
                  {rule.example.rows.map(([label, value]) => (
                    <div key={label} className={styles.exampleRow}>
                      <span className={styles.exampleLabel}>{label}</span>
                      <span className={styles.exampleValue}>{value}</span>
                    </div>
                  ))}
                </div>
                <span className={styles.exampleNote}>{rule.example.note}</span>
              </div>
            )}

            <ul className={styles.points}>
              {rule.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </Card>
        </Gutter>

        <Gutter>
          <Button variant="secondary" size="md" block icon="life-buoy" onClick={onSupport}>
            {t.askSupport}
          </Button>
        </Gutter>
      </ScreenBody>
    </>
  );
}
