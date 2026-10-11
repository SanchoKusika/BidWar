import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/shared/ui/Icon';
import { strings } from '@/shared/i18n/strings';
import {
  holdOverlay,
  isOverlayLeaving,
  markOverlayLeaving,
  useOverlayOpen,
} from '@/shared/lib/overlay';
import { usePresence } from '@/shared/lib/presence';
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
 *
 * Only the panel is drawn here; the dimming under it is `DialogScrim`, one
 * for every dialog. A payment walks through three of them — raise, pay, the
 * receipt — and the next one opens in the same commit the last one closes:
 * it then starts a beat after the last one begins to leave, so the step
 * reads as one dialog changing its content rather than two crossing.
 */
export function Dialog({ open, onClose, children }: DialogProps) {
  const { mounted, shown, handoff } = usePresence(open, '--dur-fast', isOverlayLeaving);
  // A leaving dialog shows what it showed last while open. The page changes
  // the sheet's props in the same click that closes it — a raise of someone
  // else's project turned into «raise yours» halfway through fading out.
  const [kept, setKept] = useState(children);
  if (open && kept !== children) setKept(children);

  // Apart from the key handler: `onClose` is a new function on most renders,
  // and the hold must not be dropped and taken again with it.
  useEffect(() => {
    if (!open) return;
    return holdOverlay();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open || !mounted) return;
    return markOverlayLeaving();
  }, [open, mounted]);

  if (!mounted) return null;

  return createPortal(
    // The frame takes the clicks around the panel; the scrim under it only
    // draws. A leaving frame lets clicks through to the one taking over.
    <div
      className={styles.frame}
      data-shown={shown}
      data-handoff={handoff}
      onClick={open ? onClose : undefined}
    >
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
        {open ? children : kept}
      </div>
    </div>,
    document.body,
  );
}

/**
 * The dimming under the site's dialogs — one for all of them, mounted by the
 * site's shell. It stays while any dialog is open, so a hand-off between two
 * never lets the page show through.
 */
export function DialogScrim() {
  const open = useOverlayOpen();
  const { mounted, shown } = usePresence(open, '--dur-fast');

  useEffect(() => {
    if (!open) return;
    // The page under a dialog must not scroll away from it.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!mounted) return null;
  return createPortal(<div className={styles.scrim} data-shown={shown} />, document.body);
}
