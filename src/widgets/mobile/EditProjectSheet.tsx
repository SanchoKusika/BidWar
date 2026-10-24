import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { strings } from '@/shared/i18n/strings';
import { EDIT_LIMITS, type ShowcaseType } from '@/entities/project';
import { Sheet } from './Sheet';
import { SheetHeader } from './SheetHeader';
import { SheetActions, SheetField, SheetNote } from './SheetParts';
import styles from './EditProjectSheet.module.css';

export interface EditProjectSheetProps {
  open: boolean;
  onClose: () => void;
  segment: ShowcaseType;
  name: string;
  description: string | null;
  onSubmit: (fields: { name: string; description: string }) => Promise<void>;
}

/**
 * The owner names and describes the project in their own words. The link
 * preview is a guess, and on some platforms not even that: Instagram and
 * LinkedIn answer the server with a login wall or a refusal.
 */
export function EditProjectSheet({
  open,
  onClose,
  segment,
  name,
  description,
  onSubmit,
}: EditProjectSheetProps) {
  const t = strings.editProject;
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every opening starts from what the card shows now — compared in render,
  // not reset in an effect (react-hooks/set-state-in-effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraftName(name);
      setDraftDescription(description ?? '');
      setError(null);
    }
  }

  const trimmedName = draftName.trim();
  const changed =
    trimmedName !== name.trim() || draftDescription.trim() !== (description ?? '').trim();
  const canSubmit = trimmedName.length > 0 && changed && !submitting;

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name: trimmedName, description: draftDescription.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : t.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onClose={handleClose}>
      <SheetHeader icon="pencil" tone={segment} title={t.title} subtitle={t.subtitle} />

      <SheetField as="label" label={t.nameLabel}>
        <input
          type="text"
          value={draftName}
          maxLength={EDIT_LIMITS.name}
          placeholder={t.namePlaceholder}
          onChange={(e) => setDraftName(e.target.value)}
          className={styles.input}
          disabled={submitting}
        />
      </SheetField>

      <SheetField
        as="label"
        label={
          <span className={styles.labelRow}>
            {t.descriptionLabel}
            <span className={styles.counter}>
              {t.counter(draftDescription.length, EDIT_LIMITS.description)}
            </span>
          </span>
        }
      >
        <textarea
          value={draftDescription}
          maxLength={EDIT_LIMITS.description}
          placeholder={t.descriptionPlaceholder}
          rows={4}
          onChange={(e) => setDraftDescription(e.target.value)}
          className={styles.textarea}
          disabled={submitting}
        />
      </SheetField>

      <SheetNote tone="muted" icon="info">
        {t.note}
      </SheetNote>

      {error && <span className={styles.error}>{error}</span>}

      <SheetActions onSecondary={handleClose} secondaryDisabled={submitting}>
        <Button
          variant={segment}
          size="lg"
          icon="check"
          loading={submitting}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {t.save}
        </Button>
      </SheetActions>
    </Sheet>
  );
}
