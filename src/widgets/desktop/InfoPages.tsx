import { Button } from '@/shared/ui/Button';
import { Icon, type IconName } from '@/shared/ui/Icon';
import { KeyRow } from '@/shared/ui/KeyRow';
import { brand, getDocs, getRules, ruleHue, type DocId } from '@/shared/content';
import { strings } from '@/shared/i18n/strings';
import { PageBand, PageGrid, RailCard, RailLink } from './Chrome';
import styles from './InfoPages.module.css';

export interface RulesPageProps {
  anchor?: string;
  onAnchor: (id: string) => void;
  onSupport: () => void;
}

/**
 * Rules of the game, one section at a time with the list in the rail
 * (ui_kits/web/Pages.jsx). The text is `shared/content` — the same the mini
 * app reads, so a dispute over a charge has one source of truth.
 */
export function RulesPage({ anchor, onAnchor, onSupport }: RulesPageProps) {
  const t = strings.rules;
  const sections = getRules();
  const rule = sections.find((r) => r.id === anchor) ?? sections[0];
  if (!rule) return null;
  const next = sections[(sections.indexOf(rule) + 1) % sections.length];

  return (
    <>
      <PageBand title={t.title} meta={t.meta} />
      <PageGrid
        rail={
          <>
            <RailCard title={strings.web.rules}>
              <div className={styles.links}>
                {sections.map((r) => (
                  <RailLink
                    key={r.id}
                    hue={ruleHue(r.id)}
                    icon={r.icon as IconName}
                    label={r.title}
                    active={r.id === rule.id}
                    onClick={() => onAnchor(r.id)}
                  />
                ))}
              </div>
            </RailCard>
            <RailCard footnote={t.askSupport}>
              <Button variant="secondary" size="md" block icon="life-buoy" onClick={onSupport}>
                {strings.docs.tabs.support}
              </Button>
            </RailCard>
          </>
        }
      >
        <section className={styles.card}>
          <div className={styles.head}>
            <span className={styles.icon} data-hue={ruleHue(rule.id)}>
              <Icon name={rule.icon as IconName} size={22} />
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
              <div>
                {rule.example.rows.map(([label, value]) => (
                  <KeyRow key={label} label={label} value={value} />
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
        </section>

        {next && next.id !== rule.id && (
          <button type="button" className={styles.next} onClick={() => onAnchor(next.id)}>
            <span className={styles.nextIcon} data-hue={ruleHue(next.id)}>
              <Icon name={next.icon as IconName} size={18} />
            </span>
            <span className={styles.nextText}>
              <span className={styles.nextLabel}>{strings.web.next}</span>
              <span className={styles.nextTitle}>{next.title}</span>
            </span>
            <Icon name="chevron-right" size={18} className={styles.nextChevron} />
          </button>
        )}
      </PageGrid>
    </>
  );
}

const DOC_ORDER: readonly DocId[] = ['about', 'support', 'terms', 'privacy', 'bot'];

export interface DocPageProps {
  id: DocId;
  onDoc: (id: DocId) => void;
  onRules: () => void;
  onOpenBot: () => void;
}

/** About, support, terms, privacy, bot — the same texts as the mini app's. */
export function DocPage({ id, onDoc, onRules, onOpenBot }: DocPageProps) {
  const docs = getDocs();
  const doc = docs[id];

  return (
    <>
      <PageBand title={doc.title} meta={doc.lead} />
      <PageGrid
        rail={
          <>
            <RailCard title={strings.web.company}>
              <div className={styles.links}>
                {DOC_ORDER.map((docId) => (
                  <RailLink
                    key={docId}
                    icon={docs[docId].icon as IconName}
                    label={strings.docs.tabs[docId]}
                    active={docId === id}
                    onClick={() => onDoc(docId)}
                  />
                ))}
              </div>
            </RailCard>
            <RailCard title={strings.web.atAGlance}>
              <div>
                {doc.facts.map(([label, value]) => (
                  <KeyRow key={label} label={label} value={value} />
                ))}
              </div>
            </RailCard>
            <RailCard title={strings.rules.title} footnote={strings.web.rulesSections}>
              <Button variant="secondary" size="md" block icon="gavel" onClick={onRules}>
                {strings.web.openRules}
              </Button>
            </RailCard>
          </>
        }
      >
        <section className={styles.card}>
          {doc.sections.map((section) => (
            <div key={section.h} className={styles.section}>
              <h3 className={styles.sectionTitle}>{section.h}</h3>
              <p className={styles.sectionText}>{section.p}</p>
            </div>
          ))}
        </section>
        {id === 'bot' && (
          <div className={styles.actions}>
            <Button variant="primary" size="lg" icon="send" onClick={onOpenBot}>
              {strings.docs.openBot(brand.bot)}
            </Button>
          </div>
        )}
      </PageGrid>
    </>
  );
}
