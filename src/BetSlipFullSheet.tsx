import {
  animate,
  motion,
  useMotionValue,
  usePresence,
  useSpring,
  useTransform,
} from 'framer-motion';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { AmountKeypad, KEYPAD_H } from './AmountKeypad';
import { useStakeKeypad } from './useStakeKeypad';
import { useVerticalSwipe } from './useVerticalSwipe';
import boosterIllus from './assets/booster.png';
import chevronRightIcon from './assets/chevron_right.svg';
import clockIcon from './assets/clock.svg';
import closeIcon from './assets/close.svg';
import editIcon from './assets/edit.svg';
import freebetIllus from './assets/freebet.png';
import trashIcon from './assets/trash.svg';
import { SelectionGroups } from './SelectionGroups';
import { SwipeToConfirm } from './SwipeToConfirm';
import type { Selection } from './types';

/**
 * BetSlipFullSheet — the "Resumen de tu entrada" floating card.
 *
 * Opened from the parlay slip's "Lista" tab. A bottom-anchored floating card
 * (all corners rounded) over a dimming overlay — NOT an edge-to-edge sheet.
 * It sits at the navbar's height and grows/shrinks with the number of
 * selections, capped so its top always stops below the app header (the header
 * stays visible). Once the cap is hit the selections list scrolls internally.
 * Slides up over the phone frame; swiping it down or pressing × closes it AND
 * collapses the underlying bet slip (onClose).
 *
 * Includes: header (delete-all trash + × + count + balance), scrollable
 * selections list, Monto/Momio/Ganancia footer, the free-bet/Booster promos
 * box, the "accept odds changes" checkbox, and swipe-to-play. Toggle switches
 * and the checkbox are CSS controls. STILL PENDING one asset: the countdown
 * clock icon — the countdown pills currently show the time text without it.
 *
 * Assets: close.svg (× + per-row remove), shield.svg (team placeholder),
 * edit.svg (Monto), chevron_right.svg (swipe thumb + Booster caret),
 * trash.svg (delete-all), freebet.png / booster.png (promo illustrations).
 */

const fmtOdds = (n: number) => `${n.toFixed(2)}x`;

const CLOSE_OFFSET_PX = 120;
const CLOSE_VELOCITY = 550;
// Open/close morph. Instead of sliding in from off-screen, the card GROWS out
// of the bet-slip footprint (a bottom-up clip-path reveal) while its content +
// backdrop crossfade — mirroring the collapsed-pill ↔ summarized-card morph in
// BetSlipSheet, so summarized slip → floating pill → this card all read as ONE
// surface changing shape. `openP` 0 = slip-sized capsule, 1 = full card.
const OPEN_SPRING = { type: 'spring', stiffness: 340, damping: 36 } as const;
// Squash-&-stretch pulse on close — mirrors BetSlipSheet's collapse pulse
// (COLLAPSE_PULSE_*) so the card visibly squashes into the pill as it shrinks.
const CLOSE_PULSE_SCALE_X = 1.03;
const CLOSE_PULSE_SCALE_Y = 0.95;
const PULSE_SPRING = { type: 'spring', stiffness: 300, damping: 16 } as const;
// Reveal starts at the collapsed-pill capsule height (matches BetSlipSheet's
// COLLAPSED_GLASS_H) so the card appears to grow straight out of the pill.
const START_H = 56;
// The card sits at the navbar line, but the bet-slip pill sits ~this many px
// HIGHER (above the navbar). As the card shrinks to the capsule it also rises
// by this much so it lands ON the pill (not the navbar). Ramps in only over the
// small end of the morph so the full card stays put at the navbar line.
const PILL_RISE_PX = 62;
// Top inset of the floating card's max height — the app header (sticky topbar,
// ~88px on the 390×844 mockup) must stay visible, so the card can never grow
// past this line. Only bounds the MAX height; small slips stay bottom-anchored.
const TOP_INSET_PX = 96;
// Bottom gap so the card's lower edge lines up with the navbar (which sits
// pb-4 = 16px above the safe-area inset).
const BOTTOM_GAP_PX = 16;
// Overlay stays transparent across this top band (the ~88px app header) so the
// header is never dimmed, then ramps to full scrim just below it.
const HEADER_UNDIM_PX = 88;

// Full-card fill/border (dark). As the card shrinks toward the pill it
// cross-fades to the PILL look below so the capsule reads as the SAME purple
// bet-slip pill — NOT the dark navbar behind it.
const SHEET_BG = 'linear-gradient(to bottom, #191919 0%, #0f0f0f 100%)';
const CARD_BORDER = 'rgba(251,251,251,0.12)';
// Purple pill fill/border — matches BetSlipSheet's GLASS_BG + #4b20ff border
// (the collapsed pill), so the fully-shrunk capsule is pixel-close to the pill.
const PILL_BG = 'linear-gradient(64.6deg, #14083d 0%, #230c3e 100%)';
const PILL_BORDER = '#4b20ff';

type Props = {
  selections: Selection[];
  cumulativeOdds: number;
  /** Entry amount (shared stake from App). */
  stake: number;
  /** Commit a new amount from the keypad. */
  onStakeChange: (next: number) => void;
  onRemove: (id: string) => void;
  /** Remove every selection from one match (× on an SGP group header). */
  onRemoveGroup: (matchId: string) => void;
  /** Delete-all (trash) — clears the whole slip. */
  onClearAll: () => void;
  /** Swipe-down or × — closes the sheet and collapses the bet slip. */
  onClose: () => void;
  /** Swipe-to-play — places the bet. */
  onConfirm: () => void;
};

export function BetSlipFullSheet({
  selections,
  cumulativeOdds,
  stake,
  onStakeChange,
  onRemove,
  onRemoveGroup,
  onClearAll,
  onClose,
  onConfirm,
}: Props) {
  const orderedSelections = [...selections].reverse(); // latest first

  // Numeric keypad for editing the amount. When at the max card height the
  // keypad's slot shrinks the (flex-1) selections list; below the cap the whole
  // card grows to fit it — both handled by the existing flex layout. The slot
  // height is a spring that follows a target (canonical useSpring pattern), so
  // it grows/shrinks smoothly when opened/closed.
  const keypad = useStakeKeypad(stake, onStakeChange);
  const KEYPAD_SLOT = KEYPAD_H + 1; // + the 1px top divider
  const keypadTarget = useMotionValue(0);
  const keypadHeight = useSpring(keypadTarget, OPEN_SPRING);
  useEffect(() => {
    keypadTarget.set(keypad.open ? KEYPAD_SLOT : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keypad.open]);
  // Winnings track the amount being edited (draft while the keypad is open,
  // otherwise the saved stake) so Monto / Ganancia / swipe all stay in sync.
  const potentialWin = Math.round(cumulativeOdds * keypad.displayValue);

  // SHAPE MORPH — the card grows out of the slip footprint on open and shrinks
  // back INTO it on close (never slides like a bottom sheet). `openP` (1 = full
  // card, 0 = pill-sized capsule) drives a clip-path reveal + content/backdrop
  // crossfade both ways; the close is a spring (settles into the pill), and the
  // swipe-down gesture drives `openP` directly (the card shrinks with the
  // finger — mirroring BetSlipSheet's summarized↔pill collapse), NOT a y-slide.
  const [isPresent, safeToRemove] = usePresence();
  const openP = useMotionValue(0);

  // Resting card height (content height, capped at the frame) — measured so the
  // clip reveal knows how far to open; re-measured as selections change. Read
  // synchronously before paint so the first frame starts at the right size.
  const cardRef = useRef<HTMLDivElement>(null);
  const fullH = useMotionValue(560);
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      if (h > 0) fullH.set(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isPresent) {
      // Opaque on open so the growing capsule covers the pill/slip behind it —
      // the card must never let the bet slip show through as it grows.
      cardOpacity.set(1);
      const a = animate(openP, 1, OPEN_SPRING);
      return () => a.stop();
    }
    // Reverse the morph on the SAME spring so the card settles down into the
    // pill (never a fast slide-away), then unmount. A subtle squash pulse
    // (same as the summarized slip's collapse) plays as it shrinks in.
    scaleX.set(CLOSE_PULSE_SCALE_X);
    scaleY.set(CLOSE_PULSE_SCALE_Y);
    const px = animate(scaleX, 1, PULSE_SPRING);
    const py = animate(scaleY, 1, PULSE_SPRING);
    // Fade the card out only over the LAST stretch of the close (openP < 0.12)
    // so the real pill's content is revealed as the capsule reaches pill size.
    const unsub = openP.on('change', (v) => {
      cardOpacity.set(Math.min(1, v / 0.12));
    });
    const a = animate(openP, 0, OPEN_SPRING);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      safeToRemove?.();
    };
    a.then(finish);
    // Safety net — force the unmount even if the spring's completion callback
    // never fires, so the overlay can never get stuck mounted and blocking.
    const fallback = window.setTimeout(finish, 600);
    return () => {
      done = true;
      a.stop();
      px.stop();
      py.stop();
      unsub();
      window.clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);

  // Bottom-up clip reveal (top inset shrinks to 0 as it opens) + crossfades.
  const clipPath = useTransform([openP, fullH], ([p, h]: number[]) => {
    const top = Math.max(0, (h - START_H) * (1 - p));
    return `inset(${top}px 0px 0px 0px round 28px)`;
  });
  const contentOpacity = useTransform(openP, [0.2, 0.8], [0, 1]);
  const backdropOpacity = useTransform(openP, [0, 1], [0, 1]);
  // The ENTIRE overlay becomes click-through the instant the card is closed, so
  // even if this component lingers mounted it can never block the feed beneath.
  const overlayPE = useTransform(openP, (v) => (v < 0.05 ? 'none' : 'auto'));
  // Fill/border color morph — purple pill (small) ↔ dark card (full). Biased to
  // the small end so the capsule is purple by the time it's pill-sized.
  const cardDarkOpacity = useTransform(openP, [0.15, 0.55], [0, 1]);
  const borderColor = useTransform(openP, [0.15, 0.55], [PILL_BORDER, CARD_BORDER]);
  // Position morph — lift the card up to the pill's line as it shrinks (only
  // over the small end, so the full card stays anchored at the navbar line).
  const morphY = useTransform(openP, [0, 0.5], [-PILL_RISE_PX, 0]);
  // Card opacity — DIRECTIONAL. On OPEN it stays 1 (opaque) so the growing
  // capsule covers the pill/slip behind it (otherwise a symmetric crossfade
  // would let the bet slip show THROUGH the card as it fades in). On CLOSE it's
  // driven down from openP (see the effect) so the real pill's CONTENT is
  // revealed as the capsule fades — the "empty pill" fix.
  const cardOpacity = useMotionValue(1);
  // Squash-&-stretch pulse (scale), applied on the wrapper on close.
  const scaleX = useMotionValue(1);
  const scaleY = useMotionValue(1);

  // Swipe-down drives the shrink-morph directly (openP follows the finger 1:1),
  // so the card shrinks in place toward the pill — it does NOT translate like a
  // bottom sheet. Raw pointer events (useVerticalSwipe) rather than Framer's
  // drag, which failed to grab the touch gesture on real mobile browsers. The
  // swipe never fires from the scrollable list, the swipe thumb, or the header
  // buttons — those are excluded (buttons + [data-scroll]).
  const swipe = useVerticalSwipe({
    onMove: (dy) => {
      const range = Math.max(1, fullH.get() - START_H);
      openP.set(dy > 0 ? Math.max(0, 1 - dy / range) : 1);
    },
    onEnd: (dy, vy) => {
      // Past the threshold → commit the close (the unmount spring finishes the
      // shrink into the pill); otherwise spring the morph back open.
      if (dy > CLOSE_OFFSET_PX || vy > CLOSE_VELOCITY) {
        onClose();
      } else {
        animate(openP, 1, OPEN_SPRING);
      }
    },
  });

  return (
    <motion.div
      className="absolute inset-0 z-50"
      style={{
        fontFamily: "'Red Hat Display', sans-serif",
        // While OPEN, follow `overlayPE`. The MOMENT close is committed
        // (isPresent → false), force the WHOLE overlay click-through so it can
        // never keep blocking the home feed during/after the close animation.
        // Pairs with the 600ms safeToRemove fallback (guaranteed unmount).
        pointerEvents: isPresent ? overlayPE : 'none',
      }}
    >
      {/* Dim backdrop — covers the navbar + feed behind the floating card, but
          FADES to transparent across the app-header band (top ~88px) so the
          header is never dimmed while the card is open. */}
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: backdropOpacity,
          background: `linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) ${HEADER_UNDIM_PX}px, rgba(0,0,0,0.7) ${HEADER_UNDIM_PX + 20}px, rgba(0,0,0,0.7) 100%)`,
        }}
        onClick={onClose}
        aria-hidden
      />

      {/* POSITIONING FRAME — bottom-anchored between the header cap and the
          navbar line; the card is pushed to the bottom (justify-end) and grows
          upward as selections are added, never past TOP_INSET_PX. */}
      <div
        className="pointer-events-none absolute left-4 right-4 flex flex-col justify-end"
        style={{
          top: TOP_INSET_PX,
          bottom: 0,
          paddingBottom: `calc(env(safe-area-inset-bottom) + ${BOTTOM_GAP_PX}px)`,
        }}
      >
      {/* POSITION-MORPH WRAPPER — translates the card up to the pill's line as
          it shrinks (`morphY`), so the capsule lands ON the pill, not the navbar.
          Also carries the close squash pulse (`scaleX`/`scaleY`, anchored bottom)
          and the pill↔card cross-fade (`cardOpacity`, which reveals the real
          pill's content on close so it never looks empty). Kept separate from
          the draggable card so the drag (which drives openP) never fights it. */}
      <motion.div
        className="pointer-events-none flex max-h-full w-full flex-col"
        style={{
          y: morphY,
          scaleX,
          scaleY,
          opacity: cardOpacity,
          transformOrigin: 'bottom center',
        }}
      >
      {/* FLOATING CARD — content-height, capped at the frame (max-h-full). The
          glass box GROWS out of / shrinks into the slip footprint via `clipPath`
          (bottom-up reveal). It never TRANSLATES: swipe-down drives the shrink
          via `onCloseDragMove` (so the card shrinks in place with the finger,
          not a bottom-sheet slide). Its FILL + BORDER cross-fade between the dark
          card look (full) and the purple pill look (capsule) so it clearly reads
          as the same pill — not the dark navbar behind it. */}
      <motion.div
        ref={cardRef}
        className="pointer-events-auto relative max-h-full w-full overflow-hidden rounded-[28px] border"
        style={{
          clipPath,
          borderColor,
          // `none` so the browser doesn't scroll-steal the swipe-down — the raw
          // pointer handlers (useVerticalSwipe) drive the close. The scroll
          // list, swipe thumb, and buttons are excluded from the swipe; the
          // list re-enables vertical panning with `pan-y` (below).
          touchAction: 'none',
        }}
        onPointerDown={swipe.onPointerDown}
        onPointerMove={swipe.onPointerMove}
        onPointerUp={swipe.onPointerUp}
        onPointerCancel={swipe.onPointerCancel}
      >
      {/* FILL — purple pill base (always on) with the dark card fill crossfading
          over it by `cardDarkOpacity`: full card = dark, capsule = purple. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: PILL_BG }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: SHEET_BG, opacity: cardDarkOpacity }}
        aria-hidden
      />
      {/* CONTENT — crossfades in as the card grows (kept separate from the card
          fill so the capsule itself stays solid during the reveal). */}
      <motion.div
        className="relative flex max-h-full w-full flex-col"
        style={{ opacity: contentOpacity }}
      >
        {/* HANDLE — same grabber as the summarized slip; signals swipe-down to
            close. Part of the drag-to-close chrome (not a button/scroll area). */}
        <div className="flex shrink-0 items-center justify-center px-3 pt-3 pb-2">
          <div className="h-1 w-8 rounded-full bg-[rgba(251,251,251,0.32)]" />
        </div>

        {/* HEADER — (delete-all trash omitted) · title + count · × */}
        <div className="relative flex h-14 shrink-0 items-center border-b border-[rgba(240,242,244,0.08)]">
          {/* Delete-all (trash). */}
          <div className="flex w-12 shrink-0 pl-1">
            <button
              type="button"
              aria-label="Vaciar entrada"
              onClick={onClearAll}
              onPointerDownCapture={(e) => e.stopPropagation()}
              className="flex size-10 items-center justify-center rounded-full active:scale-95"
            >
              <img src={trashIcon} alt="" className="size-5" />
            </button>
          </div>
          <div className="flex min-w-px flex-1 flex-col items-center justify-center px-3">
            <div className="flex items-center justify-center gap-1">
              <p className="text-[14px] font-bold leading-[21px] text-[#f0f2f4]">
                Resumen de tu entrada
              </p>
              <div className="flex h-4 min-w-[20px] items-center justify-center rounded-[14px] bg-[rgba(251,251,251,0.16)] px-1">
                <span className="text-[12px] font-bold leading-[18px] text-[#f0f2f4]">
                  {selections.length}
                </span>
              </div>
            </div>
            <p className="w-full text-center text-[12px] font-medium leading-4 text-[rgba(251,251,251,0.5)]">
              Balance disponible: $250.00
            </p>
          </div>
          <div className="flex w-12 shrink-0 justify-end pr-1">
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              onPointerDownCapture={(e) => e.stopPropagation()}
              className="flex size-10 items-center justify-center rounded-full active:scale-95"
            >
              <img src={closeIcon} alt="" className="size-5" />
            </button>
          </div>
        </div>

        {/* CONTENT — scrollable selections (data-scroll: excluded from the
            sheet close-drag so it scrolls normally). */}
        <div
          data-scroll
          className="no-scrollbar relative min-h-px flex-1 overflow-y-auto"
          // The card sets touch-action:none for the close-drag; re-enable
          // vertical touch-scrolling HERE so the selections list still scrolls
          // on mobile.
          style={{ touchAction: 'pan-y' }}
        >
          {/* SELECTIONS — shared SGP-grouped list (same-match picks collapse into
              an SGP block; different matches stay standalone rows, each unit
              divided from the next). */}
          <SelectionGroups
            selections={orderedSelections}
            onRemove={onRemove}
            onRemoveGroup={onRemoveGroup}
          />
        </div>

        {/* FOOTER — Monto / Momio / Ganancia + swipe to play. */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-[rgba(251,251,251,0.16)] px-[10px] pb-2 pt-[10px]">
          <div className="flex h-[59px] items-center gap-2">
            {/* Monto — tap to open the numeric keypad. */}
            <div className="relative flex min-w-px flex-1 flex-col items-center pt-[11px]">
              <button
                type="button"
                onClick={keypad.openKeypad}
                className={`flex h-12 w-full items-center gap-2 overflow-hidden rounded-[12px] border p-3 text-left active:opacity-80 ${
                  keypad.open
                    ? 'border-[#fbfbfb]'
                    : 'border-[rgba(251,251,251,0.16)]'
                }`}
              >
                <img src={editIcon} alt="" className="size-3.5" />
                <p className="min-w-px flex-1 text-[16px] font-medium leading-6 text-[#fbfbfb]">
                  ${keypad.displayText}
                  {keypad.open && (
                    <span
                      aria-hidden
                      className="ml-px inline-block h-[1em] w-[2px] animate-[caretBlink_1s_step-end_infinite] bg-current align-middle"
                    />
                  )}
                </p>
              </button>
              <div className="absolute left-2 top-0 flex items-center rounded-[4px] bg-[#121212] px-1.5 py-0.5">
                <span className="text-[14px] font-medium leading-[21px] text-[rgba(251,251,251,0.5)]">
                  Monto
                </span>
              </div>
            </div>
            {/* Momio */}
            <div className="flex min-w-px flex-1 flex-col items-center justify-center py-0.5">
              <span className="text-[14px] font-medium leading-[21px] text-[rgba(251,251,251,0.5)]">
                Momio
              </span>
              <span className="text-[14px] font-black leading-[21px] text-[#fbfbfb]">
                {fmtOdds(cumulativeOdds)}
              </span>
            </div>
            {/* Ganancia */}
            <div className="relative flex min-w-px flex-1 flex-col items-center pt-[11px]">
              <div className="flex h-12 w-full items-center justify-center overflow-hidden rounded-[12px] border border-[rgba(251,251,251,0.12)] p-3">
                <p className="text-[16px] font-bold leading-6 text-[#fbbf24]">
                  ${potentialWin}
                </p>
              </div>
              <div className="absolute left-2 top-0 flex items-center rounded-[4px] bg-[#121212] px-1.5 py-0.5">
                <span className="text-[14px] font-medium leading-[21px] text-[rgba(251,251,251,0.5)]">
                  Ganancia
                </span>
              </div>
            </div>
          </div>

          {/* Promos — free bet + Booster. Toggles are CSS controls; the
              countdown clock glyph is still pending its asset. */}
          <div className="flex flex-col overflow-hidden rounded-[16px] border border-[rgba(251,251,251,0.16)]">
            {/* Free bet (disabled toggle) */}
            <div className="flex items-center gap-2 px-3 py-2">
              <div
                className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[12px] p-1"
                style={{
                  backgroundImage:
                    'linear-gradient(140.5deg, #f0abfc 0%, #6b47ff 100%)',
                }}
              >
                <img src={freebetIllus} alt="" className="size-7 object-contain" />
              </div>
              <div className="flex min-w-px flex-1 flex-col">
                <span className="text-[14px] font-bold leading-[21px] text-[#fbfbfb]">
                  Apuesta gratis
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex h-5 items-center gap-1 rounded-[12px] bg-[rgba(251,251,251,0.12)] px-1">
                    <img src={clockIcon} alt="" className="size-3" />
                    <span className="text-[12px] font-medium leading-4 text-[#fbfbfb]">
                      29d<span className="text-[rgba(251,251,251,0.7)]">:</span>23h
                    </span>
                  </div>
                  <div className="h-4 w-px bg-[rgba(251,251,251,0.16)]" />
                  <div className="flex items-center gap-1 text-[14px]">
                    <span className="font-medium text-[rgba(251,251,251,0.5)]">
                      Monto:
                    </span>
                    <span className="font-bold text-[rgba(251,251,251,0.7)]">$25</span>
                  </div>
                </div>
              </div>
              {/* toggle — off + disabled */}
              <div className="flex h-8 w-[52px] shrink-0 items-center rounded-full bg-[rgba(251,251,251,0.16)] px-1 opacity-40">
                <div className="size-6 rounded-full bg-white" />
              </div>
            </div>

            <div className="mx-3 h-px bg-[rgba(251,251,251,0.16)]" />

            {/* Booster */}
            <div className="flex items-center gap-2 px-3 py-2">
              <div
                className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[12px] p-1"
                style={{
                  backgroundImage:
                    'linear-gradient(50deg, #ffa65b 0%, #f0abfc 100%)',
                }}
              >
                <img src={boosterIllus} alt="" className="size-7 object-contain" />
              </div>
              <div className="flex min-w-px flex-1 flex-col">
                <div className="flex items-center gap-0.5">
                  <span className="text-[14px] font-bold leading-[21px] text-[#fbfbfb]">
                    Booster 20%
                  </span>
                  <img
                    src={chevronRightIcon}
                    alt=""
                    className="size-[18px] rotate-90 opacity-70"
                  />
                </div>
                <div className="flex h-5 items-center gap-1 self-start rounded-[12px] bg-[rgba(251,251,251,0.12)] px-1">
                  <img src={clockIcon} alt="" className="size-3" />
                  <span className="text-[12px] font-medium leading-4 text-[#fbfbfb]">
                    23h<span className="text-[rgba(251,251,251,0.7)]">:</span>23m
                    <span className="text-[rgba(251,251,251,0.7)]">:</span>23s
                  </span>
                </div>
              </div>
              {/* toggle — off */}
              <div className="flex h-8 w-[52px] shrink-0 items-center rounded-full bg-[rgba(251,251,251,0.16)] px-1">
                <div className="size-6 rounded-full bg-white" />
              </div>
            </div>
          </div>

          {/* Accept odds changes — CSS checkbox. */}
          <button
            type="button"
            onPointerDownCapture={(e) => e.stopPropagation()}
            className="flex items-center gap-3 px-3.5 active:opacity-70"
          >
            <div className="size-5 shrink-0 rounded-[6px] border-2 border-[rgba(251,251,251,0.3)]" />
            <p className="text-left text-[14px] font-medium leading-[21px] text-[rgba(251,251,251,0.7)]">
              Acepta siempre el cambio de momios.{' '}
              <span className="underline">Más info.</span>
            </p>
          </button>

          {/* Swipe to play — shared component (same as the summarized slip),
              at 44px height. `data-scroll` keeps the sheet close-drag from
              starting here WITHOUT stopping the pointerdown from reaching the
              swipe thumb (which owns the horizontal drag gesture). */}
          <div data-scroll>
            <SwipeToConfirm
              stake={keypad.displayValue}
              onConfirm={onConfirm}
              heightPx={44}
            />
          </div>
        </div>

        {/* NUMERIC KEYPAD — a spring-driven `shrink-0` slot below the footer.
            Its height grows to the keypad when open, shrinking the (flex-1)
            selections list at max card height or growing the card when there's
            room. Always mounted (height 0 when closed) + clipped, so it doesn't
            rely on a mount animation. `data-scroll` keeps the card's close-drag
            from starting on it. */}
        <motion.div
          data-scroll
          className="w-full shrink-0 overflow-hidden"
          style={{ height: keypadHeight, touchAction: 'pan-y' }}
          aria-hidden={!keypad.open}
        >
          <div className="border-t border-[rgba(251,251,251,0.12)]">
            <AmountKeypad
              onDigit={keypad.pressDigit}
              onDelete={keypad.pressDelete}
              onDone={keypad.done}
              onSwipeDown={onClose}
            />
          </div>
        </motion.div>
      </motion.div>
      </motion.div>
      </motion.div>
      </div>
    </motion.div>
  );
}
