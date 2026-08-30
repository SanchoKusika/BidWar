import {
  useEffect,
  useRef,
  useState,
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
/** Значение самого --dur-sheet: страховка, если переменная не прочиталась. */
const FALLBACK_DURATION_MS = 320;

function sheetDurationMs(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--dur-sheet');
  const ms = Number.parseFloat(raw);
  return Number.isFinite(ms) ? ms : FALLBACK_DURATION_MS;
}

/**
 * Оболочка нижней шторки: скрим + закруглённая панель + хват, со свайпом вниз
 * для закрытия. Единственный модальный паттерн в системе — ни центрированных
 * диалогов, ни тостов (07 Экраны.md, «Layout rules»).
 *
 * Рендерится порталом в document.body: `.app` заворачивает и контент, и TabBar
 * в один overflow:hidden контейнер, и абсолютное позиционирование внутри него
 * не гарантирует, что шторка перекроет TabBar — портал снимает вопрос совсем,
 * встав над всем документом через position: fixed.
 */
export function Sheet({ open, onClose, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; startedAt: number; dragging: boolean } | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  /** Есть в DOM. Переживает `open = false` ровно на время анимации закрытия. */
  const [mounted, setMounted] = useState(open);
  /** Видимое состояние: с него начинается переход в обе стороны. */
  const [shown, setShown] = useState(false);
  const [scrollable, setScrollable] = useState(false);

  // Смена open — сравнением с прошлым значением прямо в рендере, без эффекта
  // (react-hooks/set-state-in-effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    setDragY(0);
    setDragging(false);
    if (open) setMounted(true);
    else setShown(false);
  }

  // Панель обязана сначала отрисоваться внизу и только следующим кадром
  // получить целевое состояние: иначе браузер сведёт оба стиля в один
  // пересчёт и перехода не будет вовсе — шторка просто появится.
  useEffect(() => {
    if (!open || !mounted) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [open, mounted]);

  // Размонтирование — по таймеру, а не по transitionend: событие может не
  // прийти вообще (вкладка ушла в фон, переход прерван, стиль не совпал), и
  // тогда шторка осталась бы висеть на экране, а кнопка Cancel выглядела бы
  // сломанной. Таймер так провалиться не может.
  useEffect(() => {
    if (open || !mounted) return;
    const timer = setTimeout(() => setMounted(false), sheetDurationMs());
    return () => clearTimeout(timer);
  }, [open, mounted]);

  // Пока шторка на экране, системный свайп-вниз Telegram выключен: иначе он
  // забирает жест раньше нашего drag и сворачивает мини-апп целиком вместо
  // того, чтобы двигать панель.
  useEffect(() => {
    if (!mounted) return;
    const platform = getPlatform();
    platform.setVerticalSwipesEnabled(false);
    return () => platform.setVerticalSwipesEnabled(true);
  }, [mounted]);

  // Прокручивается ли панель — от этого зависит, кому достаётся вертикальный
  // жест (см. touch-action в Sheet.module.css). ResizeObserver вызывает колбэк
  // сразу после observe, поэтому первого замера отдельной строкой нет: setState
  // прямо в теле эффекта запрещён (react-hooks/set-state-in-effect).
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(() => {
      setScrollable(panel.scrollHeight > panel.clientHeight + 1);
    });
    observer.observe(panel);
    for (const child of panel.children) observer.observe(child);
    return () => observer.disconnect();
  }, [mounted]);

  if (!mounted) return null;

  const canStartDrag = (target: EventTarget | null) => {
    const panel = panelRef.current;
    if (!panel || !(target instanceof Node)) return false;
    if (!panel.contains(target)) return false;
    // За хват — всегда: у него touch-action: none, жест не уйдёт скроллу.
    if (target instanceof Element && target.closest(`.${styles.grabZone}`)) return true;
    // По телу — когда прокручивать нечего или мы у самой верхней кромки:
    // иначе свайп вниз должен быть обычным скроллом, а не закрытием.
    return !scrollable || panel.scrollTop <= 0;
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
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDragY(Math.max(0, delta));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!state?.dragging) return;

    const elapsed = Math.max(1, performance.now() - state.startedAt);
    const dismiss = dragY > DISMISS_DISTANCE || dragY / elapsed > DISMISS_VELOCITY;

    // Переход нельзя включить и изменить значение в одном кадре — браузер
    // применит новое положение мгновенно. Поэтому сперва снимаем dragging
    // (панель возвращает себе transition), и только следующим кадром отпускаем
    // трансформ: панель доезжает на место или уходит вниз, продолжая жест.
    setDragging(false);
    requestAnimationFrame(() => {
      setDragY(0);
      if (dismiss) onClose();
    });
  };

  return createPortal(
    <div className={styles.scrim} data-shown={shown} onClick={onClose}>
      <div
        ref={panelRef}
        className={styles.panel}
        data-shown={shown}
        data-dragging={dragging}
        data-scrollable={scrollable}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div className={styles.grabZone}>
          <span className={styles.grabber} />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
