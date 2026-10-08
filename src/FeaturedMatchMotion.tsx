import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import flameIcon from './assets/paraTiIcon.png';
import { buttonProgressionConfig } from './buttonProgressionConfig';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const cfg = buttonProgressionConfig.featuredMatch;
type Phase = 'default' | 'flames' | 'entrance' | 'settling' | 'settled';
// Page-session timestamps prevent replay across tab unmounts.
const starts = new Map<string, number>();
const flameEnd = cfg.activationMs + cfg.flameMs;
const entranceEnd = flameEnd + cfg.entranceMs;
const sequenceEnd = entranceEnd + cfg.settleMs;
function phaseAt(elapsed: number): Phase {
  return elapsed < flameEnd ? 'flames' : elapsed < entranceEnd ? 'entrance' : elapsed < sequenceEnd ? 'settling' : 'settled';
}

export function useFeaturedMatchSequence(matchId: string) {
  const headerRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>(() => reduced ? 'settled' : starts.has(matchId) ? phaseAt(Date.now() - starts.get(matchId)!) : 'default');
  useEffect(() => {
    const timers: number[] = [];
    if (reduced) {
      starts.set(matchId, Date.now() - sequenceEnd);
      setPhase('settled');
      return;
    }
    const run = () => {
      if (!starts.has(matchId)) starts.set(matchId, Date.now());
      const elapsed = Date.now() - starts.get(matchId)!;
      setPhase(phaseAt(elapsed));
      for (const boundary of [flameEnd, entranceEnd, sequenceEnd]) {
        if (elapsed < boundary) timers.push(window.setTimeout(() => setPhase(phaseAt(Date.now() - starts.get(matchId)!)), boundary - elapsed));
      }
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
      timers.forEach(clearTimeout);
      // An interrupted decorative sequence settles on return, never re-emits particles.
      if (starts.has(matchId)) starts.set(matchId, Date.now() - sequenceEnd);
    };
  }, [matchId, reduced]);
  return { headerRef, phase };
}

export function FeaturedMatchParticles({ phase }: { phase: Phase }) {
  if (phase !== 'flames' && phase !== 'entrance') return null;
  return <div className="featured-particles" aria-hidden>
    {phase === 'flames' ? Array.from({ length: cfg.flameCount }, (_, i) =>
      <motion.img key={`flame-${i}`} src={flameIcon} alt="" draggable={false}
        style={{ position: 'absolute', left: `${(i + 0.5) * 100 / cfg.flameCount}%`, bottom: 0, width: cfg.flameSizePx, height: cfg.flameSizePx }}
        initial={{ y: 0, opacity: 0, scale: 0.7 }}
        animate={{ y: -cfg.flameTravelPx, opacity: [0, cfg.flameOpacity, cfg.flameOpacity, 0], scale: [0.7, 1, 0.8] }}
        transition={{ delay: (cfg.activationMs + i * cfg.flameStaggerMs) / 1000, duration: cfg.flameDurationMs / 1000, ease: 'easeOut', opacity: { times: [0, 0.15, 0.5, 1] } }} />
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

export function FeaturedBetCount({ count, phase }: { count: number; phase: Phase }) {
  if (phase === 'default' || phase === 'flames') return null;
  const entering = phase === 'entrance';
  const label = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(count);
  return <motion.div className="featured-bet-count" aria-label={`${count.toLocaleString('es-MX')} apuestas en juego`}
    initial={entering ? { opacity: 0, scale: cfg.entrance.scale, y: cfg.entrance.y, clipPath: 'circle(12px at 50% 50%)' } : false}
    animate={{ opacity: 1, scale: 1, y: entering ? cfg.entrance.y : 0, clipPath: 'circle(75% at 50% 50%)' }}
    transition={{ duration: (entering ? cfg.entranceMs : cfg.settleMs) / 1000, ease: cfg.ease }}>
    <motion.div className="featured-count-content" initial={false}
      animate={{ scaleX: entering ? [1, cfg.entrance.scaleX, 1] : 1, scaleY: entering ? [1, cfg.entrance.scaleY, 1] : 1, rotate: entering ? cfg.entrance.rotate : 0 }}
      transition={{ duration: cfg.entranceMs / 1000, ease: cfg.ease }}>
      <motion.img initial={false} src={flameIcon} alt="" animate={{ width: entering ? 24 : 12, height: entering ? 24 : 12 }} transition={{ duration: cfg.settleMs / 1000 }} />
      <motion.div initial={false} style={{ fontSize: 10 }} animate={{ fontSize: entering ? 12 : 10, color: entering ? '#fbfbfb' : 'rgba(251,251,251,.7)' }} transition={{ duration: cfg.settleMs / 1000 }}>
        <span>{label.toUpperCase()} APUESTAS</span>
        <motion.span initial={false} className="featured-count-subtitle" aria-hidden={!entering} animate={{ opacity: entering ? 1 : 0, height: entering ? 12 : 0 }} transition={{ duration: cfg.settleMs / 1000 }}>EN JUEGO</motion.span>
      </motion.div>
    </motion.div>
  </motion.div>;
}
