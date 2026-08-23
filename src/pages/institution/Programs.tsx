import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import * as db from '@/lib/db';
import { Program } from '@/lib/types';
import { EmptyState, ErrorState, Eyebrow, PageTitle, SkeletonRows } from '@/components/ui';

interface ProgramStats {
  applications: number;
  verified: number;
  shortlisted: number;
}

export default function Programs() {
  const { activeInstitution } = useApp();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [stats, setStats] = useState<Record<string, ProgramStats>>({});
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!activeInstitution) return;
    setError(false);
    setPrograms(null);
    try {
      // scoped: only this institution's programs
      const list = await db.listProgramsByInstitution(activeInstitution.id);
      setPrograms(list);
      const applicants = await db.listApplicantsByInstitution(activeInstitution.id, { targetType: 'program' });
      const s: Record<string, ProgramStats> = {};
      for (const p of list) {
        const mine = applicants.filter((a) => a.application.program_id === p.id);
        s[p.id] = {
          applications: mine.length,
          verified: mine.filter((a) => a.verification === 'verified').length,
          shortlisted: mine.filter((a) => Boolean((a.application.documents as Record<string, unknown>).shortlisted_by_institution)).length,
        };
      }
      setStats(s);
    } catch {
      setError(true);
    }
  }, [activeInstitution]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!activeInstitution) return null;

  return (
    <div>
      <Eyebrow>Programs</Eyebrow>
      <PageTitle>{activeInstitution.name} — your programs.</PageTitle>
      <p className="mt-2 text-sm text-slate">Every application arrives with its transcript already checked.</p>

      <div className="mt-8 space-y-3">
        {error ? (
          <ErrorState onRetry={() => void load()} />
        ) : programs === null ? (
          <SkeletonRows rows={3} />
        ) : programs.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No programs listed"
            body={`${activeInstitution.name} has no programs on Passage yet.`}
          />
        ) : (
          programs.map((p) => {
            const s = stats[p.id];
            return (
              <button
                key={p.id}
                onClick={() =>
                  navigate('/admissions/applicants', { state: { programId: p.id, targetName: p.name } })
                }
                className="card-surface flex w-full flex-wrap items-center justify-between gap-3 p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(22,35,63,0.12)]"
              >
                <div>
                  <div className="font-display text-lg font-semibold text-parchment">{p.name}</div>
                  <div className="text-xs text-slate">
                    {p.degree_level} · {p.field} · deadline{' '}
                    <span className="font-mono">{new Date(p.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>
                <div className="font-mono text-xs text-slate">
                  {s ? `${s.applications} applications · ${s.verified} verified · ${s.shortlisted} shortlisted` : '…'}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
