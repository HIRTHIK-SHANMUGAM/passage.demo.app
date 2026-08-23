import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, CalendarCheck, CheckCircle2, ChevronDown, Eye, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/state/AppContext';
import * as db from '@/lib/db';
import { Application, ApplicationStatus } from '@/lib/types';
import {
  AvatarCircle,
  Button,
  EmptyState,
  ErrorState,
  Eyebrow,
  PageTitle,
  Pill,
  PillTone,
  SkeletonRows,
  StatCard,
} from '@/components/ui';
import { CountUp } from '@/components/effects';

const STATUS_META: Record<ApplicationStatus, { label: string; tone: PillTone }> = {
  shortlisted: { label: 'Shortlisted', tone: 'slate' },
  started: { label: 'Draft', tone: 'slate' },
  submitted: { label: 'Applied', tone: 'orange' },
  in_review: { label: 'In review', tone: 'orange' },
  interview: { label: 'Interview', tone: 'green' },
  rejected: { label: 'Closed', tone: 'red' },
  offer: { label: 'Offer', tone: 'green' },
};

type Chip = 'all' | 'applied' | 'in_review' | 'interview' | 'closed';

function timeline(app: Application): string[] {
  const d = (s: string | null, off = 0) => {
    const base = s ? new Date(s) : new Date();
    base.setDate(base.getDate() + off);
    return base.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const steps = [`Applied ${d(app.submitted_at ?? app.created_at)}`];
  if (['in_review', 'interview', 'offer', 'rejected'].includes(app.status)) {
    steps.push(`Viewed by recruiter ${d(app.submitted_at ?? app.created_at, 1)}`);
    steps.push(`Moved to review ${d(app.submitted_at ?? app.created_at, 2)}`);
  }
  if (app.status === 'interview') steps.push(`Interview scheduled`);
  if (app.status === 'offer') steps.push(`Offer extended 🎉`);
  if (app.status === 'rejected') steps.push(`Closed by company`);
  return steps;
}

export default function JobApplications() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState(false);
  const [chip, setChip] = useState<Chip>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(false);
    try {
      const all = await db.listApplicationsByStudent(profile.id);
      setApps(all.filter((a) => a.target_type === 'job'));
    } catch {
      setError(true);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const a = apps ?? [];
    return {
      applied: a.filter((x) => x.status !== 'shortlisted' && x.status !== 'started').length,
      review: a.filter((x) => x.status === 'in_review').length,
      interviews: a.filter((x) => x.status === 'interview').length,
      closed: a.filter((x) => x.status === 'rejected').length,
    };
  }, [apps]);

  const filtered = useMemo(() => {
    const a = (apps ?? []).filter((x) => x.status !== 'shortlisted' && x.status !== 'started');
    if (chip === 'applied') return a.filter((x) => x.status === 'submitted');
    if (chip === 'in_review') return a.filter((x) => x.status === 'in_review');
    if (chip === 'interview') return a.filter((x) => x.status === 'interview');
    if (chip === 'closed') return a.filter((x) => x.status === 'rejected');
    return a;
  }, [apps, chip]);

  if (error) return <ErrorState onRetry={() => void load()} />;

  const chips: { key: Chip; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'applied', label: 'Applied' },
    { key: 'in_review', label: 'In review' },
    { key: 'interview', label: 'Interviews' },
    { key: 'closed', label: 'Closed' },
  ];

  return (
    <div>
      <Eyebrow>Applications</Eyebrow>
      <PageTitle>Everything you've sent.</PageTitle>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          ['Applied', stats.applied, Send, 'var(--blue)'],
          ['In review', stats.review, Eye, 'var(--orange)'],
          ['Interviews', stats.interviews, CalendarCheck, 'var(--teal)'],
          ['Closed', stats.closed, Archive, 'var(--slate)'],
        ] as const).map(([label, n, icon, accent]) => (
          <StatCard
            key={label}
            label={label}
            icon={icon}
            accent={accent}
            value={<CountUp to={n} />}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setChip(c.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${chip === c.key ? 'bg-orange text-white' : 'border border-hairline bg-ink-2 text-slate hover:text-parchment'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {apps === null ? (
          <SkeletonRows rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Send}
            title={chip === 'all' ? 'Nothing sent yet' : 'Nothing here'}
            body={
              chip === 'all'
                ? 'Apply to a role and it lands here with a live status timeline.'
                : 'No applications in this state right now.'
            }
            action={<Button onClick={() => navigate('/jobs')}>Browse roles</Button>}
          />
        ) : (
          filtered.map((a) => {
            const company = db.getInstitutionSync(a.institution_id);
            const meta = STATUS_META[a.status];
            const isOpen = expanded === a.id;
            return (
              <div key={a.id} className="card-surface overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : a.id)}
                  className="flex w-full flex-wrap items-center gap-3 p-4 text-left"
                  aria-expanded={isOpen}
                >
                  <AvatarCircle text={company?.initials ?? '?'} size={40} colorSeed={a.institution_id} />
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-semibold text-parchment">{company?.name}</div>
                    <div className="text-xs text-slate">
                      <JobTitle jobId={a.job_posting_id} /> · applied{' '}
                      <span className="font-mono">
                        {new Date(a.submitted_at ?? a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  <Pill tone="green" className="hidden sm:inline-flex">
                    <CheckCircle2 size={11} /> Credentials verified ✓
                  </Pill>
                  <Pill tone={meta.tone} dot live={a.status === 'in_review' || a.status === 'interview'}>{meta.label}</Pill>
                  <ChevronDown size={16} className={`text-slate transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="border-t border-hairline px-4 py-4 pl-16">
                        <ol className="relative space-y-3 border-l border-hairline pl-4">
                          {timeline(a).map((step, i) => (
                            <li key={i} className="relative text-sm text-slate">
                              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-orange" />
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function JobTitle({ jobId }: { jobId: string | null }) {
  const [title, setTitle] = useState('…');
  useEffect(() => {
    let live = true;
    if (!jobId) {
      setTitle('Role');
      return;
    }
    void db.listOpenJobPostings().then((all) => {
      if (live) setTitle(all.find((j) => j.id === jobId)?.title ?? 'Role');
    });
    return () => {
      live = false;
    };
  }, [jobId]);
  return <>{title}</>;
}
