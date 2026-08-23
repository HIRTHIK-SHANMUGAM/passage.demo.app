import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronDown,
  Search,
  SearchX,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '@/state/AppContext';
import * as db from '@/lib/db';
import { Application, JobPosting } from '@/lib/types';
import { MatchCard, MatchRing } from '@/components/MatchRing';
import {
  AvatarCircle,
  Button,
  EmptyState,
  ErrorState,
  Modal,
  Pill,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/ui';

type SortKey = 'recent' | 'match' | 'salary';

interface FilterState {
  roleTypes: string[];
  experience: string[];
  locations: string[];
  salaryBands: string[];
  remote: string[];
  posted: string[];
}

const EMPTY_FILTERS: FilterState = {
  roleTypes: [],
  experience: [],
  locations: [],
  salaryBands: [],
  remote: [],
  posted: [],
};

const FILTER_DEFS: { key: keyof FilterState; label: string; options: string[] }[] = [
  { key: 'roleTypes', label: 'Role type', options: ['Full-time', 'Internship', 'Contract'] },
  { key: 'experience', label: 'Experience', options: ['Entry level', 'Mid', 'Senior'] },
  { key: 'locations', label: 'Location', options: ['Bengaluru', 'Chennai', 'Mumbai'] },
  { key: 'salaryBands', label: 'Salary', options: ['Under ₹12 LPA', '₹12–20 LPA', '₹20–30 LPA', '₹30+ LPA'] },
  { key: 'remote', label: 'Remote', options: ['Remote', 'Hybrid', 'Onsite'] },
  { key: 'posted', label: 'Posted date', options: ['Last 7 days', 'Last 14 days', 'Last 30 days'] },
];

function matchesSalary(j: JobPosting, band: string): boolean {
  const mid = (j.salary_min + j.salary_max) / 2;
  if (band === 'Under ₹12 LPA') return mid < 12;
  if (band === '₹12–20 LPA') return mid >= 12 && mid < 20;
  if (band === '₹20–30 LPA') return mid >= 20 && mid < 30;
  return mid >= 30;
}

function matchesPosted(j: JobPosting, opt: string): boolean {
  const days = (Date.now() - new Date(j.posted_at).getTime()) / 86400000;
  if (opt === 'Last 7 days') return days <= 7;
  if (opt === 'Last 14 days') return days <= 14;
  return days <= 30;
}

function matchPctFor(j: JobPosting): number {
  let h = 0;
  for (let i = 0; i < j.id.length; i++) h = (h * 33 + j.id.charCodeAt(i)) >>> 0;
  return 58 + (h % 38);
}

function postedLabel(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function FilterChipDropdown({
  def,
  active,
  onToggle,
}: {
  def: (typeof FILTER_DEFS)[number];
  active: string[];
  onToggle: (option: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const isActive = active.length > 0;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${isActive ? 'bg-orange text-white' : 'border border-hairline bg-ink-2 text-slate hover:text-parchment'}`}
      >
        {def.label}
        {isActive && ` (${active.length})`}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 z-30 mt-2 w-48 rounded-card border border-hairline bg-ink-2 py-1 shadow-[0_12px_32px_rgba(22,35,63,0.16)]"
          >
            {def.options.map((o) => (
              <label key={o} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-parchment hover:bg-ink-3">
                <input
                  type="checkbox"
                  checked={active.includes(o)}
                  onChange={() => onToggle(o)}
                  className="h-3.5 w-3.5 accent-[#E75C2B]"
                />
                {o}
              </label>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ApplyModal({
  job,
  onClose,
  onApplied,
}: {
  job: JobPosting;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { profile } = useApp();
  const toast = useToast();
  const [resume, setResume] = useState('Hirthik_Resume_2026.pdf');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const company = db.getInstitutionSync(job.institution_id);

  async function submit() {
    if (busy || !profile) return;
    setBusy(true);
    try {
      await db.createApplication(profile.id, { type: 'job', posting: job }, 'submitted', { cover_note: note });
      setDone(true);
      onApplied();
      setTimeout(() => {
        toast('Application sent — credentials verified and attached');
        onClose();
      }, 900);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="apply-title">
      {done ? (
        <div className="flex flex-col items-center py-8">
          <motion.div
            initial={{ scale: 0.4 }}
            animate={{ scale: [0.4, 1.12, 1] }}
            transition={{ duration: 0.45 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-green"
          >
            <Check size={30} strokeWidth={3} className="text-white" />
          </motion.div>
          <p className="mt-4 font-display text-lg text-parchment">Application sent</p>
        </div>
      ) : (
        <>
          <h2 id="apply-title" className="mb-1 font-display text-xl text-parchment">
            Apply to {company?.name}
          </h2>
          <p className="mb-4 text-sm text-slate">{job.title} · {job.location}</p>

          <div className="mb-3 rounded-card border border-hairline bg-ink-3/40 p-3 text-sm">
            <div className="text-parchment">{profile?.full_name}</div>
            <div className="text-xs text-slate">{profile?.degree} · CGPA <span className="font-mono">{profile?.cgpa}</span></div>
          </div>

          <div className="mb-4 flex items-center gap-2 rounded-card border border-green/30 bg-green/10 p-3 text-sm text-green">
            <ShieldCheck size={16} />
            Credentials attached &amp; verified ✓
          </div>

          <Select label="Resume" value={resume} onChange={(e) => setResume(e.target.value)}>
            <option>Hirthik_Resume_2026.pdf</option>
            <option>Resume_ML_focused.pdf</option>
          </Select>

          <Textarea
            className="mt-4"
            label="Cover note (optional)"
            rows={3}
            placeholder="Anything the recruiter should know?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button loading={busy} onClick={() => void submit()}>Submit application</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

export default function Jobs() {
  const { profile } = useApp();
  const toast = useToast();
  const [jobs, setJobs] = useState<JobPosting[] | null>(null);
  const [myApps, setMyApps] = useState<Application[] | null>(null);
  const [error, setError] = useState(false);
  const [keywordRaw, setKeywordRaw] = useState('');
  const [keyword, setKeyword] = useState('');
  const [locationQ, setLocationQ] = useState('');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('recent');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [applyTarget, setApplyTarget] = useState<JobPosting | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setError(false);
    try {
      const [list, apps] = await Promise.all([
        db.listOpenJobPostings(),
        profile ? db.listApplicationsByStudent(profile.id) : Promise.resolve([]),
      ]);
      setJobs(list);
      setMyApps(apps);
      setSelectedId((s) => s ?? list[0]?.id ?? null);
    } catch {
      setError(true);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  // debounce keyword ~250ms
  useEffect(() => {
    const t = setTimeout(() => setKeyword(keywordRaw), 250);
    return () => clearTimeout(t);
  }, [keywordRaw]);

  const appliedJobIds = useMemo(
    () => new Set((myApps ?? []).filter((a) => a.job_posting_id && a.status !== 'shortlisted').map((a) => a.job_posting_id!)),
    [myApps],
  );

  const filtered = useMemo(() => {
    let out = jobs ?? [];
    const kw = keyword.trim().toLowerCase();
    if (kw) {
      out = out.filter((j) => {
        const company = db.getInstitutionSync(j.institution_id)?.name ?? '';
        return (
          j.title.toLowerCase().includes(kw) ||
          company.toLowerCase().includes(kw) ||
          j.skills.some((s) => s.toLowerCase().includes(kw))
        );
      });
    }
    const loc = locationQ.trim().toLowerCase();
    if (loc) out = out.filter((j) => j.location.toLowerCase().includes(loc));
    // categories AND; options within a category OR
    if (filters.roleTypes.length) out = out.filter((j) => filters.roleTypes.includes(j.employment_type));
    if (filters.experience.length) out = out.filter((j) => filters.experience.includes(j.experience_level));
    if (filters.locations.length) out = out.filter((j) => filters.locations.some((l) => j.location.includes(l)));
    if (filters.salaryBands.length) out = out.filter((j) => filters.salaryBands.some((b) => matchesSalary(j, b)));
    if (filters.remote.length) out = out.filter((j) => filters.remote.includes(j.work_mode));
    if (filters.posted.length) out = out.filter((j) => filters.posted.some((p) => matchesPosted(j, p)));

    if (sort === 'recent') out = [...out].sort((a, b) => b.posted_at.localeCompare(a.posted_at));
    if (sort === 'match') out = [...out].sort((a, b) => matchPctFor(b) - matchPctFor(a));
    if (sort === 'salary') out = [...out].sort((a, b) => b.salary_max - a.salary_max);
    return out;
  }, [jobs, keyword, locationQ, filters, sort]);

  const selected = filtered.find((j) => j.id === selectedId) ?? filtered[0] ?? null;
  const activeCount = Object.values(filters).reduce((n, arr) => n + arr.length, 0);

  function toggleFilter(key: keyof FilterState, option: string) {
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(option) ? f[key].filter((x) => x !== option) : [...f[key], option],
    }));
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS);
    setKeywordRaw('');
    setKeyword('');
    setLocationQ('');
  }

  if (error) return <ErrorState onRetry={() => void load()} />;

  const detailPanel = selected && (
    <div className="card-surface p-6">
      <div className="flex items-start gap-4">
        <AvatarCircle text={db.getInstitutionSync(selected.institution_id)?.initials ?? '?'} size={48} colorSeed={selected.institution_id} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-semibold text-parchment">{selected.title}</h2>
          <p className="text-sm text-slate">
            {db.getInstitutionSync(selected.institution_id)?.name} · {selected.location} · posted {postedLabel(selected.posted_at)}
          </p>
          <p className="mt-1 font-mono text-sm text-slate">
            ₹{selected.salary_min}–{selected.salary_max} {selected.salary_unit === 'LPA' ? 'LPA' : '/month'}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {appliedJobIds.has(selected.id) ? (
          <Button variant="secondary" disabled>
            <Check size={14} className="text-green" /> Applied
          </Button>
        ) : (
          <Button onClick={() => setApplyTarget(selected)}>Apply now</Button>
        )}
        <Button
          variant="secondary"
          onClick={() => {
            setSaved((s) => {
              const n = new Set(s);
              if (n.has(selected.id)) n.delete(selected.id);
              else n.add(selected.id);
              return n;
            });
            toast(saved.has(selected.id) ? 'Removed from saved roles' : 'Role saved');
          }}
        >
          <Bookmark size={14} className={saved.has(selected.id) ? 'fill-current text-orange' : ''} />
          {saved.has(selected.id) ? 'Saved' : 'Save'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(`passage.app/jobs/${selected.id}`).catch(() => {});
            toast('Link copied to clipboard');
          }}
        >
          <Share2 size={14} /> Share
        </Button>
      </div>

      {(() => {
        const pct = matchPctFor(selected);
        return (
          <div className="mt-5">
            <MatchCard
              pct={pct}
              reason={
                pct >= 85
                  ? 'Your stack lines up almost exactly with what they list.'
                  : pct >= 70
                    ? 'Strong overlap on core skills; one or two gaps worth closing.'
                    : 'Some overlap, but expect to explain the gaps.'
              }
            />
          </div>
        );
      })()}

      <section className="mt-6">
        <h3 className="mb-2 font-display text-lg font-semibold text-parchment">About the role</h3>
        <p className="text-sm leading-relaxed text-slate">{selected.description}</p>
      </section>
      <section className="mt-5">
        <h3 className="mb-2 font-display text-lg font-semibold text-parchment">Responsibilities</h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate">
          {selected.responsibilities.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </section>
      <section className="mt-5">
        <h3 className="mb-2 font-display text-lg font-semibold text-parchment">Requirements</h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-slate">
          {selected.requirements.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </section>
      <section className="mt-5">
        <h3 className="mb-2 font-display text-lg font-semibold text-parchment">About the company</h3>
        <p className="text-sm leading-relaxed text-slate">
          {db.getInstitutionSync(selected.institution_id)?.name} is an Indian technology company hiring through
          Passage — every application arrives with cryptographically verified academic records.
        </p>
      </section>
    </div>
  );

  return (
    <div>
      {/* search bar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange" />
          <input
            value={keywordRaw}
            onChange={(e) => setKeywordRaw(e.target.value)}
            placeholder="Role, company or skill"
            className="input-3d w-full rounded-btn py-2.5 pl-9 pr-3 text-sm text-parchment placeholder:text-slate-2 outline-none"
          />
        </div>
        <input
          value={locationQ}
          onChange={(e) => setLocationQ(e.target.value)}
          placeholder="Location"
          className="input-3d rounded-btn px-3 py-2.5 text-sm text-parchment placeholder:text-slate-2 outline-none sm:w-48"
        />
        <Button onClick={() => setKeyword(keywordRaw)}>
          <Search size={14} /> Search
        </Button>
      </div>

      {/* filter chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {FILTER_DEFS.map((def) => (
          <FilterChipDropdown
            key={def.key}
            def={def}
            active={filters[def.key]}
            onToggle={(o) => toggleFilter(def.key, o)}
          />
        ))}
        {activeCount > 0 && (
          <button onClick={clearAll} className="text-xs text-slate underline-offset-2 hover:text-parchment hover:underline">
            Clear all ({activeCount})
          </button>
        )}
      </div>

      {/* count + sort */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-slate">
          {jobs === null ? 'Searching…' : `${filtered.length} role${filtered.length === 1 ? '' : 's'} match your search`}
        </p>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Sort roles"
          className="rounded-btn border border-hairline bg-ink-3 px-2.5 py-1.5 text-xs text-parchment"
        >
          <option value="recent">Most recent</option>
          <option value="match">Best match</option>
          <option value="salary">Highest salary</option>
        </select>
      </div>

      {/* list + detail */}
      <div className="mt-4 flex gap-5">
        <div className={`w-full space-y-3 md:w-[40%] ${mobileDetail ? 'hidden md:block' : ''}`}>
          {jobs === null ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card-surface space-y-2 p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No roles match"
              body="Every filter is applied at once — loosen one and roles reappear."
              action={<Button variant="secondary" onClick={clearAll}>Clear filters</Button>}
            />
          ) : (
            filtered.map((j, idx) => {
              const company = db.getInstitutionSync(j.institution_id);
              const isSel = selected?.id === j.id;
              return (
                <motion.button
                  key={j.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.35), duration: 0.3 }}
                  onClick={() => {
                    setSelectedId(j.id);
                    setMobileDetail(true);
                  }}
                  className={`card-surface block w-full p-4 text-left transition-all ${isSel ? 'border-l-4 border-l-orange bg-ink-3/70' : 'hover:border-hairline-strong'}`}
                >
                  <div className="flex items-start gap-3">
                    <AvatarCircle text={company?.initials ?? '?'} size={36} colorSeed={j.institution_id} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-display text-base font-semibold text-parchment">{j.title}</span>
                        {appliedJobIds.has(j.id) && <Pill tone="green" className="shrink-0">Applied</Pill>}
                      </div>
                      <div className="truncate text-xs text-slate">
                        {company?.name} · {j.location} · {postedLabel(j.posted_at)}
                      </div>
                      <div className="mt-1 font-mono text-xs text-slate">
                        ₹{j.salary_min}–{j.salary_max} {j.salary_unit === 'LPA' ? 'LPA' : '/mo'}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {j.skills.slice(0, 3).map((s) => (
                          <span key={s} className="rounded-full bg-ink-3 px-2 py-0.5 text-[10px] text-slate">{s}</span>
                        ))}
                      </div>
                    </div>
                    <MatchRing pct={matchPctFor(j)} size={46} />
                  </div>
                </motion.button>
              );
            })
          )}
        </div>

        <div className={`min-w-0 flex-1 ${mobileDetail ? '' : 'hidden md:block'}`}>
          {mobileDetail && (
            <button
              onClick={() => setMobileDetail(false)}
              className="mb-3 flex items-center gap-1 text-sm text-slate hover:text-parchment md:hidden"
            >
              <ArrowLeft size={15} /> Back to results
            </button>
          )}
          {jobs === null ? (
            <div className="card-surface space-y-4 p-6">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            detailPanel
          )}
        </div>
      </div>

      {applyTarget && (
        <ApplyModal
          job={applyTarget}
          onClose={() => setApplyTarget(null)}
          onApplied={() => {
            if (profile) void db.listApplicationsByStudent(profile.id).then(setMyApps);
          }}
        />
      )}
    </div>
  );
}
