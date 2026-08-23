/**
 * A dynamic, bordered match card with an animated conic-gradient ring and a
 * counting percentage. Colour follows value: >=85 green, 70-84 orange,
 * <70 slate — matching the app's match-percentage semantics.
 */
import { CountUp } from '@/components/effects';

function ringColor(pct: number): string {
  if (pct >= 85) return 'var(--green)';
  if (pct >= 70) return 'var(--orange)';
  return 'var(--slate)';
}

export function MatchRing({ pct, size = 60 }: { pct: number; size?: number }) {
  const color = ringColor(pct);
  return (
    <div
      className="match-ring"
      style={
        {
          width: size,
          height: size,
          ['--pct' as string]: String(pct),
          ['--ring' as string]: color,
        } as React.CSSProperties
      }
    >
      <span className="match-num text-sm" style={{ color }}>
        <CountUp to={pct} />%
      </span>
    </div>
  );
}

/** The full bordered "Your match" callout card used in job/applicant detail. */
export function MatchCard({ pct, reason }: { pct: number; reason: string }) {
  const color = ringColor(pct);
  return (
    <div
      className="card-surface flex items-center gap-4 p-4"
      style={{ borderColor: `color-mix(in srgb, ${color} 40%, transparent)` }}
    >
      <MatchRing pct={pct} size={64} />
      <div className="min-w-0">
        <div className="text-sm font-semibold" style={{ color }}>
          Your match
        </div>
        <div className="text-xs text-slate">{reason}</div>
      </div>
    </div>
  );
}
