import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { CATEGORY_ICON, type CategoryStat } from '@/entities/category';
import { Sheet } from './Sheet';
import styles from './AddProjectForm.module.css';

export interface AddProjectFormProps {
  open: boolean;
  onClose: () => void;
  categories: CategoryStat[];
  onSubmit: (params: { url: string; categoryId: number }) => Promise<void>;
}

/**
 * Своего экрана в дизайн-ките нет (readme.md — среди шторок Add Project не
 * перечислен), поэтому собрана из тех же токенов и той же шторки (Sheet),
 * что и остальной кит, а не с нуля. Пока только Free Top — см. комментарий
 * в entities/project/api.ts createProject.
 */
export function AddProjectForm({ open, onClose, categories, onSubmit }: AddProjectFormProps) {
  const [url, setUrl] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = url.trim().length > 0 && categoryId !== null && !submitting;

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || categoryId === null) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ url: url.trim(), categoryId });
      setUrl('');
      setCategoryId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить проект');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onClose={handleClose}>
      <div className={styles.header}>
        <span className={styles.title}>Add project</span>
        <p className={styles.hint}>
          Одной ссылки достаточно — название, описание и превью подтянем сами.
        </p>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>ССЫЛКА</span>
        <div className={styles.inputWrap}>
          <input
            type="url"
            inputMode="url"
            placeholder="https://t.me/yourproject"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={styles.input}
            disabled={submitting}
          />
        </div>
      </label>

      <div className={styles.field}>
        <span className={styles.label}>КАТЕГОРИЯ</span>
        <div className={styles.categories}>
          {categories.map((cat) => (
            <button
              key={cat.categoryId}
              type="button"
              data-active={categoryId === cat.categoryId}
              className={styles.categoryChip}
              disabled={submitting}
              onClick={() => setCategoryId(cat.categoryId)}
            >
              <Icon name={CATEGORY_ICON[cat.slug] ?? 'folder'} size={13} />
              {cat.title}
            </button>
          ))}
        </div>
      </div>

      {error && <span className={styles.error}>{error}</span>}

      <Button
        variant="free"
        size="lg"
        block
        icon="plus"
        loading={submitting}
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        Add my project
      </Button>
    </Sheet>
  );
}
