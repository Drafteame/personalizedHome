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
import checkIcon from './assets/success-check-3d.png';
import boosterIcon from './assets/booster.png';
import freeBetIcon from './assets/apuestaGratis.png';
import rescateIcon from './assets/rescateWings.png';
import type { ActivePromo } from './types';
import { promoConfig, ticketArtwork, ticketArtworkLayout } from './promoConfig';

/**
 * EntryCreatedOverlay — the success confirmation animation.
 *
 * ONE shape for every success flow (swipe-to-confirm on the expanded slip,
 * swipe-to-play on the "Resumen de tu entrada" full sheet, AND the lightning
 * long-press): a compact ticket/stub (original Figma 35252:75429 footprint — 154.975×61, rounded
 * corners + a semicircular notch on the mid-left/right edges, dark fill,
 * themed 4px rim/glow, 3D illustration + rotated two-line text).
 * The old full-width green card is gone.
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
 *      follows `doneDelayMs` later (app then records the entry + pops the badge).
 *
 * Flight timing lives in `cfg`; entrance timing in the index.css keyframes.
 */

const cfg = {
  // Readable hold before the genie flight, matching one-click-bet's compact
  // ticket. Keep the reveal, celebration, and flight timings unchanged.
  confirmedHoldMs: 1700,
  // Absolute lifecycle guard. Spring completion can be delayed indefinitely
  // when a browser backgrounds/throttles the page; the decorative ticket must
  // never keep the success state alive (and the offer suppressed) forever.
  lifecycleMaxMs: 3000,
  // Preserve the original Figma 35252:75429 animation footprint. The new
  // exported ticket assets retain these bounds inside their 16px glow inset.
  ticket: {
    widthPx: 154.975,
    heightPx: 61,
    rimWidthPx: 4, // reference thickness; baked into the exact Figma SVG assets
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

/** The artwork supplies the fill/rim; its exported outer shadow is disabled.
 * Keep the original single-shadow baseline and flash response on the wrapper. */
function ticketGlow(glowV: number, promo: ActivePromo = null): string {
  const artwork = ticketArtwork[promo ?? 'default'];
  return `drop-shadow(0 0 ${16 + glowV * 30}px rgba(${artwork.glowRgb},${0.36 + glowV * 0.5}))`;
}

/** Exact Figma background/rim/light assets, shared by resting and flying
 * tickets. Intrinsic export padding sits outside the original footprint. */
function TicketFace({ entering = false, promo = null }: { entering?: boolean; promo?: ActivePromo }) {
  const artwork = ticketArtwork[promo ?? 'default'];
  const layout = ticketArtworkLayout;
  return (
    <>
      <img src={artwork.base} alt="" aria-hidden draggable={false}
        className="pointer-events-none absolute max-w-none"
        style={{ left: -layout.exportInsetPx, top: -layout.exportInsetPx }} />
      <img src={artwork.light} alt="" aria-hidden draggable={false}
        className="pointer-events-none absolute max-w-none"
        style={{ left: -layout.exportInsetPx, top: -layout.exportInsetPx }} />
      <div
        style={{ left: artwork.contentLeftPx, top: layout.contentTopPx, gap: artwork.contentGapPx }}
        className={`absolute flex items-center${
          entering ? ' animate-[greenContentIn_0.16s_cubic-bezier(0.16,1,0.3,1)]' : ''
        }`}
      >
        {promo ? <div className="relative size-[36px] shrink-0" style={promo === 'booster' ? { filter: 'drop-shadow(0px 5px 5.6px rgba(102,0,120,0.46))' } : undefined}>
          <img src={promo === 'booster' ? boosterIcon : promo === 'rescate' ? rescateIcon : freeBetIcon} alt="" aria-hidden className={promo === 'booster' ? 'absolute inset-[-19.38%_-18.91%_-16.83%_-17.3%] h-[136.21%] w-[136.21%] max-w-none rotate-12 object-contain' : 'size-full object-contain'} />
        </div> : <div
          className="relative size-[36px] shrink-0"
          style={{ filter: 'drop-shadow(0px 1px 4.1px rgba(0,78,53,0.71))' }}
        >
          <div className="absolute inset-[-3.13%]">
            <img
              src={checkIcon}
              alt=""
              className="absolute inset-0 size-full max-w-none object-cover"
              aria-hidden
            />
          </div>
          {/* Green color-burn tint over the icon — matches the Figma "ligh"
              layer, keeping the metallic check in the ticket's green family. */}
          <div className="absolute inset-[16.15%_15.1%_15.1%_16.15%] rounded-[100px] bg-[#34d399] opacity-50 mix-blend-color-burn blur-[11px]" />
        </div>}
        <div className="flex items-center justify-center" style={{ height: layout.textHeightPx, width: layout.textWidthPx }}>
          <p style={promo ? { textShadow: '0px 1px 2px rgba(0,0,0,0.46)' } : undefined} className="rotate-[-3.7deg] whitespace-nowrap text-[14px] font-black italic leading-[18px] text-[#fbfbfb]">
            ¡ENTRADA
            <br aria-hidden />
            CREADA!
          </p>
        </div>
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
  // Ticket aspect (154.975×61) — corrects the radial angle for the percentage
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
  promo,
}: {
  from: Rect;
  to: Rect;
  onCatch: () => void;
  onDone: () => void;
  promo: ActivePromo;
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
        filter: ticketGlow(0.2, promo),
      }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ scaleX, scaleY, rotate, transformOrigin: '50% 100%' }}
      >
        <TicketFace promo={promo} />
      </motion.div>
    </motion.div>
  );
}

export function EntryCreatedOverlay({
  onDone,
  onCatch,
  onCovered,
  promo = null,
}: {
  onDone: () => void;
  onCatch: () => void;
  /** Circular reveal finished — the green ticket now fully covers the slip. */
  onCovered?: () => void;
  promo?: ActivePromo;
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
  const ticketFilterMV = useTransform(glow, (g) => ticketGlow(g, promo));

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
      data-ticket-promo={promo ?? 'none'}
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
            <TicketFace entering promo={promo} />
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
                background: promo
                  ? `radial-gradient(circle, #ffffff 0%, ${promoConfig[promo].colors[0]} 45%, rgba(${promoConfig[promo].glowRgb},0) 100%)`
                  : 'radial-gradient(circle, #ffffff 0%, #36e5a9 45%, rgba(41,194,138,0) 100%)',
                boxShadow: promo
                  ? `0 0 8px rgba(${promoConfig[promo].glowRgb},0.95), 0 0 14px rgba(${promoConfig[promo].glowRgb},0.6)`
                  : '0 0 8px rgba(54,229,169,0.95), 0 0 14px rgba(41,194,138,0.6)',
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
          promo={promo}
          from={flight.from}
          to={flight.to}
          onCatch={onCatch}
          onDone={finishOnce}
        />
      )}
    </div>
  );
}
