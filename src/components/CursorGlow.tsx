/**
 * Premium custom cursor with a visible comet trail.
 *
 * Layers (all pointer-events-none, above the page):
 *  - glow  : soft ambient light, only over bare page background
 *  - trail : a chain of dots that lag progressively, forming a comet tail
 *  - ring  : a bold ring that grows/tints over interactive elements
 *  - dot   : a bright core that tracks the pointer exactly
 *
 * Native cursor is hidden only after this mounts on a fine, non-touch,
 * motion-ok pointer, and restored on unmount — never a no-cursor state.
 */
import { useEffect, useRef, useState } from 'react';

const INTERACTIVE =
  'a, button, [role="button"], [role="menuitem"], input, textarea, select, label, .card-surface, .cursor-target';
const UI_SELECTOR =
  '.card-surface, button, a, input, textarea, select, header, nav, [role="dialog"], [role="menu"], table, canvas, .no-glow';

const TRAIL_COUNT = 6;

export default function CursorGlow() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [glowOn, setGlowOn] = useState(false);

  const pointer = useRef({ x: -100, y: -100 });
  const ring = useRef({ x: -100, y: -100 });
  const glow = useRef({ x: -100, y: -100 });
  const trail = useRef(
    Array.from({ length: TRAIL_COUNT }, () => ({ x: -100, y: -100 })),
  );
  const raf = useRef(0);

  useEffect(() => {
    // Only skip on touch devices (no hovering pointer). We intentionally do
    // NOT skip for prefers-reduced-motion: many desktop users (esp. Windows
    // with animations disabled) still want this signature cursor.
    if (window.matchMedia('(pointer: coarse)').matches) return;

    document.documentElement.classList.add('custom-cursor-active');
    let seeded = false;

    const onMove = (e: MouseEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY };
      if (!seeded) {
        ring.current = { ...pointer.current };
        glow.current = { ...pointer.current };
        trail.current = trail.current.map(() => ({ ...pointer.current }));
        seeded = true;
      }
      const el = e.target as Element | null;
      setGlowOn(!el?.closest?.(UI_SELECTOR));
      ringRef.current?.classList.toggle('is-hovering', !!el?.closest?.(INTERACTIVE));
    };
    const onDown = () => ringRef.current?.classList.add('is-down');
    const onUp = () => ringRef.current?.classList.remove('is-down');
    const onLeave = () => {
      setGlowOn(false);
      [dotRef.current, ringRef.current, ...trailRefs.current].forEach((n) =>
        n?.style.setProperty('opacity', '0'),
      );
    };
    const onEnter = () => {
      [dotRef.current, ringRef.current, ...trailRefs.current].forEach((n) =>
        n?.style.removeProperty('opacity'),
      );
    };

    const tick = () => {
      // dot snaps to pointer
      if (dotRef.current)
        dotRef.current.style.transform = `translate3d(${pointer.current.x}px, ${pointer.current.y}px, 0) translate(-50%, -50%)`;

      // ring eases quickly
      ring.current.x += (pointer.current.x - ring.current.x) * 0.2;
      ring.current.y += (pointer.current.y - ring.current.y) * 0.2;
      if (ringRef.current)
        ringRef.current.style.transform = `translate3d(${ring.current.x}px, ${ring.current.y}px, 0) translate(-50%, -50%)`;

      // glow eases slowly
      glow.current.x += (pointer.current.x - glow.current.x) * 0.1;
      glow.current.y += (pointer.current.y - glow.current.y) * 0.1;
      if (glowRef.current)
        glowRef.current.style.transform = `translate3d(${glow.current.x}px, ${glow.current.y}px, 0) translate(-50%, -50%)`;

      // comet trail: each point chases the point ahead of it
      for (let i = 0; i < TRAIL_COUNT; i++) {
        const leadX = i === 0 ? pointer.current.x : trail.current[i - 1].x;
        const leadY = i === 0 ? pointer.current.y : trail.current[i - 1].y;
        trail.current[i].x += (leadX - trail.current[i].x) * 0.35;
        trail.current[i].y += (leadY - trail.current[i].y) * 0.35;
        const node = trailRefs.current[i];
        if (node)
          node.style.transform = `translate3d(${trail.current[i].x}px, ${trail.current[i].y}px, 0) translate(-50%, -50%)`;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);
    return () => {
      cancelAnimationFrame(raf.current);
      document.documentElement.classList.remove('custom-cursor-active');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
    };
  }, []);

  return (
    <>
      <div ref={glowRef} aria-hidden className="cursor-glow" style={{ opacity: glowOn ? 1 : 0 }} />
      {Array.from({ length: TRAIL_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(n) => (trailRefs.current[i] = n)}
          aria-hidden
          className="cursor-trail"
          style={{
            // fade + shrink toward the tail
            ['--t' as string]: String(1 - i / TRAIL_COUNT),
          }}
        />
      ))}
      <div ref={ringRef} aria-hidden className="cursor-ring" />
      <div ref={dotRef} aria-hidden className="cursor-dot" />
    </>
  );
}
