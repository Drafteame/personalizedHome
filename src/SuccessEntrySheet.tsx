import {
  animate,
  motion,
  useMotionValue,
  usePresence,
  useTransform,
} from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useVerticalSwipe } from './useVerticalSwipe';
import logoDraftea from './assets/logo-draftea.svg';
import reuseIcon from './assets/reuse.svg';
import shareIcon from './assets/share.svg';
import successIllustration from './assets/success-illustration.svg';
import ticketHeaderBg from './assets/ticket-header-bg.svg';
import { SelectionGroups } from './SelectionGroups';
import type { Selection } from './types';

/**
 * SuccessEntrySheet — the "¡Entrada creada!" confirmation card (Figma
 * `profileBottomSheet` 33938:331674).
 *
 * Shown after a successful swipe-to-confirm (from the summarized bet slip OR
 * the "Resumen" floating card) — it REPLACES the old flying-ticket success
 * animation for those two flows (lightning long-press still uses the ticket).
 *
 * A bottom-anchored floating card that reuses the EXACT pill↔card morph from
 * BetSlipFullSheet: an `openP` motion value drives a bottom-up clip-path reveal
 * (from a `START_H` pill-sized capsule up to the measured full height) plus a
 * content + backdrop crossfade and a fill/border morph to the purple pill at
 * the small end — so summarized slip → pill → this card all read as ONE surface
 * changing shape. Close reverses `openP` to 0 (shrinks back into the pill).
 *
 * Content: green success glow, handle, header (green check illustration +
 * "¡ENTRADA CREADA!" + ganancia / entrada / momio), a DRAFTEA divider, the
 * placed selections list (scrolls internally when capped below the header), and
 * the action buttons — Compartir (primary), then Reusar + Entrada nueva.
 *
 * Actions:
 *   • Entrada nueva / swipe-down / backdrop-tap → close + return Home (onNewEntry).
 *   • Reusar → close but keep the selections so a fresh slip rebuilds (onReuse).
 *   • Compartir → visual only for now.
 */

const fmtOdds = (n: number) => `${n.toFixed(2)}x`;

const CLOSE_OFFSET_PX = 120;
const CLOSE_VELOCITY = 550;
// Same open/close morph as BetSlipFullSheet — the card GROWS out of the
// bet-slip footprint (bottom-up clip-path reveal) rather than sliding in.
const OPEN_SPRING = { type: 'spring', stiffness: 340, damping: 36 } as const;
const CLOSE_PULSE_SCALE_X = 1.03;
const CLOSE_PULSE_SCALE_Y = 0.95;
const PULSE_SPRING = { type: 'spring', stiffness: 300, damping: 16 } as const;
// Reveal starts at the collapsed-pill capsule height (matches BetSlipSheet's
// COLLAPSED_GLASS_H) so the card appears to grow straight out of the pill.
const START_H = 56;
// The card sits at the navbar line; the pill sits ~this many px higher. As the
// card shrinks to the capsule it rises by this much to land ON the pill.
const PILL_RISE_PX = 62;
// The app header (sticky topbar: the logo/balance bar, ~44px now that the
// simulated status bar is gone) must stay visible — the card can never grow
// past this line. Only bounds MAX height; small cards stay bottom-anchored.
const TOP_INSET_PX = 52;
// Bottom gap so the card's lower edge lines up with the navbar.
const BOTTOM_GAP_PX = 16;
// Max card height — 470px, but never more than half the screen on shorter
// devices. Content shorter than this stays content-height (bottom-anchored);
// taller entries hit the cap and scroll the selections list internally.
const MAX_CARD_H = 'min(470px, 50dvh)';
// Overlay stays transparent across this top band (the ~44px app header) so the
// header is never dimmed, then ramps to full scrim just below it.
const HEADER_UNDIM_PX = 44;

// Full-card fill/border (dark) ↔ purple pill (capsule) — identical to
// BetSlipFullSheet so the shrunk capsule reads as the same purple bet-slip pill.
const SHEET_BG = 'linear-gradient(to bottom, #191919 0%, #0f0f0f 100%)';
const CARD_BORDER = 'rgba(251,251,251,0.12)';
const PILL_BG = 'linear-gradient(64.6deg, #14083d 0%, #230c3e 100%)';
const PILL_BORDER = '#4b20ff';

// Ticket-stub outline (Figma `_strokeTicket` 33938:331683) — a subtle stroke
// with rounded TOP corners and two inward semicircular notches on the
// left/right edges at the DRAFTEA divider line. Per Figma the outline is OPEN
// at the bottom: NO bottom edge and NO bottom corners — the left and right
// sides run straight down and FADE OUT to transparent toward the bottom (Figma
// masks the tall stroke with a bottom "Fade" gradient). Drawn as a MEASURED
// vector (viewBox = live px size) so the top corners stay crisp and the notches
// stay round at any card height, with a vertical gradient stroke for the fade.
// `notchY` is the divider's center, measured relative to the outline's top.
const TICKET_CORNER = 22; // top corner radius
const NOTCH_DEPTH = 9; // how far each notch bites inward (horizontal radius)
const NOTCH_HALF_H = 11; // half the notch height (vertical radius)
const STROKE_WIDTH = 4; // ticket outline stroke weight
const STROKE_INSET = STROKE_WIDTH / 2; // half the stroke, so it isn't clipped
const STROKE_BASE_ALPHA = 0.18; // border opacity at full strength
// Vertical fade: the sides hold full strength until this many px from the
// bottom, then ramp to transparent right at the bottom edge (matches Figma's
// ~78px bottom "Fade" band). A fixed distance keeps the fade looking the same
// regardless of how tall the card grows.
const STROKE_FADE_PX = 90;

// Dashed tear-line for the header/selections divider — dash 10px, gap 10px.
// Tailwind's border-dashed can't set dash/gap length, so draw it with a
// horizontal repeating gradient.
const DASH_LINE = {
  backgroundImage:
    'repeating-linear-gradient(to right, rgba(251,251,251,0.32) 0, rgba(251,251,251,0.32) 10px, transparent 10px, transparent 20px)',
};

function TicketOutline({ notchY }: { notchY: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const p = STROKE_INSET;
  const r = TICKET_CORNER;
  const nd = NOTCH_DEPTH;
  const nh = NOTCH_HALF_H;
  // Guard against the pre-measure (0×0) frame and a notch too close to the top
  // corner. No bottom clamp — the outline is open at the bottom now.
  const ny = Math.min(Math.max(notchY, r + nh), Math.max(r + nh, h - nh));
  // Fade-start as a gradient offset: full strength until STROKE_FADE_PX from
  // the bottom, then ramp to transparent at the bottom edge. Never below the
  // notch line, so the top/notch region always stays solid.
  const fadeStart =
    h > 0 ? Math.min(1, Math.max((ny + nh) / h, (h - STROKE_FADE_PX) / h)) : 0.6;
  // OPEN path — no bottom edge, no bottom corners. Start at the bottom-left
  // (open), run UP the left side (through the left notch), around the two
  // rounded TOP corners, then DOWN the right side (through the right notch) to
  // the bottom-right (open). Both notches bulge INWARD as concave half-ellipses.
  const d =
    w > 0 && h > 0
      ? [
          `M ${p} ${h}`, // bottom-left, open
          `V ${ny + nh}`,
          `A ${nd} ${nh} 0 0 0 ${p} ${ny - nh}`, // left notch (inward)
          `V ${r}`,
          `A ${r} ${r} 0 0 1 ${r} ${p}`, // top-left corner
          `H ${w - r}`, // top edge
          `A ${r} ${r} 0 0 1 ${w - p} ${r}`, // top-right corner
          `V ${ny - nh}`,
          `A ${nd} ${nh} 0 0 0 ${w - p} ${ny + nh}`, // right notch (inward)
          `V ${h}`, // right side down to bottom, open
        ].join(' ')
      : '';

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden>
      {d && (
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${w} ${h}`}
          fill="none"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient
              id="ticketBorderFade"
              gradientUnits="userSpaceOnUse"
              x1={0}
              y1={0}
              x2={0}
              y2={h}
            >
              <stop offset="0" stopColor="#fbfbfb" stopOpacity={STROKE_BASE_ALPHA} />
              <stop
                offset={fadeStart}
                stopColor="#fbfbfb"
                stopOpacity={STROKE_BASE_ALPHA}
              />
              <stop offset="1" stopColor="#fbfbfb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path
            d={d}
            stroke="url(#ticketBorderFade)"
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  );
}

type Props = {
  selections: Selection[];
  cumulativeOdds: number;
  /** Placed entry amount (shared stake from App). */
  stake: number;
  /** Entrada nueva / swipe-down / backdrop — close and return Home. */
  onNewEntry: () => void;
  /** Reusar — close but keep the selections so the slip rebuilds. */
  onReuse: () => void;
  /** Compartir — visual only for now. */
  onShare?: () => void;
};

export function SuccessEntrySheet({
  selections,
  cumulativeOdds,
  stake,
  onNewEntry,
  onReuse,
  onShare,
}: Props) {
  const potentialWin = Math.round(cumulativeOdds * stake);
  const orderedSelections = [...selections].reverse(); // latest first

  // SHAPE MORPH — the card grows out of the slip footprint on open and shrinks
  // back into it on close (never slides). `openP` (1 = full card, 0 = pill-sized
  // capsule) drives a clip-path reveal + content/backdrop crossfade both ways.
  const [isPresent, safeToRemove] = usePresence();
  const openP = useMotionValue(0);

  // Resting card height (content height, capped at the frame), measured so the
  // clip reveal knows how far to open; re-measured as selections change.
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

  // Squash-&-stretch pulse (scale), applied on the wrapper on close.
  const scaleX = useMotionValue(1);
  const scaleY = useMotionValue(1);

  // Ticket-outline notch position — the DRAFTEA divider's vertical center,
  // measured relative to the ticket region's top (header + divider are fixed,
  // only the selections list below scrolls, so this stays stable).
  const ticketRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const [notchY, setNotchY] = useState(120);
  useLayoutEffect(() => {
    const ticket = ticketRef.current;
    const divider = dividerRef.current;
    if (!ticket || !divider) return;
    const measure = () =>
      setNotchY(divider.offsetTop + divider.offsetHeight / 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(ticket);
    ro.observe(divider);
    return () => ro.disconnect();
  }, []);

  // Bottom scroll-fade — shown when the (capped) selections list still has
  // content below the fold, hinting it can be scrolled. Recomputed on scroll,
  // on resize, and whenever the selection count changes.
  const listRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);
  const updateFade = () => {
    const el = listRef.current;
    if (!el) return;
    setShowFade(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };
  useLayoutEffect(() => {
    updateFade();
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedSelections.length]);

  useEffect(() => {
    if (isPresent) {
      const a = animate(openP, 1, OPEN_SPRING);
      return () => a.stop();
    }
    // Reverse the morph on the SAME spring so the card settles down into the
    // pill (never a fast slide-away), then unmount, with a subtle squash pulse.
    scaleX.set(CLOSE_PULSE_SCALE_X);
    scaleY.set(CLOSE_PULSE_SCALE_Y);
    const px = animate(scaleX, 1, PULSE_SPRING);
    const py = animate(scaleY, 1, PULSE_SPRING);
    const a = animate(openP, 0, OPEN_SPRING);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      safeToRemove?.();
    };
    a.then(finish);
    // Safety net — force the unmount even if the spring's completion callback
    // never fires (interrupted animation, handoff, etc.), so the overlay can
    // never get stuck mounted and blocking the home feed.
    const fallback = window.setTimeout(finish, 600);
    return () => {
      done = true;
      a.stop();
      px.stop();
      py.stop();
      window.clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPresent]);

  // Bottom-up clip reveal + crossfades (identical to BetSlipFullSheet).
  const clipPath = useTransform([openP, fullH], ([p, h]: number[]) => {
    const top = Math.max(0, (h - START_H) * (1 - p));
    return `inset(${top}px 0px 0px 0px round 28px)`;
  });
  const contentOpacity = useTransform(openP, [0.2, 0.8], [0, 1]);
  const backdropOpacity = useTransform(openP, [0, 1], [0, 1]);
  // The ENTIRE overlay (backdrop + frame + card + gesture layer) becomes
  // click-through the instant the card is closed, so even if this component
  // lingers mounted for any reason it can never block the home feed underneath.
  const overlayPE = useTransform(openP, (v) => (v < 0.05 ? 'none' : 'auto'));
  const cardDarkOpacity = useTransform(openP, [0.15, 0.55], [0, 1]);
  const borderColor = useTransform(openP, [0.15, 0.55], [PILL_BORDER, CARD_BORDER]);
  const morphY = useTransform(openP, [0, 0.5], [-PILL_RISE_PX, 0]);
  const cardOpacity = useTransform(openP, [0, 0.12], [0, 1]);

  // Swipe-down drives the shrink-morph directly (openP follows the finger 1:1).
  // Raw pointer events (via useVerticalSwipe) rather than Framer's drag, which
  // failed to grab the touch gesture on real mobile browsers.
  const swipe = useVerticalSwipe({
    onMove: (dy) => {
      const range = Math.max(1, fullH.get() - START_H);
      openP.set(dy > 0 ? Math.max(0, 1 - dy / range) : 1);
    },
    onEnd: (dy, vy) => {
      if (dy > CLOSE_OFFSET_PX || vy > CLOSE_VELOCITY) {
        onNewEntry(); // dismiss = done → Home
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
        // While OPEN, follow `overlayPE` (interactive once the card is on
        // screen). The MOMENT dismissal is committed (isPresent → false, from
        // swipe-down / backdrop-tap / a button), force the WHOLE overlay
        // click-through — so during the close animation, and even if this
        // component were to linger mounted for any reason, it can never keep
        // blocking the home feed underneath. Pairs with the 600ms safeToRemove
        // fallback below (guaranteed unmount).
        pointerEvents: isPresent ? overlayPE : 'none',
      }}
    >
      {/* Dim backdrop — leaves the app-header band undimmed. Tap = done → Home. */}
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: backdropOpacity,
          background: `linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) ${HEADER_UNDIM_PX}px, rgba(0,0,0,0.7) ${HEADER_UNDIM_PX + 20}px, rgba(0,0,0,0.7) 100%)`,
        }}
        onClick={onNewEntry}
        aria-hidden
      />

      {/* POSITIONING FRAME — bottom-anchored between the header cap and navbar.
          `pointer-events-none` so taps on the empty dim area AROUND the card fall
          through to the backdrop below (which dismisses = returns Home); without
          it this full-size frame would swallow every backdrop tap and the sheet
          could never be closed by tapping outside — leaving it open and blocking
          the home feed. The card itself re-enables pointer events (below). */}
      <div
        className="pointer-events-none absolute left-4 right-4 flex flex-col justify-end"
        style={{
          top: TOP_INSET_PX,
          bottom: 0,
          paddingBottom: `calc(env(safe-area-inset-bottom) + ${BOTTOM_GAP_PX}px)`,
        }}
      >
        {/* POSITION-MORPH WRAPPER — lifts the card to the pill line as it shrinks,
            carries the close squash pulse + the pill↔card cross-fade. Height is
            content-adaptive but capped at MAX_CARD_H (470px, or half the screen
            on shorter devices) — past that the selections list scrolls.
            `pointer-events-auto` re-enables interaction on the card itself (the
            frame above is click-through). */}
        <motion.div
          className="pointer-events-none flex w-full flex-col"
          style={{
            maxHeight: MAX_CARD_H,
            y: morphY,
            scaleX,
            scaleY,
            opacity: cardOpacity,
            transformOrigin: 'bottom center',
          }}
        >
          {/* FLOATING CARD — content-height, capped at the frame. Grows out of /
              shrinks into the slip footprint via `clipPath`; never translates.
              `pointer-events-auto` lives HERE (not the wrapper) so the touch hit
              area is clipped along with the visual — once the card shrinks/closes
              it stops catching touches over the old (tall) footprint. */}
          <motion.div
            ref={cardRef}
            className="pointer-events-auto relative max-h-full w-full overflow-hidden rounded-[28px] border"
            style={{
              clipPath,
              borderColor,
              // The card opts back into hit testing inside pointer-free
              // positioning wrappers. Disable that override immediately on
              // exit so the invisible/shrinking confirmation card cannot
              // intercept taps intended for the bet-slip pill underneath.
              pointerEvents: isPresent ? 'auto' : 'none',
              // `none` so the browser doesn't scroll-steal the swipe-down — the
              // raw pointer handlers (useVerticalSwipe) drive the close. Buttons
              // and the scrollable selections list are excluded from the swipe
              // (see useVerticalSwipe's default `exclude`), and that list
              // re-enables vertical panning with `pan-y` (below).
              touchAction: 'none',
            }}
            onPointerDown={swipe.onPointerDown}
            onPointerMove={swipe.onPointerMove}
            onPointerUp={swipe.onPointerUp}
            onPointerCancel={swipe.onPointerCancel}
          >
            {/* FILL — purple pill base with the dark card fill crossfading over. */}
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

            {/* CONTENT — crossfades in as the card grows. The 16px general
                padding (px-4) applies to everything inside; the ticket outline
                and the buttons all align to it. */}
            <motion.div
              className="relative flex max-h-full w-full flex-col px-4"
              style={{ opacity: contentOpacity }}
            >
              {/* Green success glow across the top edge — spans the full card
                  width (bleeds past the 16px padding to the card edges). */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-x-4 top-0 h-[100px] opacity-[0.32] blur-[50px]"
                style={{ backgroundColor: '#34d399' }}
              />

              {/* DRAFTEA watermark (Figma 33938:331677) — faint repeated logotype
                  behind the header. Centered, bleeds past the card edges (clipped
                  by the card's overflow-hidden). */}
              <img
                src={ticketHeaderBg}
                alt=""
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-[14px] w-[414px] max-w-none -translate-x-1/2"
              />

              {/* HANDLE — swipe-down chrome (dismiss = done). */}
              <div className="relative flex shrink-0 items-center justify-center px-3 pt-3 pb-2">
                <div className="h-1 w-8 rounded-full bg-[rgba(251,251,251,0.32)]" />
              </div>

              {/* TICKET — header + divider + selections framed by the notched
                  ticket-stub outline. The outline spans this region and never
                  scrolls (the list inside it does). */}
              <div
                ref={ticketRef}
                className="relative flex min-h-px flex-1 flex-col"
              >
                <TicketOutline notchY={notchY} />
              {/* HEADER — title + ganancia / entrada / momio + green check. */}
              <div className="relative flex shrink-0 items-center gap-1 px-3 pb-2 pt-1">
                <div className="flex min-w-px flex-1 flex-col gap-0.5 py-2">
                  <p className="text-[18px] font-black italic leading-[27px] text-[#fbfbfb]">
                    ¡ENTRADA CREADA!
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="text-[16px] font-bold leading-6 text-[#fbfbfb]">
                      $
                    </span>
                    <span className="text-[18px] font-black leading-[27px] text-[#fbfbfb]">
                      {potentialWin}
                    </span>
                    <span className="text-[14px] font-normal leading-[21px] text-[rgba(251,251,251,0.5)]">
                      Ganancia potencial
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 text-[14px] font-normal leading-[21px] text-[rgba(251,251,251,0.5)]">
                    <span className="whitespace-nowrap">Entrada: ${stake}</span>
                    <span className="whitespace-nowrap">Momio: {fmtOdds(cumulativeOdds)}</span>
                  </div>
                </div>
                <img
                  src={successIllustration}
                  alt=""
                  className="size-[72px] shrink-0"
                  aria-hidden
                />
              </div>

              {/* DRAFTEA divider — logo flanked by two hairlines. The notch
                  line of the ticket outline is centered on this row. */}
              <div
                ref={dividerRef}
                className="relative flex h-[30px] shrink-0 items-center justify-center gap-3 px-3"
              >
                <div className="h-px min-w-px flex-1" style={DASH_LINE} />
                <img src={logoDraftea} alt="Draftea" className="h-4 opacity-60" />
                <div className="h-px min-w-px flex-1" style={DASH_LINE} />
              </div>

              {/* SELECTIONS — scrolls internally when the card is capped. */}
              <div
                ref={listRef}
                data-scroll
                onScroll={updateFade}
                className="no-scrollbar relative min-h-px flex-1 overflow-y-auto px-3"
                // The card sets touch-action:none for the close-drag; re-enable
                // vertical touch-scrolling HERE so the (capped) selections list
                // still scrolls on mobile when there are enough selections.
                style={{ touchAction: 'pan-y' }}
              >
                {/* SELECTIONS — shared SGP-grouped list, read-only (no × / group
                    removal in the confirmation view). Same-match picks collapse
                    into an SGP block; each unit is divided from the next. */}
                <SelectionGroups selections={orderedSelections} />
              </div>
              {/* SCROLL FADE — gradient to the ticket bg at the bottom of the
                  selections list, shown only when there's more content below. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-10 rounded-b-[20px] transition-opacity duration-200"
                style={{
                  opacity: showFade ? 1 : 0,
                  backgroundImage:
                    'linear-gradient(to bottom, rgba(15,15,15,0) 0%, #0f0f0f 100%)',
                }}
              />
              </div>
              {/* /TICKET */}

              {/* BUTTONS — Compartir + Reusar, side by side. (Returning Home is
                  handled by swipe-down / backdrop-tap → onNewEntry.) 12px gap
                  above, between the ticket and the buttons. */}
              <div className="flex shrink-0 items-stretch gap-2 pb-4 pt-3">
                <button
                  type="button"
                  onClick={onShare}
                  className="flex h-12 min-w-px flex-1 items-center justify-center gap-2 rounded-[12px] active:scale-[0.99]"
                  style={{
                    backgroundImage:
                      'linear-gradient(29.5deg, #4b20ff 0%, #9730ff 100%)',
                  }}
                >
                  <img src={shareIcon} alt="" className="size-4" />
                  <span className="text-[16px] font-bold leading-6 text-[#fbfbfb]">
                    Compartir
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onReuse}
                  className="flex h-12 min-w-px flex-1 items-center justify-center gap-2 rounded-[12px] bg-[rgba(251,251,251,0.12)] active:scale-[0.99]"
                >
                  <img src={reuseIcon} alt="" className="size-4" />
                  <span className="text-[16px] font-bold leading-6 text-[#fbfbfb]">
                    Reusar
                  </span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
