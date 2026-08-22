import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, GraduationCap, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import * as db from '@/lib/db';
import { Application, Institution, Program } from '@/lib/types';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  Pill,
  Skeleton,
  useToast,
} from '@/components/ui';

const TUITION_MAX = 65;
const EXAMS = ['GRE', 'GATE', 'IELTS', 'TOEFL', 'None'];

interface Filters {
  countries: string[];
  field: string;
  degreeLevel: 'All' | 'Masters' | 'PhD';
  tuition: [number, number];
  exams: string[];
  deadline: 'any' | '3m' | '6m';
  intake: string;
}

const DEFAULT_FILTERS: Filters = {
  countries: [],
  field: '',
  degreeLevel: 'All',
  tuition: [0, TUITION_MAX],
  exams: [],
  deadline: 'any',
  intake: '',
};

function DualRange({
  value,
  onChange,
}: {
  value: [number, number];
  onChange: (v: [number, number]) => void;
}) {
  const [lo, hi] = value;
  const pct = (v: number) => (v / TUITION_MAX) * 100;
  return (
    <div>
      <div className="relative h-5">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-ink-3" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-orange"
          style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }}
        />
        <input
          type="range"
          className="dual-thumb"
          min={0}
          max={TUITION_MAX}
          step={1}
          value={lo}
          aria-label="Minimum tuition"
          onChange={(e) => onChange([Math.min(parseInt(e.target.value), hi - 1), hi])}
          style={{ zIndex: lo > TUITION_MAX - 10 ? 5 : 3 }}
        />
        <input
          type="range"
          className="dual-thumb"
          min={0}
          max={TUITION_MAX}
          step={1}
          value={hi}
          aria-label="Maximum tuition"
          onChange={(e) => onChange([lo, Math.max(parseInt(e.target.value), lo + 1)])}
          style={{ zIndex: 4 }}
        />
      </div>
      <div className="mt-2 text-center font-mono text-xs text-slate">
        ₹{lo}L – ₹{hi}L
      </div>
    </div>
  );
}

function tierMeta(tier: Program['acceptance_tier']) {
  if (tier === 'reach') return { label: 'Reach', color: 'bg-amber', text: 'text-amber', w: '32%' };
  if (tier === 'target') return { label: 'Target', color: 'bg-orange', text: 'text-orange', w: '62%' };
  return { label: 'Safe', color: 'bg-green', text: 'text-green', w: '88%' };
}

function DetailModal({
  program,
  uni,
  onClose,
  onStart,
}: {
  program: Program;
  uni: Institution;
  onClose: () => void;
  onStart: () => void;
}) {
  const { profile } = useApp();
  const daysLeft = Math.max(0, Math.ceil((new Date(program.deadline).getTime() - Date.now()) / 86400000));
  const meetsCgpa = (profile?.cgpa ?? 0) >= 8;
  const requirements: { label: string; met: boolean }[] = [
    { label: 'Bachelor degree in a related field', met: true },
    { label: 'CGPA above 8.0 / 10', met: meetsCgpa },
    ...program.required_exams.map((e) => ({ label: `${e} score`, met: false })),
    { label: 'Statement of purpose', met: false },
  ];
  return (
    <Modal open onClose={onClose} wide labelledBy="prog-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="prog-title" className="font-display text-2xl text-parchment">{program.name}</h2>
          <p className="text-sm text-slate">{uni.name} · {uni.country} · QS #{program.qs_rank}</p>
        </div>
        <div className="shrink-0 rounded-card border border-orange/30 bg-orange/10 px-3 py-2 text-center">
          <div className="font-display text-lg font-semibold text-orange">{daysLeft}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate">days left</div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate">{program.description}</p>

      <h3 className="mt-5 mb-2 font-display text-base font-semibold text-parchment">Curriculum highlights</h3>
      <ul className="list-inside list-disc space-y-1 text-sm text-slate">
        {program.curriculum.map((c) => <li key={c}>{c}</li>)}
      </ul>

      <h3 className="mt-5 mb-2 font-display text-base font-semibold text-parchment">Admission requirements</h3>
      <div className="space-y-1.5">
        {requirements.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-sm">
            {r.met ? (
              <Check size={15} className="shrink-0 text-green" />
            ) : (
              <span className="shrink-0 rounded-full border border-orange/40 px-1.5 text-[10px] font-medium text-orange">Gap</span>
            )}
            <span className={r.met ? 'text-parchment' : 'text-slate'}>{r.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-card border border-hairline bg-ink-3/40 p-3 font-mono text-xs text-slate">
        Tuition: ₹{program.tuition_lakhs}L total · Duration: {program.duration_years} yrs · Intake: {program.intake}
        <div className="mt-1 font-body text-slate-2">
          {program.tuition_lakhs <= 5
            ? 'Public funding keeps tuition near zero — living costs are the real budget line.'
            : 'Assistantships and department scholarships can offset a meaningful share.'}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        <Button onClick={onStart}>Start application</Button>
      </div>
    </Modal>
  );
}

export default function Universities() {
  const { profile } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [myApps, setMyApps] = useState<Application[]>([]);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<Program | null>(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [list, apps] = await Promise.all([
        db.listAllPrograms(),
        profile ? db.listApplicationsByStudent(profile.id) : Promise.resolve([]),
      ]);
      setPrograms(list);
      setMyApps(apps);
    } catch {
      setError(true);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const countries = useMemo(
    () => [...new Set((programs ?? []).map((p) => db.getInstitutionSync(p.institution_id)?.country ?? ''))].filter(Boolean).sort(),
    [programs],
  );
  const fields = useMemo(() => [...new Set((programs ?? []).map((p) => p.field))].sort(), [programs]);

  const filtered = useMemo(() => {
    return (programs ?? []).filter((p) => {
      const uni = db.getInstitutionSync(p.institution_id);
      if (!uni) return false;
      if (filters.countries.length && !filters.countries.includes(uni.country)) return false;
      if (filters.field && p.field !== filters.field) return false;
      if (filters.degreeLevel !== 'All' && p.degree_level !== filters.degreeLevel) return false;
      if (p.tuition_lakhs < filters.tuition[0] || p.tuition_lakhs > filters.tuition[1]) return false;
      if (filters.exams.length) {
        const wantNone = filters.exams.includes('None');
        const named = filters.exams.filter((e) => e !== 'None');
        const hasNamed = named.some((e) => p.required_exams.includes(e));
        const hasNone = wantNone && p.required_exams.length === 0;
        if (!hasNamed && !hasNone) return false;
      }
      if (filters.deadline !== 'any') {
        const months = filters.deadline === '3m' ? 3 : 6;
        const limit = Date.now() + months * 30 * 86400000;
        if (new Date(p.deadline).getTime() > limit) return false;
      }
      if (filters.intake && p.intake !== filters.intake) return false;
      return true;
    });
  }, [programs, filters]);

  const shortlistedProgramIds = useMemo(
    () => new Set(myApps.filter((a) => a.program_id).map((a) => a.program_id!)),
    [myApps],
  );

  async function toggleShortlist(p: Program) {
    if (!profile) return;
    if (shortlistedProgramIds.has(p.id)) {
      toast('Already on your list — see Applications');
      return;
    }
    await db.createApplication(profile.id, { type: 'program', program: p }, 'shortlisted');
    setMyApps(await db.listApplicationsByStudent(profile.id));
    toast(`${db.getInstitutionSync(p.institution_id)?.name} added to your shortlist`);
  }

  if (error) return <ErrorState onRetry={() => void load()} />;

  const sidebar = (
    <div className="space-y-6">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate">Country</div>
        <div className="space-y-1">
          {countries.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2 text-sm text-parchment">
              <input
                type="checkbox"
                checked={filters.countries.includes(c)}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    countries: e.target.checked ? [...f.countries, c] : f.countries.filter((x) => x !== c),
                  }))
                }
                className="h-3.5 w-3.5 accent-[#E75C2B]"
              />
              {c}
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate">Field</div>
        <select
          value={filters.field}
          onChange={(e) => setFilters((f) => ({ ...f, field: e.target.value }))}
          className="w-full rounded-btn border border-hairline bg-ink-3 px-2.5 py-1.5 text-sm text-parchment"
        >
          <option value="">All fields</option>
          {fields.map((f) => <option key={f}>{f}</option>)}
        </select>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate">Degree level</div>
        <div className="flex rounded-btn border border-hairline bg-ink-3 p-0.5">
          {(['All', 'Masters', 'PhD'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilters((f) => ({ ...f, degreeLevel: lvl }))}
              className={`flex-1 rounded-[8px] px-2 py-1 text-xs font-medium transition-colors ${filters.degreeLevel === lvl ? 'bg-orange text-white' : 'text-slate hover:text-parchment'}`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate">Tuition (total)</div>
        <DualRange value={filters.tuition} onChange={(t) => setFilters((f) => ({ ...f, tuition: t }))} />
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate">Required exams</div>
        <div className="space-y-1">
          {EXAMS.map((e) => (
            <label key={e} className="flex cursor-pointer items-center gap-2 text-sm text-parchment">
              <input
                type="checkbox"
                checked={filters.exams.includes(e)}
                onChange={(ev) =>
                  setFilters((f) => ({
                    ...f,
                    exams: ev.target.checked ? [...f.exams, e] : f.exams.filter((x) => x !== e),
                  }))
                }
                className="h-3.5 w-3.5 accent-[#E75C2B]"
              />
              {e}
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate">Deadline window</div>
        <select
          value={filters.deadline}
          onChange={(e) => setFilters((f) => ({ ...f, deadline: e.target.value as Filters['deadline'] }))}
          className="w-full rounded-btn border border-hairline bg-ink-3 px-2.5 py-1.5 text-sm text-parchment"
        >
          <option value="any">Any deadline</option>
          <option value="3m">Next 3 months</option>
          <option value="6m">Next 6 months</option>
        </select>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate">Intake</div>
        <select
          value={filters.intake}
          onChange={(e) => setFilters((f) => ({ ...f, intake: e.target.value }))}
          className="w-full rounded-btn border border-hairline bg-ink-3 px-2.5 py-1.5 text-sm text-parchment"
        >
          <option value="">Any intake</option>
          <option>Fall 2027</option>
        </select>
      </div>

      <button
        onClick={() => setFilters(DEFAULT_FILTERS)}
        className="text-xs text-slate underline-offset-2 hover:text-parchment hover:underline"
      >
        Reset filters
      </button>
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-parchment md:text-4xl">Where next?</h1>
          <p className="mt-2 text-sm text-slate">
            {programs === null ? 'Loading programs…' : `${filtered.length} program${filtered.length === 1 ? '' : 's'} match your filters`}
          </p>
        </div>
        <Button variant="secondary" className="lg:hidden" onClick={() => setDrawerOpen(true)}>
          <SlidersHorizontal size={14} /> Filters
        </Button>
      </div>

      <div className="mt-6 flex gap-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="card-surface sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto p-5 thin-scroll">{sidebar}</div>
        </aside>

        <div className="min-w-0 flex-1">
          {programs === null ? (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card-surface space-y-3 p-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-11 w-11 rounded-full" />
                    <Skeleton className="h-5 w-40" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No programs match"
              body="Your filters are strict — widen the tuition range or drop an exam requirement."
              action={<Button variant="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {filtered.map((p, idx) => {
                const uni = db.getInstitutionSync(p.institution_id)!;
                const tier = tierMeta(p.acceptance_tier);
                const onList = shortlistedProgramIds.has(p.id);
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.05, 0.4), duration: 0.3 }}
                  >
                  <Card hover className="flex h-full flex-col p-5">
                    <div className="flex items-center gap-3">
                      <div className="seal-circle flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-orange/40 font-display text-sm font-semibold text-orange">
                        {uni.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-display text-lg font-semibold text-parchment">{uni.name}</div>
                        <div className="text-xs text-slate">{uni.country} · QS #{p.qs_rank}</div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm font-medium text-parchment">{p.name}</div>
                    <div className="mt-1.5 font-mono text-xs text-slate">
                      Tuition: ₹{p.tuition_lakhs}L · Deadline:{' '}
                      {new Date(p.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · Duration: {p.duration_years} yrs
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.required_exams.length === 0 ? (
                        <Pill tone="slate">No exams</Pill>
                      ) : (
                        p.required_exams.map((e) => <Pill key={e} tone="outline">{e}</Pill>)
                      )}
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate">Acceptance likelihood</span>
                        <span className={`font-medium ${tier.text}`}>{tier.label}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-ink-3">
                        <div className={`h-1.5 rounded-full ${tier.color}`} style={{ width: tier.w }} />
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => setDetail(p)}>
                        View details
                      </Button>
                      <Button
                        size="sm"
                        variant={onList ? 'secondary' : 'primary'}
                        className={`flex-1 ${onList ? 'border-green/50 text-green' : ''}`}
                        onClick={() => void toggleShortlist(p)}
                      >
                        {onList ? <><Check size={13} /> Shortlisted</> : 'Add to shortlist'}
                      </Button>
                    </div>
                  </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* mobile filter drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 lg:hidden"
            onClick={(e) => e.target === e.currentTarget && setDrawerOpen(false)}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', duration: 0.4, bounce: 0 }}
              className="h-full w-80 max-w-[85vw] overflow-y-auto border-r border-hairline bg-ink-2 p-5 thin-scroll"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-display text-lg text-parchment">Filters</span>
                <button aria-label="Close filters" onClick={() => setDrawerOpen(false)} className="text-slate hover:text-parchment">
                  <X size={18} />
                </button>
              </div>
              {sidebar}
              <Button className="mt-6 w-full" onClick={() => setDrawerOpen(false)}>
                Show {filtered.length} programs
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {detail && (
        <DetailModal
          program={detail}
          uni={db.getInstitutionSync(detail.institution_id)!}
          onClose={() => setDetail(null)}
          onStart={() => {
            setDetail(null);
            navigate(`/studies/apply/${detail.id}`);
          }}
        />
      )}

      {programs !== null && filtered.length > 0 && (
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-2">
          <GraduationCap size={13} /> Acceptance tiers are estimates from admitted-student profiles, not guarantees.
        </div>
      )}
    </div>
  );
}
