import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, FileText, Loader2, Sparkles, X } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import * as db from '@/lib/db';
import { ShortlistEntry, ShortlistResult, buildShortlist } from '@/lib/ai';
import { Button, Eyebrow, Input, PageTitle, Textarea, useToast } from '@/components/ui';

const STAGES = [
  'Reading your academic profile',
  'Weighing your projects against admitted-student profiles',
  'Checking exam requirements per country',
  'Building your reach / target / safe split',
];

const FIELD_OPTIONS = ['Computer Science', 'AI / ML', 'Data Science', 'Robotics', 'Software Engineering', 'Electrical Eng'];
const EXAM_OPTIONS = ['GRE', 'GATE', 'IELTS', 'TOEFL'];
const COUNTRY_OPTIONS = ['USA', 'Germany', 'UK', 'Singapore', 'Canada', 'India'];

function PillSelect({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (o: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onToggle(o)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selected.includes(o) ? 'border-orange bg-orange/15 text-orange' : 'border-hairline bg-ink-3/50 text-slate hover:text-parchment'}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function TierGroup({
  label,
  entries,
  toneClasses,
}: {
  label: string;
  entries: ShortlistEntry[];
  toneClasses: { border: string; bg: string; text: string };
}) {
  return (
    <div className={`rounded-card border p-5 ${toneClasses.border} ${toneClasses.bg}`}>
      <div className={`mb-3 text-xs font-semibold uppercase tracking-[0.16em] ${toneClasses.text}`}>{label}</div>
      <div className="space-y-3">
        {entries.map((e) => (
          <div key={`${e.university}-${e.program}`}>
            <div className="font-display text-base font-semibold text-parchment">
              {e.university} <span className="font-body text-xs font-normal text-slate">· {e.program}</span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate">{e.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AIShortlist() {
  const { profile } = useApp();
  const toast = useToast();
  const [cgpa, setCgpa] = useState(String(profile?.cgpa ?? ''));
  const [scale, setScale] = useState<'10' | '4'>('10');
  const [degree, setDegree] = useState(profile?.degree ?? '');
  const [fields, setFields] = useState<string[]>(['AI / ML']);
  const [examsTaken, setExamsTaken] = useState<Record<string, string>>({});
  const [countries, setCountries] = useState<string[]>(['Germany', 'USA']);
  const [budget, setBudget] = useState('Up to ₹40L');
  const [projects, setProjects] = useState('');
  const [cv, setCv] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<'form' | 'analysing' | 'done'>('form');
  const [stageIdx, setStageIdx] = useState(-1);
  const [result, setResult] = useState<ShortlistResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const cvRef = useRef<HTMLInputElement>(null);

  const toggle = (list: string[], set: (v: string[]) => void) => (o: string) =>
    set(list.includes(o) ? list.filter((x) => x !== o) : [...list, o]);

  async function build() {
    const errs: Record<string, string> = {};
    const c = parseFloat(cgpa);
    const max = scale === '10' ? 10 : 4;
    if (!cgpa || isNaN(c) || c <= 0 || c > max) errs.cgpa = `Enter a CGPA between 0 and ${max}.`;
    if (!degree.trim()) errs.degree = 'Your degree is required.';
    if (fields.length === 0) errs.fields = 'Pick at least one field.';
    if (countries.length === 0) errs.countries = 'Pick at least one country.';
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setPhase('analysing');
    const work = buildShortlist({ cgpa, scale, degree, fields, examsTaken, countries, budget, projects });
    for (let i = 0; i < STAGES.length; i++) {
      setStageIdx(i);
      await new Promise((r) => setTimeout(r, 520));
    }
    setResult(await work);
    setPhase('done');
    setSaved(false);
  }

  async function saveShortlist() {
    if (!result || !profile || saving) return;
    setSaving(true);
    try {
      const allPrograms = await db.listAllPrograms();
      const existing = await db.listApplicationsByStudent(profile.id);
      const existingIds = new Set(existing.filter((a) => a.program_id).map((a) => a.program_id!));
      const entries = [...result.reach, ...result.target, ...result.safe];
      let added = 0;
      for (const e of entries) {
        const uniName = e.university.toLowerCase();
        const prog = allPrograms.find((p) => {
          const uni = db.getInstitutionSync(p.institution_id);
          return uni && (uni.name.toLowerCase().includes(uniName) || uniName.includes(uni.name.toLowerCase()));
        });
        if (prog && !existingIds.has(prog.id)) {
          await db.createApplication(profile.id, { type: 'program', program: prog }, 'shortlisted');
          existingIds.add(prog.id);
          added++;
        }
      }
      setSaved(true);
      toast(added > 0 ? `${added} universities saved to your applications` : 'Shortlist already saved');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Eyebrow>AI shortlist</Eyebrow>
      <PageTitle>Where should you actually apply?</PageTitle>
      <p className="mt-2 text-sm text-slate">
        Give us your profile. We'll build a realistic list — reaches, targets and safeties — and tell you which exams
        you need.
      </p>

      {phase === 'form' && (
        <div className="card-surface mt-8 space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 text-xs font-medium text-slate">CGPA</div>
              <div className="flex gap-2">
                <input
                  value={cgpa}
                  onChange={(e) => { setCgpa(e.target.value); setErrors((x) => ({ ...x, cgpa: '' })); }}
                  placeholder={scale === '10' ? '9.2' : '3.8'}
                  className={`w-full rounded-btn border bg-ink-3 px-3 py-2 text-sm text-parchment placeholder:text-slate-2 ${errors.cgpa ? 'border-red' : 'border-hairline'}`}
                />
                <div className="flex rounded-btn border border-hairline bg-ink-3 p-0.5">
                  {(['10', '4'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setScale(s)}
                      className={`rounded-[8px] px-2.5 text-xs font-medium ${scale === s ? 'bg-orange text-white' : 'text-slate'}`}
                    >
                      /{s}
                    </button>
                  ))}
                </div>
              </div>
              {errors.cgpa && <p className="mt-1 text-xs text-red">{errors.cgpa}</p>}
            </div>
            <Input
              label="Degree & branch"
              placeholder="B.Tech CSE"
              value={degree}
              onChange={(e) => { setDegree(e.target.value); setErrors((x) => ({ ...x, degree: '' })); }}
              error={errors.degree}
            />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-slate">Fields of interest</div>
            <PillSelect options={FIELD_OPTIONS} selected={fields} onToggle={toggle(fields, setFields)} />
            {errors.fields && <p className="mt-1 text-xs text-red">{errors.fields}</p>}
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-slate">Exams already taken</div>
            <PillSelect
              options={EXAM_OPTIONS}
              selected={Object.keys(examsTaken)}
              onToggle={(o) =>
                setExamsTaken((prev) => {
                  const next = { ...prev };
                  if (o in next) delete next[o];
                  else next[o] = '';
                  return next;
                })
              }
            />
            {Object.keys(examsTaken).length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.keys(examsTaken).map((e) => (
                  <Input
                    key={e}
                    label={`${e} score`}
                    placeholder="Score"
                    value={examsTaken[e]}
                    onChange={(ev) => setExamsTaken((p) => ({ ...p, [e]: ev.target.value }))}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-slate">Target countries</div>
            <PillSelect options={COUNTRY_OPTIONS} selected={countries} onToggle={toggle(countries, setCountries)} />
            {errors.countries && <p className="mt-1 text-xs text-red">{errors.countries}</p>}
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-slate">Budget</div>
            <select
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="w-full rounded-btn border border-hairline bg-ink-3 px-3 py-2 text-sm text-parchment"
            >
              <option>Up to ₹10L</option>
              <option>Up to ₹40L</option>
              <option>Up to ₹70L</option>
              <option>No constraint</option>
            </select>
          </div>

          <Textarea
            label="Projects & portfolio"
            rows={3}
            placeholder="e.g. Built a production PWA with 2k users; a 3D game engine in C++; an LLM-based study assistant…"
            value={projects}
            onChange={(e) => setProjects(e.target.value)}
          />

          <div>
            <div className="mb-1.5 text-xs font-medium text-slate">CV (optional)</div>
            {cv ? (
              <div className="flex items-center gap-2 rounded-btn border border-hairline bg-ink-3/60 px-3 py-2 text-sm text-parchment">
                <FileText size={15} className="text-orange" />
                <span className="min-w-0 flex-1 truncate">{cv.name}</span>
                <button aria-label="Remove CV" onClick={() => setCv(null)} className="text-slate hover:text-parchment">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => cvRef.current?.click()}>
                Attach CV
              </Button>
            )}
            <input ref={cvRef} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => setCv(e.target.files?.[0] ?? null)} />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void build()}>
              <Sparkles size={14} /> Build my shortlist
            </Button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {phase === 'analysing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto mt-12 max-w-md space-y-3">
            {STAGES.map((s, i) => (
              <motion.div
                key={s}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: i <= stageIdx ? 1 : 0.25, x: 0 }}
                className="flex items-center gap-3 text-sm"
              >
                {i < stageIdx ? (
                  <Check size={16} className="text-green" />
                ) : i === stageIdx ? (
                  <Loader2 size={16} className="animate-spin text-orange" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-hairline" />
                )}
                <span className={i <= stageIdx ? 'text-parchment' : 'text-slate-2'}>{s}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {phase === 'done' && result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-6">
          {/* A. honest read */}
          <div className="card-surface p-6">
            <h2 className="mb-3 font-display text-xl font-semibold text-parchment">How we read your profile</h2>
            <p className="text-sm leading-relaxed text-parchment">{result.read}</p>
          </div>

          {/* B. the shortlist */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <TierGroup label="Reach" entries={result.reach} toneClasses={{ border: 'border-amber/30', bg: 'bg-amber/5', text: 'text-amber' }} />
            <TierGroup label="Target" entries={result.target} toneClasses={{ border: 'border-orange/30', bg: 'bg-orange/5', text: 'text-orange' }} />
            <TierGroup label="Safe" entries={result.safe} toneClasses={{ border: 'border-green/30', bg: 'bg-green/5', text: 'text-green' }} />
          </div>

          {/* C. exams table */}
          <div className="card-surface p-6">
            <h2 className="mb-4 font-display text-xl font-semibold text-parchment">Exams you need to take</h2>
            <div className="overflow-x-auto rounded-card border border-hairline">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-ink-3 text-left text-xs text-slate">
                    <th className="px-3 py-2.5 font-medium">Exam</th>
                    <th className="px-3 py-2.5 font-medium">Required for</th>
                    <th className="px-3 py-2.5 font-medium">Your status</th>
                    <th className="px-3 py-2.5 font-medium">Next test date</th>
                    <th className="px-3 py-2.5 font-medium">Prep time needed</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {result.exams.map((e) => (
                    <tr key={e.exam} className="border-t border-hairline">
                      <td className="px-3 py-3 font-display font-semibold text-parchment">{e.exam}</td>
                      <td className="px-3 py-3 text-slate">{e.requiredFor}</td>
                      <td className="px-3 py-3 text-slate">{e.status}</td>
                      <td className="px-3 py-3 font-mono text-parchment">{e.nextDate}</td>
                      <td className="px-3 py-3 text-slate">~{e.prepWeeks} weeks</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => toast(`${e.exam} registration opened in a new tab (demo)`)}>
                            Register
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toast(`${e.exam} added to your plan`)}>
                            Add to plan
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* horizontal timeline */}
            <Timeline exams={result.exams} />

            <div className="mt-4 flex items-start gap-2 rounded-card border border-amber/30 bg-amber/10 p-3 text-sm text-parchment">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber" />
              {result.timelineWarning}
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <Button loading={saving} disabled={saved} onClick={() => void saveShortlist()}>
              {saved ? <><Check size={14} /> Shortlist saved</> : 'Save this shortlist'}
            </Button>
            <Button variant="secondary" onClick={() => setPhase('form')}>
              Adjust profile
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Timeline({ exams }: { exams: ShortlistResult['exams'] }) {
  const now = Date.now();
  const dates = exams
    .map((e) => ({ label: e.exam, t: new Date(e.nextDate + ' 12:00').getTime() }))
    .filter((d) => !isNaN(d.t));
  const deadline = { label: 'CMU deadline', t: new Date('2026-12-15T12:00:00').getTime() };
  const all = [...dates, deadline].sort((a, b) => a.t - b.t);
  const end = Math.max(...all.map((d) => d.t), now + 90 * 86400000);
  const span = end - now || 1;

  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate">Your runway</div>
      <div className="relative h-14 overflow-x-auto">
        <div className="absolute left-0 right-0 top-3 h-0.5 bg-ink-3" />
        <div className="absolute top-1.5 h-3.5 w-3.5 rounded-full border-2 border-parchment bg-ink" style={{ left: 0 }} title="Today" />
        <span className="absolute top-7 text-[10px] text-slate" style={{ left: 0 }}>Today</span>
        {all.map((d) => {
          const left = Math.min(97, Math.max(3, ((d.t - now) / span) * 94 + 3));
          const isDeadline = d.label.includes('deadline');
          return (
            <div key={d.label + d.t}>
              <div
                className={`absolute top-1.5 h-3.5 w-3.5 rounded-full ${isDeadline ? 'bg-orange' : 'border-2 border-orange bg-ink'}`}
                style={{ left: `${left}%` }}
                title={d.label}
              />
              <span className="absolute top-7 -translate-x-1/2 whitespace-nowrap text-[10px] text-slate" style={{ left: `${left}%` }}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
