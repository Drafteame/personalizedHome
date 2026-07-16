import {
  animate,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
  type MotionValue,
} from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import checkIcon from './assets/success-check.png';

/**
 * EntryCreatedOverlay — the success confirmation animation.
 *
 * ONE shape for every success flow (swipe-to-confirm on the expanded slip,
 * swipe-to-play on the "Resumen de tu entrada" full sheet, AND the lightning
 * long-press): a green ticket/stub (Figma 33822:171080 — 233×108, rounded
 * corners + a semicircular notch on the mid-left/right edges, radial-green
 * fill, gradient rim, green glow). The old full-width green card is gone.
 *
 *   1. The ticket emerges where the slip was — a circular clip-path reveal
 *      from its center (keyframes `greenCircleIn` / `greenContentIn` in
 *      index.css), check + text scaling in with it — and holds.
 *   2. On reveal-complete it fires a green spark burst + a squash/stretch pop
 *      + a glow flash, then performs a genie flight straight into the "Mis
 *      entradas" tab — velocity/position-derived squash & stretch, a base
 *      shrink envelope, rotation from x-velocity, driven by two springs
 *      launched together (no anticipation). No keyframes.
 *   3. The ticket fades out over its last few px of travel so it is fully
 *      gone `vanish.gapPx` above the tab — never overlapping it. onCatch()
 *      fires at that vanish moment (tab icon bumps to "catch" it); onDone()
 *      follows `doneDelayMs` later (app then pops the badge + "¿Reusar?").
 *
 * Flight timing lives in `cfg`; entrance timing in the index.css keyframes.
 */

const cfg = {
  // How long the ticket holds in place before the genie flight. Kept SHORT so
  // the whole thing reads as a brief microinteraction (the success card the
  // user just closed already delivered the "entry created" message) rather
  // than a primary status screen — a quick glance, then it flies to the tab.
  confirmedHoldMs: 600,
  // Absolute lifecycle guard. Spring completion can be delayed indefinitely
  // when a browser backgrounds/throttles the page; the decorative ticket must
  // never keep the success state alive (and the offer suppressed) forever.
  lifecycleMaxMs: 3000,
  // Ticket geometry (Figma 33822:171080). The shape itself (rounded corners +
  // mid-edge notches) is the exact Figma vector `TICKET_FILL_PATH`, authored in
  // a 16..249 / 16..124 space, so the SVG uses viewBox `TICKET_VIEWBOX`.
  ticket: {
    widthPx: 233,
    heightPx: 108,
    bottomPx: 86, // sits 12px above the 74px-tall navbar
  },
  // One-shot celebration burst when the circular reveal completes — the
  // T4 fire-spark dots from ButtonPreviewMomios, recolored to the success
  // green, exploding radially outward from the ticket's perimeter.
  burst: {
    count: 26,
    distanceMinPx: 28, // outward travel
    distanceMaxPx: 72,
    sizeMinPx: 3,
    sizeMaxPx: 7,
    durationMinMs: 300,
    durationMaxMs: 500,
    angleJitterRad: 0.3, // deviation from the pure radial direction
  },
  // Explosion "pop" on the ticket when the reveal completes (fires with the
  // burst): a subtle squash & stretch that springs back with overshoot, plus
  // a green glow flash that decays. Reads as something detonating inside.
  pop: {
    scaleX: 1.035, // initial stretch (springs back to 1 with a gentle overshoot)
    scaleY: 0.965,
    spring: { stiffness: 300, damping: 17 },
    glowDecayMs: 620, // glow flashes to peak, then eases back to base
  },
  genie: {
    // Fast, snappy flight — movement + shrink reach the tab in ~170ms.
    y: { stiffness: 620, damping: 33, mass: 0.5 },
    x: { stiffness: 650, damping: 35, mass: 0.45 },
    deformSmoothing: { stiffness: 220, damping: 30, mass: 1 },
    velocitySmoothing: { stiffness: 200, damping: 30, mass: 1 },
    // GRADUAL shrink — the ticket stays a recognizable (if small) card most of
    // the way and only ends around 0.4, so the fly-to-tab is visible instead
    // of collapsing to a dot in the first third.
    // All anchors below are fractions of the overall flight progress (0→1).
    baseScale: { anchors: [0, 0.55, 0.85, 1], scaleAnchors: [1, 0.74, 0.55, 0.42] },
    deform: {
      anchors: [0, 0.65, 1],
      scaleY: [1, 0.8, 1],
      scaleX: [1, 1.2, 1],
    },
    rotation: {
      vRange: [-150, 0, 150] as [number, number, number],
      degRange: [3, 0, -3] as [number, number, number],
    },
    // Leftward lean that grows as the ticket flies toward the tab (exit
    // personality). 0 at launch — matches the upright resting ticket, so the
    // hand-off is seamless — reaching `flightTiltDeg` by the time it arrives.
    flightTiltDeg: -8, // negative = leans left

    // Vanish tied to OVERALL progress toward the tab (both axes), not just y —
    // the flight is a short diagonal toward the "Mis entradas" tab, so a y-only
    // fade blinked it out before it arrived. Stay fully opaque until the last
    // `fadeFraction` of the path, then fade as it settles onto the tab.
    vanish: { gapPx: 2, fadeFraction: 0.15 },
    doneDelayMs: 150, // onDone this long after the catch moment
  },
};

// Ticket outline — the exact Figma vector (node 33822:171081 "Subtract"):
// rounded corners with Figma corner-smoothing + a semicircular notch cut into
// the mid-left and mid-right edges. Authored in a 16..249 (w 233) / 16..124
// (h 108) box, so the SVG renders it through TICKET_VIEWBOX. A centered stroke
// is clipped by the svg viewport at the outer edges → reads as an inside
// stroke, matching Figma.
const TICKET_FILL_PATH =
  'M213.8 16C226.12 16 232.281 15.9999 236.987 18.3975C241.127 20.5067 244.493 23.8731 246.603 28.0127C249 32.7187 249 38.8795 249 51.2002V56.6855C248.034 56.4745 247.03 56.3633 246 56.3633C238.268 56.3633 232 62.6313 232 70.3633C232 78.0953 238.268 84.3633 246 84.3633C247.03 84.3633 248.033 84.2511 249 84.04V88.7998C249 101.12 249 107.281 246.603 111.987C244.493 116.127 241.127 119.493 236.987 121.603C232.281 124 226.12 124 213.8 124H51.2002C38.8795 124 32.7187 124 28.0127 121.603C23.8731 119.493 20.5067 116.127 18.3975 111.987C15.9999 107.281 16 101.12 16 88.7998V84.3633C23.732 84.3633 30 78.0953 30 70.3633C30 62.6313 23.732 56.3633 16 56.3633V51.2002C16 38.8795 15.9999 32.7187 18.3975 28.0127C20.5067 23.8731 23.8731 20.5067 28.0127 18.3975C32.7187 15.9999 38.8795 16 51.2002 16H213.8Z';
const TICKET_VIEWBOX = '16 16 233 108';

/** Green glow only (single drop-shadow → no ghosting). The rim stroke is drawn
 *  by the SVG path. Put on the wrapper so it follows the ticket's alpha.
 *  `glowV` (0→1) intensifies the flash. Base matches the Figma drop-shadow
 *  (#36E5A9 @ 36%, blur 8). */
function ticketGlow(glowV: number): string {
  return `drop-shadow(0 0 ${16 + glowV * 30}px rgba(54,229,169,${0.36 + glowV * 0.5}))`;
}

/** The ticket face — one SVG path (radial-green fill + gradient rim stroke,
 *  notches included) with the check + message overlaid. `entering` plays the
 *  content pop. Shared by the resting ticket and the flying clone. */
function TicketFace({ entering = false }: { entering?: boolean }) {
  return (
    <>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={TICKET_VIEWBOX}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <radialGradient
            id="ticketFill"
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(132.5 62.0909) rotate(90) scale(72.7548 67.0288)"
          >
            <stop stopColor="#29C28A" />
            <stop offset="0.5" stopColor="#1DAC7C" />
            <stop offset="1" stopColor="#059669" />
          </radialGradient>
          <linearGradient
            id="ticketStroke"
            x1="24"
            y1="7.99925"
            x2="242.898"
            y2="133.265"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#34D399" stopOpacity="0.56" />
            <stop offset="1" stopColor="#1B6D4F" />
          </linearGradient>
        </defs>
        <path
          d={TICKET_FILL_PATH}
          fill="url(#ticketFill)"
          fillOpacity="0.95"
          stroke="url(#ticketStroke)"
          strokeWidth="1.5"
        />
      </svg>
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center gap-1${
          entering ? ' animate-[greenContentIn_0.16s_cubic-bezier(0.16,1,0.3,1)]' : ''
        }`}
      >
        <img src={checkIcon} alt="" width={36} height={36} aria-hidden />
        <p className="text-[14px] font-black italic leading-[21px] text-[#fbfbfb]">
          ¡ENTRADA CREADA!
        </p>
      </div>
    </>
  );
}

type Rect = { left: number; top: number; width: number; height: number };

type BurstSpark = {
  id: number;
  leftPct: number; // spawn point on the ticket perimeter, % of ticket size
  topPct: number;
  dx: number; // outward travel in px
  dy: number;
  size: number;
  durationMs: number;
};

/** Sparks on the ticket perimeter, aimed radially outward (+ jitter). */
function makeBurst(): BurstSpark[] {
  const b = cfg.burst;
  // Ticket aspect (233×108) — corrects the radial angle for the percentage
  // coordinate space so corners still fire diagonally.
  const aspect = cfg.ticket.widthPx / cfg.ticket.heightPx;
  return Array.from({ length: b.count }, (_, id) => {
    // Horizontal sides are ~2× longer, so they get 2/3 of the spawns.
    const horizontal = Math.random() < 2 / 3;
    const along = Math.random() * 100;
    const far = Math.random() < 0.5 ? 0 : 100;
    const leftPct = horizontal ? along : far;
    const topPct = horizontal ? far : along;
    const angle =
      Math.atan2(topPct - 50, (leftPct - 50) / aspect) +
      (Math.random() * 2 - 1) * b.angleJitterRad;
    const distance =
      b.distanceMinPx + Math.random() * (b.distanceMaxPx - b.distanceMinPx);
    return {
      id,
      leftPct,
      topPct,
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      size: b.sizeMinPx + Math.random() * (b.sizeMaxPx - b.sizeMinPx),
      durationMs:
        b.durationMinMs + Math.random() * (b.durationMaxMs - b.durationMinMs),
    };
  });
}

/** The flying genie clone — position-fixed at `from`, genies into `to`. */
function GenieClone({
  from,
  to,
  onCatch,
  onDone,
}: {
  from: Rect;
  to: Rect;
  onCatch: () => void;
  onDone: () => void;
}) {
  const g = cfg.genie;
  // Ticket bottom-center → gapPx above the tab's top edge. The y spring LANDS
  // at the vanish point (not the tab center) so the whole flight is visible:
  // the ticket decelerates into the spot just above the tab and dissolves
  // there. Targeting deeper would spend most of the spring's fast early
  // travel past the fade window, blinking the ticket out mid-flight.
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top - g.vanish.gapPx - (from.top + from.height);

  const yMV = useMotionValue(0);
  const xMV = useMotionValue(0);

  const smoothXVel = useSpring(useVelocity(xMV), g.velocitySmoothing);

  // Overall flight progress toward the tab (0 → 1), from BOTH axes. The path is
  // a short, mostly-horizontal diagonal to the "Mis entradas" tab, so driving
  // the shrink / deform / fade off y alone finished them almost instantly (y is
  // only ~10px, x ~80px). Every effect below is a function of this progress.
  const totalDist = Math.hypot(dx, dy) || 1;
  const flightProgress = useTransform(
    [xMV, yMV] as MotionValue<number>[],
    (v: number[]) => Math.min(1, Math.hypot(v[0], v[1]) / totalDist),
  );

  const baseScale = useTransform(
    flightProgress,
    g.baseScale.anchors,
    g.baseScale.scaleAnchors,
    { clamp: true },
  );
  const smoothDeformY = useSpring(
    useTransform(flightProgress, g.deform.anchors, g.deform.scaleY, { clamp: true }),
    g.deformSmoothing,
  );
  const smoothDeformX = useSpring(
    useTransform(flightProgress, g.deform.anchors, g.deform.scaleX, { clamp: true }),
    g.deformSmoothing,
  );
  const scaleY = useTransform(
    [baseScale, smoothDeformY] as MotionValue<number>[],
    (l: number[]) => l[0] * l[1],
  );
  const scaleX = useTransform(
    [baseScale, smoothDeformX] as MotionValue<number>[],
    (l: number[]) => l[0] * l[1],
  );
  // Flight rotation: a leftward lean that grows with flight progress (0 at
  // launch, so it matches the upright resting ticket) plus a subtle
  // velocity-driven wobble for life.
  const flightTilt = useTransform(flightProgress, [0, 1], [0, g.flightTiltDeg], {
    clamp: true,
  });
  const velRotate = useTransform(smoothXVel, g.rotation.vRange, g.rotation.degRange);
  const rotate = useTransform(
    [flightTilt, velRotate] as MotionValue<number>[],
    (l: number[]) => l[0] + l[1],
  );
  // Fade only over the last `fadeFraction` of the path — stays fully visible
  // through the trajectory, then dissolves as it settles onto the tab.
  const opacityMV = useTransform(
    flightProgress,
    [1 - g.vanish.fadeFraction, 1],
    [1, 0],
    { clamp: true },
  );

  useEffect(() => {
    let caught = false;
    let done = false;
    const fireDone = () => {
      if (done) return;
      done = true;
      onDone();
    };
    const timers: number[] = [];

    // The "catch": the moment the ticket has essentially arrived at the tab
    // (now faded) the icon bumps; onDone follows shortly.
    const unsub = flightProgress.on('change', (p) => {
      if (caught || p < 0.985) return;
      caught = true;
      onCatch();
      timers.push(window.setTimeout(fireDone, g.doneDelayMs));
    });

    const ya = animate(yMV, dy, { type: 'spring', ...g.y });
    const xa = animate(xMV, dx, { type: 'spring', ...g.x });
    // Safety net — if the vanish point is somehow never crossed, still finish.
    ya.then(() => timers.push(window.setTimeout(fireDone, g.doneDelayMs)));

    return () => {
      unsub();
      ya.stop();
      xa.stop();
      timers.forEach((t) => clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outer wrapper carries position + fade + the glow drop-shadow (follows the
  // ticket, isn't clipped by the SVG viewport); inner carries the scale/rotate
  // so the notches shrink with the ticket.
  return (
    <motion.div
      style={{
        position: 'fixed',
        left: from.left,
        top: from.top,
        width: from.width,
        height: from.height,
        transformOrigin: '50% 100%',
        zIndex: 60,
        pointerEvents: 'none',
        x: xMV,
        y: yMV,
        opacity: opacityMV,
        filter: ticketGlow(0.2),
      }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ scaleX, scaleY, rotate, transformOrigin: '50% 100%' }}
      >
        <TicketFace />
      </motion.div>
    </motion.div>
  );
}

export function EntryCreatedOverlay({
  onDone,
  onCatch,
  onCovered,
}: {
  onDone: () => void;
  onCatch: () => void;
  /** Circular reveal finished — the green ticket now fully covers the slip. */
  onCovered?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const [flight, setFlight] = useState<{ from: Rect; to: Rect } | null>(null);
  // Celebration sparks — generated once, when the circular reveal completes.
  const [burst, setBurst] = useState<BurstSpark[] | null>(null);

  // Explosion "pop" — squash & stretch (springs back with overshoot) and a
  // green glow flash (glow 0→1→0) fired when the reveal completes.
  const cardScaleX = useMotionValue(1);
  const cardScaleY = useMotionValue(1);
  const glow = useMotionValue(0);
  // Stroke + glow live on the wrapper as a drop-shadow filter (so they follow
  // the notched shape and aren't clipped by the SVG viewport).
  const ticketFilterMV = useTransform(glow, (g) => ticketGlow(g));

  const finishOnce = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  const handleRevealEnd = () => {
    onCovered?.();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setBurst((b) => b ?? makeBurst());
    // Squash & stretch, then spring-settle with overshoot.
    cardScaleX.set(cfg.pop.scaleX);
    cardScaleY.set(cfg.pop.scaleY);
    animate(cardScaleX, 1, { type: 'spring', ...cfg.pop.spring });
    animate(cardScaleY, 1, { type: 'spring', ...cfg.pop.spring });
    // Green glow flash → decay to base.
    glow.set(1);
    animate(glow, 0, { duration: cfg.pop.glowDecayMs / 1000, ease: 'easeOut' });
  };

  // Hold the green ticket in place, then measure slip + tab and start the
  // flight. The flight must never launch with the slip still mounted behind it,
  // so onCovered fires here too as a fallback (idempotent) in case the ticket's
  // animationend event was missed.
  useEffect(() => {
    const t = window.setTimeout(() => {
      onCovered?.();
      const from = cardRef.current?.getBoundingClientRect();
      const tab = document.querySelector('[data-tab="entradas"]')?.getBoundingClientRect();
      if (from && tab) {
        setFlight({ from, to: tab });
      } else {
        finishOnce();
      }
    }, cfg.confirmedHoldMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Covers the entire reveal → hold → flight sequence. This is deliberately
  // independent of Framer's spring promises and DOM measurement so browser
  // throttling, a missing tab target, or an interrupted animation can never
  // strand the success flow. `finishOnce` also makes the normal and fallback
  // completion paths safe to race.
  useEffect(() => {
    const t = window.setTimeout(finishOnce, cfg.lifecycleMaxMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const T = cfg.ticket;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[60]"
      style={{ fontFamily: "'Red Hat Display', sans-serif" }}
    >
      {/* Green success ticket in its resting spot (until it flies) — enters as a
          circle expanding from its center, over the still-mounted slip (App
          unmounts the slip on onCovered). Wrapper carries scale + the glow
          drop-shadow; the child carries the reveal, the shape, and the content. */}
      {!flight && (
        <motion.div
          ref={cardRef}
          className="absolute"
          style={{
            // Center with left:50% + a static negative marginLeft (layout,
            // not a transform) so the edge paint-snaps crisp.
            bottom: T.bottomPx,
            left: '50%',
            marginLeft: -T.widthPx / 2,
            width: T.widthPx,
            height: T.heightPx,
            scaleX: cardScaleX,
            scaleY: cardScaleY,
            filter: ticketFilterMV,
          }}
        >
          <div
            className="absolute inset-0 animate-[greenCircleIn_0.16s_cubic-bezier(0.16,1,0.3,1)]"
            onAnimationEnd={(e) => {
              if (e.animationName === 'greenCircleIn') handleRevealEnd();
            }}
          >
            <TicketFace entering />
          </div>
        </motion.div>
      )}
      {/* Celebration burst — green success sparks exploding outward from the
          ticket's perimeter. A sibling of the ticket; after it in the DOM so
          they paint on top. */}
      {!flight && burst && (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            bottom: T.bottomPx,
            left: '50%',
            marginLeft: -T.widthPx / 2,
            width: T.widthPx,
            height: T.heightPx,
          }}
        >
          {burst.map((s) => (
            <motion.span
              key={s.id}
              className="absolute rounded-full"
              style={{
                left: `${s.leftPct}%`,
                top: `${s.topPct}%`,
                width: s.size,
                height: s.size,
                translateX: '-50%',
                translateY: '-50%',
                background:
                  'radial-gradient(circle, #ffffff 0%, #36e5a9 45%, rgba(41,194,138,0) 100%)',
                boxShadow:
                  '0 0 8px rgba(54,229,169,0.95), 0 0 14px rgba(41,194,138,0.6)',
              }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
              animate={{
                x: s.dx,
                y: s.dy,
                opacity: [0, 1, 1, 0],
                // Shrink as it decelerates — same read as the T4 spark dots.
                scale: [1, 1, 0.9, 0.35],
              }}
              transition={{
                duration: s.durationMs / 1000,
                ease: [0.2, 0.7, 0.3, 1], // explosion: fast launch, decelerate
                opacity: { times: [0, 0.08, 0.6, 1] },
                scale: { times: [0, 0.1, 0.6, 1] },
              }}
            />
          ))}
        </div>
      )}
      {flight && (
        <GenieClone
          from={flight.from}
          to={flight.to}
          onCatch={onCatch}
          onDone={finishOnce}
        />
      )}
    </div>
  );
}
