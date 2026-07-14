import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

/**
 * useVerticalSwipe — a robust vertical swipe/drag recognizer built on raw
 * Pointer Events + setPointerCapture.
 *
 * WHY NOT Framer's drag? The bet-slip sheets need to start a drag from the card
 * body while EXCLUDING children (the ×/Lista buttons, the swipe-to-confirm
 * thumb, the internal scroll list). Framer's way to do that is
 * `dragControls` + `dragListener={false}`, but in that mode Framer does NOT own
 * the listener and does NOT auto-apply `touch-action` — and on real mobile
 * browsers the touch gesture never reaches Framer (the browser claims it, or the
 * drag-locked element yields no movement so the pan bails). Framer's OWNED
 * listener (plain `drag="x"`, as in SwipeToConfirm) works on mobile precisely
 * because it sets `touch-action` itself.
 *
 * This hook sidesteps all of that: on pointerdown (when the target isn't
 * excluded) it captures the pointer, then drives `onMove(dy)` from raw pointer
 * moves and calls `onEnd(dy, velocityY)` on release. Pair it with
 * `touch-action: none` on the element so the browser doesn't scroll-steal the
 * gesture. `onStart` fires lazily on the first move past a small threshold (so a
 * plain tap doesn't count as a drag).
 */

const START_THRESHOLD_PX = 3;

type DragState = {
  id: number;
  startY: number;
  lastY: number;
  lastT: number;
  vy: number;
  started: boolean;
};

export type VerticalSwipeHandlers = {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
};

export function useVerticalSwipe(opts: {
  /** Gate — return false to ignore pointerdowns entirely (e.g. collapsed pill). */
  enabled?: () => boolean;
  /** CSS selector for children that must NOT start the swipe (default buttons + scroll regions). */
  exclude?: string;
  /** Fired once, when movement first passes the start threshold (like Framer's onDragStart). */
  onStart?: () => void;
  /** Fired on every move while dragging. `dy` = pixels moved down since start (negative = up). */
  onMove: (dy: number) => void;
  /** Fired on release. `dy` = final offset, `vy` = vertical velocity in px/s (down positive). */
  onEnd: (dy: number, vy: number) => void;
}): VerticalSwipeHandlers {
  const { enabled, exclude = 'button,[data-scroll]', onStart, onMove, onEnd } =
    opts;
  const state = useRef<DragState | null>(null);

  return {
    onPointerDown(e) {
      if (enabled && !enabled()) return;
      // Only the primary button / touch contact drives the drag.
      if (e.button > 0) return;
      const target = e.target as HTMLElement;
      if (exclude && target.closest(exclude)) return;
      state.current = {
        id: e.pointerId,
        startY: e.clientY,
        lastY: e.clientY,
        lastT: e.timeStamp,
        vy: 0,
        started: false,
      };
      // Capture so we keep receiving moves even if the finger slides off the
      // card (or over a child) mid-drag.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* not all environments allow capture; the drag still works via bubbling */
      }
    },
    onPointerMove(e) {
      const s = state.current;
      if (!s || e.pointerId !== s.id) return;
      const dy = e.clientY - s.startY;
      const dt = e.timeStamp - s.lastT;
      if (dt > 0) s.vy = ((e.clientY - s.lastY) / dt) * 1000;
      s.lastY = e.clientY;
      s.lastT = e.timeStamp;
      if (!s.started) {
        if (Math.abs(dy) < START_THRESHOLD_PX) return;
        s.started = true;
        onStart?.();
      }
      onMove(dy);
    },
    onPointerUp(e) {
      const s = state.current;
      if (!s || e.pointerId !== s.id) return;
      state.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      // A tap (never crossed the threshold) is not a swipe — do nothing.
      if (s.started) onEnd(e.clientY - s.startY, s.vy);
    },
    onPointerCancel(e) {
      const s = state.current;
      if (!s || e.pointerId !== s.id) return;
      state.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (s.started) onEnd(e.clientY - s.startY, s.vy);
    },
  };
}
