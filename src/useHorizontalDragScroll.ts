import { useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';

// Small mouse movements remain ordinary clicks, including promo switches.
const MOUSE_DRAG_THRESHOLD_PX = 6;

type DragState = {
  pointerId: number;
  startX: number;
  scrollLeft: number;
  dragging: boolean;
  snapType: string;
};

/** Mouse-only scrolling; touch continues to use the browser's native pan-x. */
export function useHorizontalDragScroll() {
  const state = useRef<DragState | null>(null);
  const suppressClick = useRef(false);

  const finish = (e: PointerEvent<HTMLElement>, clickWillFollow: boolean) => {
    const drag = state.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    state.current = null;
    if (drag.dragging) {
      e.currentTarget.style.scrollSnapType = drag.snapType;
      e.currentTarget.dataset.dragging = 'false';
      suppressClick.current = clickWillFollow;
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return {
    onPointerDownCapture(e: PointerEvent<HTMLElement>) {
      suppressClick.current = false;
      if (e.pointerType !== 'mouse' || e.button !== 0 || !e.isPrimary) return;
      e.stopPropagation();
      state.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        scrollLeft: e.currentTarget.scrollLeft,
        dragging: false,
        snapType: e.currentTarget.style.scrollSnapType,
      };
      // Capture only after movement: capturing here would retarget a switch's
      // normal click to the carousel instead of the button.
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const drag = state.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      if ((e.buttons & 1) === 0) {
        finish(e, false);
        return;
      }
      const dx = e.clientX - drag.startX;
      if (!drag.dragging) {
        if (Math.abs(dx) < MOUSE_DRAG_THRESHOLD_PX) return;
        drag.dragging = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        // Mandatory snapping otherwise fights each scrollLeft update. Restore
        // it on release/cancel so native touch and the resting carousel snap.
        e.currentTarget.style.scrollSnapType = 'none';
        e.currentTarget.dataset.dragging = 'true';
      }
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.scrollLeft = drag.scrollLeft - dx;
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      finish(e, true);
    },
    onPointerCancel(e: PointerEvent<HTMLElement>) {
      finish(e, false);
    },
    onLostPointerCapture(e: PointerEvent<HTMLElement>) {
      finish(e, false);
    },
    onClickCapture(e: MouseEvent<HTMLElement>) {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
}
