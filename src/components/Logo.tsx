interface MarkProps {
  size?: number;
  className?: string;
}

/** The Passage mark: an archway in thin orange line work — a door within a
 *  portal, a sparkle at the threshold, steps rising toward the viewer,
 *  enclosed by a partial circle open at the bottom. */
export function LogoMark({ size = 40, className = '' }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g stroke="var(--orange)" strokeWidth={1.8} strokeLinecap="round">
        {/* enclosing partial circle, open at the bottom */}
        <path d="M 8.5 44 A 25.5 25.5 0 1 1 55.5 44" />
        <circle cx="8.5" cy="44" r="1.5" fill="var(--orange)" stroke="none" />
        <circle cx="55.5" cy="44" r="1.5" fill="var(--orange)" stroke="none" />
        {/* outer arch */}
        <path d="M 22 47 L 22 30 A 10 10 0 0 1 42 30 L 42 47" />
        {/* inner arch — a door within the portal */}
        <path d="M 26 47 L 26 31 A 6 6 0 0 1 38 31 L 38 47" strokeWidth={1.2} />
        {/* sparkle at the threshold */}
        <path
          className="logo-sparkle"
          d="M 32 37.5 l 1.3 2.7 l 2.7 1.3 l -2.7 1.3 l -1.3 2.7 l -1.3 -2.7 l -2.7 -1.3 l 2.7 -1.3 z"
          fill="var(--orange)"
          stroke="none"
        />
        {/* steps in perspective, widening toward the viewer */}
        <path d="M 25 51 h 14" strokeWidth={1.6} />
        <path d="M 21.5 55 h 21" strokeWidth={1.6} />
        <path d="M 18 59 h 28" strokeWidth={1.6} />
      </g>
    </svg>
  );
}

export function LogoWordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-display font-semibold text-orange tracking-wide ${className}`}
      style={{ letterSpacing: '0.02em' }}
    >
      Passage
    </span>
  );
}

interface FullProps {
  markSize?: number;
  tagline?: boolean;
  className?: string;
}

export function LogoFull({ markSize = 34, tagline = false, className = '' }: FullProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <LogoMark size={markSize} />
      {/* thin vertical divider with a sparkle at its midpoint */}
      <svg width="10" height={markSize + 6} viewBox="0 0 10 44" fill="none" aria-hidden="true">
        <line x1="5" y1="2" x2="5" y2="17" stroke="var(--orange)" strokeWidth="1" opacity="0.7" />
        <path className="logo-sparkle" d="M 5 19 l 1.2 2.5 l 2.5 1.2 l -2.5 1.2 l -1.2 2.5 l -1.2 -2.5 l -2.5 -1.2 l 2.5 -1.2 z" fill="var(--orange)" />
        <line x1="5" y1="28" x2="5" y2="42" stroke="var(--orange)" strokeWidth="1" opacity="0.7" />
      </svg>
      <div>
        <LogoWordmark className="text-xl leading-none" />
        {tagline && (
          <div className="mt-1 font-body text-[9px] uppercase tracking-[0.22em] text-slate">
            Your records. Your access. Verified instantly.
          </div>
        )}
      </div>
    </div>
  );
}
