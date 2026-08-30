import {
  useEffect,
  useRef,
  useState,
  type AnimationEvent as ReactAnimationEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { getPlatform } from '@/shared/platform';
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

/** null — не смонтирована; entering/exiting — играют кадры, open — стоит неподвижно. */
type Phase = 'entering' | 'open' | 'exiting' | null;

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
  // Свайп сам по себе уже анимация закрытия — сценарную ds-sheet-panel-out
  // поверх нёе не играем, иначе панель дёрнется обратно в 0 и тут же снова
  // уедет вниз. Состояние, а не ref — читается прямо в рендере ниже
  // (react-hooks/refs запрещает трогать .current во время рендера).
  const [dragDismissed, setDragDismissed] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [animated, setAnimated] = useState(false);
  const [phase, setPhase] = useState<Phase>(open ? 'open' : null);

  // Открытие/закрытие шторки — сравнение с прошлым open прямо в рендере, без
  // эффекта (react-hooks/set-state-in-effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setDragY(0);
    if (open) {
      setPhase('entering');
    } else if (dragDismissed) {
      setDragDismissed(false);
      setPhase(null);
    } else {
      setPhase('exiting');
    }
  }

  // Пока шторка на экране (entering/open/exiting) — гасим системный свайп-вниз
  // Telegram: без этого он забирает жест раньше, чем наш drag ниже (одиночный
  // свайп сворачивает мини-апп целиком, а панель не двигается вовсе).
  const visible = phase !== null;
  useEffect(() => {
    if (!visible) return;
    const platform = getPlatform();
    platform.setVerticalSwipesEnabled(false);
    return () => platform.setVerticalSwipesEnabled(true);
  }, [visible]);

  if (phase === null) return null;

  // Кадр CSS-анимации отыграл: entering → open (панель осела), exiting →
  // размонтирование. Проверка target === currentTarget — событие всплывает от
  // панели к скриму, а у них разные кадры и может не совпасть длительность.
  const handleAnimationEnd = (e: ReactAnimationEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (phase === 'entering') setPhase('open');
    else if (phase === 'exiting') setPhase(null);
  };

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
      setDragDismissed(true);
      onClose();
    }
    setDragY(0);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return createPortal(
    <div
      className={styles.scrim}
      data-phase={phase}
      onClick={onClose}
      onAnimationEnd={handleAnimationEnd}
    >
      <div
        ref={panelRef}
        className={styles.panel}
        data-phase={phase}
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
