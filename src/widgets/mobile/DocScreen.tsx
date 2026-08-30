import { Button } from '@/shared/ui/Button';
import type { IconName } from '@/shared/ui/Icon';
import { KeyRow } from '@/shared/ui/KeyRow';
import { brand, docs, type DocId } from '@/shared/content';
import { strings } from '@/shared/i18n/strings';
import { PageHeader } from './PageHeader';
import { ChipRow } from './ChipRow';
import { Gutter, RowsCard, ScreenBody } from './ScreenLayout';
import styles from './DocScreen.module.css';

const t = strings.docs;

export interface DocScreenProps {
  id: DocId;
  onBack: () => void;
  onDoc: (id: DocId) => void;
}

/** Порядок вкладок задан в ките и держит смысловую последовательность. */
const ORDER: readonly DocId[] = ['about', 'support', 'terms', 'privacy', 'bot'];

const CHIPS = ORDER.map((id) => ({
  id,
  label: t.tabs[id],
  icon: docs[id].icon as IconName,
}));

/**
 * Служебные страницы: о проекте, поддержка, условия, приватность, бот
 * (design/ui_kits/mini_app/Screens.jsx). Текст — из shared/content/docs,
 * общего с сайтом.
 */
export function DocScreen({ id, onBack, onDoc }: DocScreenProps) {
  const doc = docs[id];

  return (
    <>
      <PageHeader title={doc.title} meta={doc.lead} onBack={onBack} />

      <ScreenBody>
        <ChipRow items={CHIPS} value={id} onChange={onDoc} />

        <Gutter>
          <RowsCard>
            {doc.facts.map(([label, value]) => (
              <KeyRow key={label} label={label} value={value} />
            ))}
          </RowsCard>
        </Gutter>

        <Gutter className={styles.sections}>
          {doc.sections.map((section) => (
            <div key={section.h} className={styles.section}>
              <h3 className={styles.heading}>{section.h}</h3>
              <p className={styles.text}>{section.p}</p>
            </div>
          ))}
        </Gutter>

        {id === 'bot' && (
          <Gutter>
            <Button variant="primary" size="lg" block icon="send">
              {t.openBot(brand.bot)}
            </Button>
          </Gutter>
        )}
      </ScreenBody>
    </>
  );
}
