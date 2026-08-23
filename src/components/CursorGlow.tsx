/**
 * Premium custom cursor system.
 *
 * Three layers, all pointer-events-none and above the page:
 *  1. dot   — a small solid dot that tracks the pointer exactly
 *  2. ring  — a larger outlined ring that lags behind with easing; it grows
 *             and tints when hovering an interactive element (button, link,
 *             card, input), and collapses on mouse-down for a "click" feel
 *  3. glow  — a soft ambient light that only shows over the bare page
 *             background (hidden over cards/controls/nav/silk canvas)
 *
 * The native cursor is hidden only after this mounts on a fine, non-touch
 * pointer (class on <html>), so there is never a "no cursor" state if JS
 * fails or on touch devices. Fully disabled for prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from 'react';

const INTERACTIVE = 'a, button, [role="button"], [role="menuitem"], input, textarea, select, label, .card-surface, .cursor-target';
const UI_SELECTOR =
  '.card-surface, button, a, input, textarea, select, header, nav, [role="dialog"], [role="menu"], table, canvas, .no-glow';

export default function CursorGlow() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [glowOn, setGlowOn] = useState(false);

  // pointer + eased ring/glow positions
  const pointer = useRef({ x: -100, y: -100 });
  const ring = useRef({ x: -100, y: -100 });
  const glow = useRef({ x: -100, y: -100 });
  const raf = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    document.documentElement.classList.add('custom-cursor-active');
    let seeded = false;

    const onMove = (e: MouseEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY };
      if (!seeded) {
        ring.current = { ...pointer.current };
        glow.current = { ...pointer.current };
        seeded = true;
      }
      const el = e.target as Element | null;
      const overUi = !!el?.closest?.(UI_SELECTOR);
      setGlowOn(!overUi);
      const interactive = !!el?.closest?.(INTERACTIVE);
      ringRef.current?.classList.toggle('is-hovering', interactive);
    };
    const onDown = () => ringRef.current?.classList.add('is-down');
    const onUp = () => ringRef.current?.classList.remove('is-down');
    const onLeave = () => {
      setGlowOn(false);
      dotRef.current?.style.setProperty('opacity', '0');
      ringRef.current?.style.setProperty('opacity', '0');
    };
    const onEnter = () => {
      dotRef.current?.style.setProperty('opacity', '1');
      ringRef.current?.style.setProperty('opacity', '1');
    };

    const tick = () => {
      // dot snaps to the pointer; ring and glow ease toward it at different rates
      ring.current.x += (pointer.current.x - ring.current.x) * 0.18;
      ring.current.y += (pointer.current.y - ring.current.y) * 0.18;
      glow.current.x += (pointer.current.x - glow.current.x) * 0.1;
      glow.current.y += (pointer.current.y - glow.current.y) * 0.1;

      if (dotRef.current)
        dotRef.current.style.transform = `translate3d(${pointer.current.x}px, ${pointer.current.y}px, 0) translate(-50%, -50%)`;
      if (ringRef.current)
        ringRef.current.style.transform = `translate3d(${ring.current.x}px, ${ring.current.y}px, 0) translate(-50%, -50%)`;
      if (glowRef.current)
        glowRef.current.style.transform = `translate3d(${glow.current.x}px, ${glow.current.y}px, 0) translate(-50%, -50%)`;
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
      <div ref={ringRef} aria-hidden className="cursor-ring" />
      <div ref={dotRef} aria-hidden className="cursor-dot" />
    </>
  );
}
