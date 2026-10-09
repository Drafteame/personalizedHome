import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import flameIcon from './assets/paraTiIcon.png';
import { buttonProgressionConfig } from './buttonProgressionConfig';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const cfg = buttonProgressionConfig.featuredMatch;
type Phase = 'default' | 'flames' | 'entrance' | 'holding' | 'settling' | 'settled';
// Page-session timestamps prevent replay across tab unmounts.
const starts = new Map<string, number>();
const flameEnd = cfg.activationMs + cfg.flameMs;
const entranceEnd = flameEnd + cfg.entranceMs;
const holdEnd = entranceEnd + cfg.holdMs;
const sequenceEnd = holdEnd + cfg.settleMs;
function phaseAt(elapsed: number): Phase {
  return elapsed < flameEnd ? 'flames' : elapsed < entranceEnd ? 'entrance' : elapsed < holdEnd ? 'holding' : elapsed < sequenceEnd ? 'settling' : 'settled';
}

export function useFeaturedMatchSequence(matchId: string) {
  const headerRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const timers = useRef<number[]>([]);
  const entranceComplete = useRef(false);
  const [phase, setPhase] = useState<Phase>(() => reduced ? 'settled' : starts.has(matchId) ? phaseAt(Date.now() - starts.get(matchId)!) : 'default');
  useEffect(() => {
    entranceComplete.current = false;
    if (reduced) {
      starts.set(matchId, Date.now() - sequenceEnd);
      setPhase('settled');
      return;
    }
    const run = () => {
      if (!starts.has(matchId)) starts.set(matchId, Date.now());
      const elapsed = Date.now() - starts.get(matchId)!;
      setPhase(phaseAt(elapsed));
      if (elapsed < flameEnd) timers.current.push(window.setTimeout(() => setPhase('entrance'), flameEnd - elapsed));
    };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        run();
      }
    }, { rootMargin: cfg.rootMargin });
    if (starts.has(matchId)) run();
    else if (headerRef.current) observer.observe(headerRef.current);
    return () => {
      observer.disconnect();
      timers.current.forEach(clearTimeout);
      timers.current = [];
      // An interrupted decorative sequence settles on return, never re-emits particles.
      if (starts.has(matchId)) starts.set(matchId, Date.now() - sequenceEnd);
    };
  }, [matchId, reduced]);
  const onEntranceComplete = () => {
    if (phase !== 'entrance' || entranceComplete.current || reduced) return;
    entranceComplete.current = true;
    setPhase('holding');
    // Start the readability hold from Motion's actual completion, not activation.
    timers.current.push(window.setTimeout(() => {
      setPhase('settling');
      timers.current.push(window.setTimeout(() => setPhase('settled'), cfg.settleMs));
    }, cfg.holdMs));
  };
  return { headerRef, phase, onEntranceComplete };
}

// Sample once for the mounted run; renders and phase changes never reroll particles.
function makeFlames() {
  const between = (range: readonly number[]) => range[0] + Math.random() * (range[1] - range[0]);
  return Array.from({ length: cfg.flameCount }, (_, id) => ({
    id, left: between(cfg.flames.leftPct), delay: between(cfg.flames.delayMs),
    size: between(cfg.flames.sizePx), opacity: between(cfg.flames.opacity),
    rise: between(cfg.flames.risePx), duration: between(cfg.flames.durationMs),
    drift: between(cfg.flames.driftPx), bottom: between(cfg.flames.bottomPx),
  }));
}

export function FeaturedMatchParticles({ phase }: { phase: Phase }) {
  const [flames] = useState(makeFlames);
  if (phase !== 'flames' && phase !== 'entrance') return null;
  return <div className="featured-particles" aria-hidden>
    {phase === 'flames' ? flames.map(f =>
      <motion.img key={`flame-${f.id}`} src={flameIcon} alt="" draggable={false}
        style={{ position: 'absolute', left: `${f.left}%`, bottom: f.bottom, width: f.size, height: f.size }}
        initial={{ y: 0, opacity: 0, scale: 0.7 }}
        animate={{ x: f.drift, y: -f.rise, opacity: [0, f.opacity, f.opacity, 0], scale: [0.7, 1, 0.8] }}
        transition={{ delay: (cfg.activationMs + f.delay) / 1000, duration: f.duration / 1000, ease: 'linear', opacity: { duration: f.duration / 1000, delay: (cfg.activationMs + f.delay) / 1000, ease: 'linear', times: [0, 0.15, 0.65, 1] } }} />
    ) : Array.from({ length: cfg.sparkCount }, (_, i) => {
      const angle = i * Math.PI * 2 / cfg.sparkCount;
      // Ticket confirmation's radial launch, opacity envelope and shrinking sparks.
      return <motion.span key={`spark-${i}`} className="featured-count-spark"
        initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
        animate={{ x: Math.cos(angle) * cfg.sparkDistancePx, y: Math.sin(angle) * cfg.sparkDistancePx, opacity: [0, 1, 1, 0], scale: [1, 1, 0.9, 0.35] }}
        transition={{ duration: cfg.sparkDurationMs / 1000, ease: cfg.sparkEase, opacity: { times: [0, 0.08, 0.6, 1] }, scale: { times: [0, 0.1, 0.6, 1] } }} />;
    })}
  </div>;
}

export function FeaturedBetCount({ count, phase, onEntranceComplete }: { count: number; phase: Phase; onEntranceComplete: () => void }) {
  if (phase === 'default' || phase === 'flames') return null;
  const entering = phase === 'entrance' || phase === 'holding';
  const label = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(count).replace(/\s/g, '');
  return <motion.div onAnimationComplete={onEntranceComplete} className="featured-bet-count" aria-label={`${count.toLocaleString('es-MX')} apuestas en juego`}
    initial={entering ? { opacity: 0, scale: cfg.entrance.scale, y: cfg.entrance.y, clipPath: 'circle(12px at 50% 50%)' } : false}
    animate={{ opacity: 1, scale: 1, y: entering ? cfg.entrance.y : 0, clipPath: 'circle(75% at 50% 50%)' }}
    transition={{ duration: (entering ? cfg.entranceMs : cfg.settleMs) / 1000, ease: cfg.ease }}>
    <motion.div className="featured-count-content" initial={false}
      animate={{ scaleX: entering ? [1, cfg.entrance.scaleX, 1] : 1, scaleY: entering ? [1, cfg.entrance.scaleY, 1] : 1, rotate: entering ? cfg.entrance.rotate : 0 }}
      transition={{ duration: cfg.entranceMs / 1000, ease: cfg.ease }}>
      <motion.img initial={false} src={flameIcon} alt="" animate={{ width: entering ? 24 : 12, height: entering ? 24 : 12 }} transition={{ duration: cfg.settleMs / 1000 }} />
      <motion.div initial={false} style={{ fontSize: 10 }} animate={{ fontSize: entering ? 12 : 10, color: entering ? '#fbfbfb' : 'rgba(251,251,251,.7)' }} transition={{ duration: cfg.settleMs / 1000 }}>
        <span>{label.toUpperCase()} BETS</span>
        <motion.span initial={false} className="featured-count-subtitle" aria-hidden={!entering} animate={{ opacity: entering ? 1 : 0, height: entering ? 12 : 0 }} transition={{ duration: cfg.settleMs / 1000 }}>EN JUEGO</motion.span>
      </motion.div>
    </motion.div>
  </motion.div>;
}
