import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import * as db from '@/lib/db';
import { Program } from '@/lib/types';
import {
  Button,
  EmptyState,
  ErrorState,
  Eyebrow,
  PageTitle,
  Pill,
  PillTone,
  SkeletonRows,
  useToast,
} from '@/components/ui';

interface ExamInfo {
  code: string;
  fullName: string;
  nextDate: string;
  regDeadline: string;
  score?: string;
}

const EXAM_CATALOG: Record<string, ExamInfo> = {
  GRE: { code: 'GRE', fullName: 'Graduate Record Examination', nextDate: '2026-10-12', regDeadline: '2026-09-20' },
  IELTS: { code: 'IELTS', fullName: 'International English Language Testing System', nextDate: '2026-09-28', regDeadline: '2026-09-10' },
  TOEFL: { code: 'TOEFL', fullName: 'Test of English as a Foreign Language', nextDate: '2026-10-05', regDeadline: '2026-09-15' },
  GATE: { code: 'GATE', fullName: 'Graduate Aptitude Test in Engineering', nextDate: '2027-02-07', regDeadline: '2026-10-03' },
};

type ExamStatus = 'not_registered' | 'registered' | 'scheduled' | 'completed';

const STATUS_META: Record<ExamStatus, { label: string; tone: PillTone }> = {
  not_registered: { label: 'Not registered', tone: 'slate' },
  registered: { label: 'Registered', tone: 'orange' },
  scheduled: { label: 'Scheduled', tone: 'orange' },
  completed: { label: 'Completed', tone: 'green' },
};

const STATUS_KEY = 'passage.exam-status.v1';

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

export default function Exams() {
  const { profile } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [shortlistedPrograms, setShortlistedPrograms] = useState<Program[]>([]);
  const [error, setError] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, ExamStatus>>(() => {
    try {
      return JSON.parse(localStorage.getItem(STATUS_KEY) ?? '{}');
    } catch {
      return {};
    }
  });
  const [attached, setAttached] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!profile) return;
    setError(false);
    try {
      const [allPrograms, apps] = await Promise.all([
        db.listAllPrograms(),
        db.listApplicationsByStudent(profile.id),
      ]);
      setPrograms(allPrograms);
      const ids = new Set(apps.filter((a) => a.program_id).map((a) => a.program_id!));
      setShortlistedPrograms(allPrograms.filter((p) => ids.has(p.id)));
    } catch {
      setError(true);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  function setStatus(exam: string, s: ExamStatus) {
    setStatuses((prev) => {
      const next = { ...prev, [exam]: s };
      try {
        localStorage.setItem(STATUS_KEY, JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }

  const requiredExams = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of shortlistedPrograms) {
      for (const e of p.required_exams) {
        const uni = db.getInstitutionSync(p.institution_id)?.name ?? '';
        const arr = map.get(e) ?? [];
        if (!arr.includes(uni)) arr.push(uni);
        map.set(e, arr);
      }
    }
    return map;
  }, [shortlistedPrograms]);

  const tightExam = useMemo(() => {
    const deadlines = shortlistedPrograms.map((p) => new Date(p.deadline).getTime());
    const earliest = deadlines.length ? Math.min(...deadlines) : null;
    if (!earliest) return null;
    for (const [code] of requiredExams) {
      const info = EXAM_CATALOG[code];
      if (!info) continue;
      const gap = (earliest - new Date(info.nextDate).getTime()) / 86400000;
      if (gap > 0 && gap < 70 && (statuses[code] ?? 'not_registered') !== 'completed') {
        return { code, weeks: Math.round(gap / 7) };
      }
    }
    return null;
  }, [requiredExams, shortlistedPrograms, statuses]);

  if (error) return <ErrorState onRetry={() => void load()} />;

  return (
    <div className="mx-auto max-w-3xl">
      <Eyebrow>Exams</Eyebrow>
      <PageTitle>Exams on your path.</PageTitle>
      <p className="mt-2 text-sm text-slate">Every exam your shortlisted universities require, with dates that matter.</p>

      {tightExam && (
        <div className="mt-6 flex items-start gap-2 rounded-card border border-amber/30 bg-amber/10 p-3 text-sm text-parchment">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber" />
          {tightExam.code} sits about {tightExam.weeks} weeks before your earliest application deadline — book it now
          or the schedule stops being workable.
        </div>
      )}

      <div className="mt-6 space-y-4">
        {programs === null ? (
          <SkeletonRows rows={3} />
        ) : requiredExams.size === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No exams required yet"
            body="Shortlist universities first — their exam requirements appear here with dates and deadlines."
            action={<Button onClick={() => navigate('/studies')}>Browse universities</Button>}
          />
        ) : (
          [...requiredExams.entries()].map(([code, unis]) => {
            const info = EXAM_CATALOG[code];
            if (!info) return null;
            const status = statuses[code] ?? 'not_registered';
            const meta = STATUS_META[status];
            const regDays = daysUntil(info.regDeadline);
            return (
              <div key={code} className="card-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xl font-semibold text-parchment">{code}</span>
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </div>
                    <div className="text-xs text-slate">{info.fullName}</div>
                  </div>
                  {status !== 'completed' && regDays > 0 && (
                    <span className={`text-xs font-medium ${regDays <= 21 ? 'text-orange' : 'text-slate'}`}>
                      Registration closes in {regDays} days
                    </span>
                  )}
                </div>

                <div className="mt-3 font-mono text-xs text-slate">
                  next test {new Date(info.nextDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · register by{' '}
                  {new Date(info.regDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="mt-2 text-xs text-slate">
                  Required by: <span className="text-parchment">{unis.join(', ')}</span>
                </div>

                {status === 'completed' ? (
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <span className="font-mono text-sm text-parchment">
                      Score: {code === 'GRE' ? '326' : code === 'IELTS' ? '8.0' : code === 'TOEFL' ? '112' : 'AIR 412'}
                    </span>
                    <button
                      onClick={() => {
                        setAttached((a) => ({ ...a, [code]: !a[code] }));
                        toast(attached[code] ? `${code} score detached` : `${code} score attached to your applications`);
                      }}
                      role="switch"
                      aria-checked={!!attached[code]}
                      className="flex items-center gap-2 text-xs text-slate hover:text-parchment"
                    >
                      Attach to applications
                      <span className={`relative h-5 w-9 rounded-full transition-colors ${attached[code] ? 'bg-green' : 'border border-hairline bg-ink-3'}`}>
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-parchment transition-all ${attached[code] ? 'left-[18px]' : 'left-0.5'}`} />
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex gap-2">
                    {status === 'not_registered' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setStatus(code, 'registered');
                          toast(`Registered for ${code} — ${new Date(info.nextDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);
                        }}
                      >
                        Register
                      </Button>
                    )}
                    {status === 'registered' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setStatus(code, 'scheduled');
                          toast(`${code} slot confirmed`);
                        }}
                      >
                        Confirm slot
                      </Button>
                    )}
                    {status === 'scheduled' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setStatus(code, 'completed');
                          toast(`${code} marked completed`);
                        }}
                      >
                        Mark completed
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => toast(`Prep reminder set for ${code}`)}
                    >
                      Add prep reminder
                    </Button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
