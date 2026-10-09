import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/shared/ui/Icon';
import { strings } from '@/shared/i18n/strings';
import styles from './Dialog.module.css';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The desktop counterpart of the bottom sheet: a centred dialog
 * (ui_kits/web/Chrome.jsx). The mini app's sheet bodies go into it as they
 * are — `Sheet` hands its children here when the layout is desktop — so a
 * raise, an attack or a payment reads the same on both.
 */
export function Dialog({ open, onClose, children }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    // The page under a dialog must not scroll away from it.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={styles.scrim} onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label={strings.common.close}
        >
          <Icon name="x" size={15} />
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
