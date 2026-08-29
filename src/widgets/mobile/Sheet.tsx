import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Sheet.module.css';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Ниже — закрыть; иначе панель возвращается на место. */
const DISMISS_DISTANCE = 96;
/** Резкий свайп закрывает и на меньшей дистанции. */
const DISMISS_VELOCITY = 0.5;

/**
 * Оболочка нижней шторки: скрим + закруглённая панель + грабер, со свайпом
 * вниз для закрытия. Единственный модальный паттерн в системе — ни
 * центрированных диалогов, ни тостов (07 Экраны.md, «Layout rules»).
 *
 * Рендерится порталом в document.body: `.app` заворачивает и контент, и
 * TabBar в один overflow:hidden контейнер, и абсолютное позиционирование
 * внутри него не гарантирует, что шторка перекроет TabBar — портал снимает
 * вопрос совсем, встав над всем документом через position: fixed.
 */
export function Sheet({ open, onClose, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startedAt: number; dragging: boolean } | null>(null);
  const [dragY, setDragY] = useState(0);
  const [animated, setAnimated] = useState(false);

  // Сброс "зависшего" сдвига панели, если шторку закрыли не свайпом (кнопкой,
  // сабмитом), а посреди жеста — сравнение с прошлым open прямо в рендере,
  // без эффекта (react-hooks/set-state-in-effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setDragY(0);
  }

  if (!open) return null;

  const canStartDrag = (target: EventTarget | null) => {
    const panel = panelRef.current;
    if (!panel || !(target instanceof Node)) return false;
    // Тащить можно только когда панель проскроллена до самого верха —
    // иначе свайп вниз должен быть обычным скроллом контента, не закрытием.
    // Грабер всегда там же (первый элемент), так что за него можно тащить
    // при любой прокрутке, всё остальное — только у верхней кромки.
    if (!panel.contains(target)) return false;
    if (target instanceof Element && target.closest(`.${styles.grabber}`)) return true;
    return panel.scrollTop <= 0;
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!canStartDrag(e.target)) return;
    drag.current = { startY: e.clientY, startedAt: performance.now(), dragging: false };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const delta = e.clientY - state.startY;
    if (!state.dragging) {
      if (delta <= 4) return; // движение вверх/дрожание — не начинаем тащить
      state.dragging = true;
      setAnimated(false);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    e.preventDefault();
    setDragY(Math.max(0, delta));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    drag.current = null;
    if (!state?.dragging) return;

    const elapsed = Math.max(1, performance.now() - state.startedAt);
    const velocity = dragY / elapsed;
    setAnimated(true);
    if (dragY > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
      onClose();
    }
    setDragY(0);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return createPortal(
    <div className={styles.scrim} onClick={onClose}>
      <div
        ref={panelRef}
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: animated ? undefined : 'none',
        }}
      >
        <span className={styles.grabber} />
        {children}
      </div>
    </div>,
    document.body,
  );
}
