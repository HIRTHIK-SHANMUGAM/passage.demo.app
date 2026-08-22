/**
 * Micro-interaction components, adapted from React Bits (reactbits.dev, MIT —
 * DavidHDev/react-bits) to TypeScript and Passage's design tokens:
 * TiltedCard → TiltCard, ShinyText, CountUp, StarBorder.
 * The cursor-tracking card spotlight lives in index.css + a single global
 * mousemove delegate registered in App.tsx.
 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

/* ---------- TiltCard — 3D tilt that follows the cursor ---------- */

const tiltSpring = { damping: 22, stiffness: 220, mass: 0.6 };

export function TiltCard({
  children,
  className = '',
  amplitude = 8,
  scaleOnHover = 1.02,
}: {
  children: ReactNode;
  className?: string;
  amplitude?: number;
  scaleOnHover?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(useMotionValue(0), tiltSpring);
  const rotateY = useSpring(useMotionValue(0), tiltSpring);
  const scale = useSpring(1, tiltSpring);

  function handleMouse(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;
    rotateX.set((offsetY / (rect.height / 2)) * -amplitude);
    rotateY.set((offsetX / (rect.width / 2)) * amplitude);
  }

  function reset() {
    rotateX.set(0);
    rotateY.set(0);
    scale.set(1);
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX, rotateY, scale, transformPerspective: 900, transformStyle: 'preserve-3d' }}
      onMouseMove={handleMouse}
      onMouseEnter={() => scale.set(scaleOnHover)}
      onMouseLeave={reset}
    >
      {children}
    </motion.div>
  );
}

/* ---------- ShinyText — a sheen sweeps across the text ---------- */

export function ShinyText({
  text,
  className = '',
  speed = 3,
}: {
  text: string;
  className?: string;
  speed?: number;
}) {
  return (
    <span className={`shiny-text ${className}`} style={{ animationDuration: `${speed}s` }}>
      {text}
    </span>
  );
}

/* ---------- CountUp — numbers animate up when they appear ---------- */

export function CountUp({ to, duration = 0.9 }: { to: number; duration?: number }) {
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current && value === to) return;
    started.current = true;
    const from = 0;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, duration]);

  return <>{value}</>;
}

/* ---------- StarBorder — orbiting glow along a button's edge ---------- */

export function StarBorder({
  children,
  className = '',
  color = 'var(--orange)',
  speed = '5s',
}: {
  children: ReactNode;
  className?: string;
  color?: string;
  speed?: string;
}) {
  return (
    <div className={`star-border-container ${className}`}>
      <div
        className="star-border-gradient star-border-bottom"
        style={{ background: `radial-gradient(circle, ${color}, transparent 12%)`, animationDuration: speed }}
      />
      <div
        className="star-border-gradient star-border-top"
        style={{ background: `radial-gradient(circle, ${color}, transparent 12%)`, animationDuration: speed }}
      />
      <div className="star-border-inner">{children}</div>
    </div>
  );
}
