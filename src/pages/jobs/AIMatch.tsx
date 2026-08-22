import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, FileText, Loader2, Sparkles, UploadCloud, X } from 'lucide-react';
import * as db from '@/lib/db';
import { ResumeAnalysis, analyseResume } from '@/lib/ai';
import { JobPosting } from '@/lib/types';
import { Button, Eyebrow, PageTitle, matchTone } from '@/components/ui';
import { ApplyModal } from './Jobs';

const STAGES = [
  'Reading your resume',
  'Extracting skills and experience',
  'Understanding your trajectory',
  'Scanning 12,400 open roles',
  'Ranking by fit',
];

const ACCEPT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export default function AIMatch() {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [useProfile, setUseProfile] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'analysing' | 'done'>('idle');
  const [stageIdx, setStageIdx] = useState(-1);
  const [result, setResult] = useState<ResumeAnalysis | null>(null);
  const [showStretch, setShowStretch] = useState(false);
  const [applyTarget, setApplyTarget] = useState<JobPosting | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function acceptFile(f: File | undefined) {
    setFileError('');
    if (!f) return;
    const okType = ACCEPT_TYPES.includes(f.type) || /\.(pdf|docx)$/i.test(f.name);
    if (!okType || f.size > 5 * 1024 * 1024) {
      setFileError('PDF or DOCX only, max 5MB');
      return;
    }
    setFile(f);
    setUseProfile(false);
  }

  async function analyse() {
    if (phase === 'analysing') return;
    setPhase('analysing');
    setResult(null);
    const work = analyseResume(
      file ? `Resume file: ${file.name}` : 'Use Passage profile: B.Tech CSE AI & Robotics, CGPA 9.2, VIT Chennai. Projects: production PWA, LLM-backed products, robotics coursework.',
    );
    for (let i = 0; i < STAGES.length; i++) {
      setStageIdx(i);
      await new Promise((r) => setTimeout(r, 500));
    }
    setResult(await work);
    setPhase('done');
  }

  async function openApply(companyName: string, title: string) {
    const companies = await db.listInstitutions('company');
    const company = companies.find((c) => c.name === companyName);
    if (!company) return;
    const postings = await db.listJobPostingsByInstitution(company.id);
    const posting =
      postings.find((p) => p.title.toLowerCase() === title.toLowerCase()) ?? postings[0];
    if (posting) setApplyTarget(posting);
  }

  const sortedMatches = result
    ? [...result.matches].sort((a, b) =>
        showStretch ? Number(b.stretch) - Number(a.stretch) || b.pct - a.pct : b.pct - a.pct,
      )
    : [];

  return (
    <div className="mx-auto max-w-3xl">
      <Eyebrow>AI job match</Eyebrow>
      <PageTitle>Stop searching. Start matching.</PageTitle>
      <p className="mt-2 text-sm text-slate">Upload your resume once. We read it and find roles you'd actually get.</p>

      {phase !== 'done' && (
        <div className="mt-8">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              acceptFile(e.dataTransfer.files[0]);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed p-12 text-center transition-all ${dragOver ? 'border-orange bg-orange/10' : 'border-hairline-strong bg-ink-2/60 hover:border-orange/50'}`}
          >
            <UploadCloud size={36} className={dragOver ? 'text-orange' : 'text-slate'} />
            <div className="text-sm text-parchment">Drag your resume here, or click to browse</div>
            <div className="text-xs text-slate-2">PDF or DOCX · up to 5MB</div>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />
          </div>
          {fileError && <p className="mt-2 text-xs text-red">{fileError}</p>}

          {file && (
            <div className="mt-3 flex items-center gap-2 rounded-btn border border-hairline bg-ink-3/60 px-3 py-2 text-sm text-parchment">
              <FileText size={15} className="text-orange" />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <button aria-label="Remove file" onClick={() => setFile(null)} className="text-slate hover:text-parchment">
                <X size={15} />
              </button>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => {
                setUseProfile(true);
                setFile(null);
                setFileError('');
              }}
              className={`text-xs underline-offset-2 hover:underline ${useProfile ? 'text-orange' : 'text-slate hover:text-parchment'}`}
            >
              Or use your Passage profile instead {useProfile && '✓'}
            </button>
            <Button disabled={(!file && !useProfile) || phase === 'analysing'} onClick={() => void analyse()}>
              <Sparkles size={14} /> Analyse
            </Button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {phase === 'analysing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto mt-10 max-w-sm space-y-3">
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
          <div className="card-surface p-6">
            <h2 className="mb-3 font-display text-xl font-semibold text-parchment">What we understood about you</h2>
            <div className="mb-4 flex flex-wrap gap-2">
              {result.skills.map((s) => (
                <span key={s} className="rounded-full border border-orange/30 bg-orange/10 px-3 py-1 text-xs text-orange">{s}</span>
              ))}
            </div>
            <p className="text-sm leading-relaxed text-parchment">{result.read}</p>
            <div className="mt-4 rounded-card border border-amber/30 bg-amber/10 p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber">Gaps we noticed</div>
              <p className="text-sm text-parchment">{result.gaps}</p>
            </div>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-parchment">Your matches</h2>
              <button
                onClick={() => setShowStretch((s) => !s)}
                role="switch"
                aria-checked={showStretch}
                className="flex items-center gap-2 text-xs text-slate hover:text-parchment"
              >
                Show me roles I'm a stretch for
                <span className={`relative h-5 w-9 rounded-full transition-colors ${showStretch ? 'bg-orange' : 'border border-hairline bg-ink-3'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-parchment transition-all ${showStretch ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
              </button>
            </div>

            <div className="space-y-3">
              {sortedMatches.map((m) => {
                const tone = matchTone(m.pct);
                const badge =
                  tone === 'green'
                    ? 'bg-green/15 text-green border-green/30'
                    : tone === 'orange'
                      ? 'bg-orange/15 text-orange border-orange/30'
                      : 'bg-ink-3 text-slate border-hairline';
                return (
                  <div key={`${m.company}-${m.title}`} className="card-surface p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-display text-lg font-semibold text-parchment">{m.title}</div>
                        <div className="text-xs text-slate">{m.company}{m.stretch && <span className="ml-2 text-amber">· stretch</span>}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full border px-3 py-1 font-display text-sm font-semibold ${badge}`}>{m.pct}%</span>
                        <Button size="sm" onClick={() => void openApply(m.company, m.title)}>Apply</Button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-green">Why this matched</div>
                        <ul className="list-inside list-disc space-y-1 text-xs text-slate">
                          {m.why.map((w) => <li key={w}>{w}</li>)}
                        </ul>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber">What's missing</div>
                        <p className="text-xs text-slate">{m.missing}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              variant="secondary"
              onClick={() => {
                setPhase('idle');
                setResult(null);
                setFile(null);
                setUseProfile(false);
              }}
            >
              Analyse a different resume
            </Button>
          </div>
        </motion.div>
      )}

      {applyTarget && <ApplyModal job={applyTarget} onClose={() => setApplyTarget(null)} onApplied={() => {}} />}
    </div>
  );
}
