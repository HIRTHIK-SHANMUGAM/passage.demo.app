/**
 * A soft light that follows the cursor across the page background only.
 *
 * It hides the moment the pointer moves over any real UI — cards, inputs,
 * buttons, nav, modals — so it never competes with content. It sits behind
 * everything (z-index 0) and never intercepts clicks.
 *
 * Design reference: the ambient background lighting used across Uiverse UI
 * kits and Untitled UI marketing sections, tuned down to stay subtle.
 */
import { useEffect, useRef, useState } from 'react';

/** Anything matching these is "real UI" — the glow hides over them. */
const UI_SELECTOR =
  '.card-surface, button, a, input, textarea, select, header, nav, [role="dialog"], [role="menu"], table, canvas, .no-glow';

export default function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // rendered position lags the pointer slightly, which reads as "soft"
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const raf = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // a coarse pointer (touch) has no hover state to speak of
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let seeded = false;

    const onMove = (e: MouseEvent) => {
      const el = e.target as Element | null;
      // Only glow over the page background itself: the moment the pointer is
      // inside a card, control, or any chrome, fade out.
      const overUi = !!el?.closest?.(UI_SELECTOR);
      setVisible(!overUi);
      target.current = { x: e.clientX, y: e.clientY };
      if (!seeded) {
        current.current = { ...target.current };
        seeded = true;
      }
    };

    const onLeave = () => setVisible(false);

    const tick = () => {
      // ease toward the pointer
      current.current.x += (target.current.x - current.current.x) * 0.12;
      current.current.y += (target.current.y - current.current.y) * 0.12;
      const node = ref.current;
      if (node) {
        node.style.transform = `translate3d(${current.current.x}px, ${current.current.y}px, 0) translate(-50%, -50%)`;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="cursor-glow"
      style={{ opacity: visible ? 1 : 0 }}
    />
  );
}
