import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, FileText, GraduationCap, ShieldCheck, UploadCloud, X } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import * as db from '@/lib/db';
import { Application, Credential, Program } from '@/lib/types';
import {
  Button,
  EmptyState,
  ErrorState,
  Eyebrow,
  Modal,
  PageTitle,
  Pill,
  PillTone,
  SkeletonRows,
  useToast,
} from '@/components/ui';
import { CountUp } from '@/components/effects';

export const DOC_TYPES: { key: string; label: string; hint: string; multi?: number }[] = [
  { key: 'transcript', label: 'Transcript', hint: 'Your signed academic record — attached automatically from your vault.' },
  { key: 'sop', label: 'SOP', hint: 'Statement of purpose as a single PDF, typically 800–1000 words.' },
  { key: 'lors', label: 'LORs', hint: "Three letters required. Upload each recommender's letter as a separate PDF.", multi: 3 },
  { key: 'gre', label: 'GRE score', hint: 'Official score report PDF from ETS.' },
  { key: 'ielts', label: 'IELTS', hint: 'Test report form (TRF) as a PDF.' },
  { key: 'passport', label: 'Passport', hint: 'Photo page scan, in colour, all corners visible.' },
  { key: 'cv', label: 'CV', hint: 'One to two pages, PDF preferred.' },
];

type DocsState = Record<string, string[]>; // doc key -> uploaded file names

function docsFromApp(a: Application): DocsState {
  return ((a.documents as Record<string, unknown>).files as DocsState) ?? {};
}

export function docReady(key: string, docs: DocsState, hasTranscript: boolean): boolean {
  if (key === 'transcript') return hasTranscript;
  const need = DOC_TYPES.find((d) => d.key === key)?.multi ?? 1;
  return (docs[key]?.length ?? 0) >= need;
}

export function DocPanel({
  docKey,
  docs,
  hasTranscriptCred,
  onSave,
  onClose,
  onRequestCredential,
}: {
  docKey: string;
  docs: DocsState;
  hasTranscriptCred: boolean;
  onSave: (key: string, files: string[]) => Promise<void>;
  onClose: () => void;
  onRequestCredential?: () => void;
}) {
  const def = DOC_TYPES.find((d) => d.key === docKey)!;
  const [files, setFiles] = useState<string[]>(docs[docKey] ?? []);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const need = def.multi ?? 1;

  function addFiles(list: FileList | null) {
    setError('');
    if (!list) return;
    const incoming: string[] = [];
    for (const f of Array.from(list)) {
      if (!/\.(pdf|docx?|png|jpe?g)$/i.test(f.name) || f.size > 10 * 1024 * 1024) {
        setError('PDF, DOC or image files only, max 10MB each.');
        continue;
      }
      incoming.push(f.name);
    }
    setFiles((prev) => [...prev, ...incoming].slice(0, Math.max(need, 5)));
  }

  return (
    <Modal open onClose={onClose} labelledBy="doc-title">
      <h2 id="doc-title" className="mb-1 font-display text-xl text-parchment">{def.label}</h2>
      <p className="mb-4 text-sm text-slate">{def.hint}</p>

      {docKey === 'transcript' ? (
        hasTranscriptCred ? (
          <div className="rounded-card border border-green/30 bg-green/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-green">
              <ShieldCheck size={16} /> Verified — attached automatically
            </div>
            <p className="mt-1.5 text-xs text-slate">
              Your transcript is cryptographically verified. No upload needed.
            </p>
          </div>
        ) : (
          <div className="rounded-card border border-hairline bg-ink-3/40 p-4 text-center">
            <p className="mb-3 text-sm text-slate">You don't have a signed transcript in your vault yet.</p>
            <Button variant="secondary" onClick={onRequestCredential}>
              Request one from your college
            </Button>
          </div>
        )
      ) : (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center gap-2 rounded-card border-2 border-dashed p-8 text-center transition-all ${dragOver ? 'border-orange bg-orange/10' : 'border-hairline-strong bg-ink-3/30'}`}
          >
            <UploadCloud size={26} className={dragOver ? 'text-orange' : 'text-slate'} />
            <div className="text-sm text-parchment">Drag files here</div>
            <label className="cursor-pointer text-xs text-orange underline-offset-2 hover:underline">
              or browse
              <input type="file" multiple={!!def.multi} className="hidden" onChange={(e) => addFiles(e.target.files)} />
            </label>
          </div>
          {error && <p className="mt-2 text-xs text-red">{error}</p>}

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {def.multi && (
                <div className="text-xs text-slate">
                  {Math.min(files.length, need)} of {need} uploaded
                </div>
              )}
              {files.map((f, i) => (
                <div key={`${f}-${i}`} className="flex items-center gap-2 rounded-btn border border-hairline bg-ink-3/60 px-3 py-2 text-sm text-parchment">
                  <FileText size={14} className="text-orange" />
                  <span className="min-w-0 flex-1 truncate">{f}</span>
                  <button aria-label={`Remove ${f}`} onClick={() => setFiles(files.filter((_, k) => k !== i))} className="text-slate hover:text-parchment">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        {docKey !== 'transcript' && (
          <Button
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(docKey, files);
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            Save
          </Button>
        )}
        {docKey === 'transcript' && hasTranscriptCred && <Button onClick={onClose}>Done</Button>}
      </div>
    </Modal>
  );
}

const STATUS_META: Record<string, { label: string; tone: PillTone }> = {
  shortlisted: { label: 'Shortlisted', tone: 'slate' },
  started: { label: 'Started', tone: 'orange' },
  submitted: { label: 'Submitted', tone: 'green' },
  in_review: { label: 'Decision pending', tone: 'orange' },
  interview: { label: 'Interview', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
  offer: { label: 'Offer', tone: 'green' },
};

export default function StudyApplications() {
  const { profile } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [docPanel, setDocPanel] = useState<{ appId: string; key: string } | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    setError(false);
    try {
      const [a, p, c] = await Promise.all([
        db.listApplicationsByStudent(profile.id),
        db.listAllPrograms(),
        db.listCredentialsByStudent(profile.id),
      ]);
      setApps(a.filter((x) => x.target_type === 'program'));
      setPrograms(p);
      setCreds(c);
    } catch {
      setError(true);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasTranscriptCred = creds.some((c) => c.credential_type === 'transcript');

  const stats = useMemo(() => {
    const a = apps ?? [];
    return {
      shortlisted: a.filter((x) => x.status === 'shortlisted').length,
      started: a.filter((x) => x.status === 'started').length,
      submitted: a.filter((x) => x.status === 'submitted').length,
      pending: a.filter((x) => x.status === 'in_review').length,
    };
  }, [apps]);

  async function saveDoc(app: Application, key: string, files: string[]) {
    const docs = { ...docsFromApp(app), [key]: files };
    await db.updateApplication(app.id, {
      documents: { ...app.documents, files: docs },
    });
    toast(`${DOC_TYPES.find((d) => d.key === key)?.label} saved`);
    await load();
  }

  if (error) return <ErrorState onRetry={() => void load()} />;

  return (
    <div>
      <Eyebrow>Applications</Eyebrow>
      <PageTitle>Your applications, one desk.</PageTitle>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Shortlisted', stats.shortlisted],
          ['Started', stats.started],
          ['Submitted', stats.submitted],
          ['Decision pending', stats.pending],
        ].map(([label, n]) => (
          <div key={label as string} className="card-surface p-4">
            <div className="font-display text-2xl font-semibold text-parchment">
              <CountUp to={n as number} />
            </div>
            <div className="text-xs text-slate">{label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {apps === null ? (
          <SkeletonRows rows={4} />
        ) : apps.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No applications yet"
            body="Shortlist a university or let the AI build your list — everything you start lands here."
            action={<Button onClick={() => navigate('/studies')}>Browse universities</Button>}
          />
        ) : (
          apps.map((a) => {
            const program = programs.find((p) => p.id === a.program_id);
            const uni = program ? db.getInstitutionSync(program.institution_id) : null;
            const meta = STATUS_META[a.status] ?? STATUS_META.shortlisted;
            const docs = docsFromApp(a);
            const readyCount = DOC_TYPES.filter((d) => docReady(d.key, docs, hasTranscriptCred)).length;
            const daysLeft = program ? Math.ceil((new Date(program.deadline).getTime() - Date.now()) / 86400000) : null;
            const isOpen = expanded === a.id;
            return (
              <div key={a.id} className="card-surface overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : a.id)}
                  aria-expanded={isOpen}
                  className="flex w-full flex-wrap items-center gap-3 p-4 text-left"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-orange/40 font-display text-sm font-semibold text-orange">
                    {uni?.initials ?? '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-semibold text-parchment">{program?.name ?? 'Program'}</div>
                    <div className="text-xs text-slate">{uni?.name}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 w-32 rounded-full bg-ink-3">
                        <div className="h-1.5 rounded-full bg-orange" style={{ width: `${(readyCount / DOC_TYPES.length) * 100}%` }} />
                      </div>
                      <span className="text-[11px] text-slate">{readyCount} of {DOC_TYPES.length} documents ready</span>
                    </div>
                  </div>
                  {daysLeft !== null && (
                    <span className={`font-mono text-xs ${daysLeft < 14 ? 'text-red' : 'text-slate'}`}>
                      {daysLeft > 0 ? `${daysLeft}d left` : 'closed'}
                    </span>
                  )}
                  {hasTranscriptCred && (
                    <Pill tone="green" className="hidden sm:inline-flex"><ShieldCheck size={11} /> Verified</Pill>
                  )}
                  <Pill tone={meta.tone}>{meta.label}</Pill>
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
                      <div className="border-t border-hairline p-4">
                        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate">Document checklist</div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                          {DOC_TYPES.map((d) => {
                            const ready = docReady(d.key, docs, hasTranscriptCred);
                            return (
                              <button
                                key={d.key}
                                onClick={() => setDocPanel({ appId: a.id, key: d.key })}
                                className={`flex flex-col items-center gap-1.5 rounded-card border p-3 text-center transition-all ${ready ? 'border-green/40 bg-green/10' : 'border-hairline bg-ink-3/40 hover:border-hairline-strong'}`}
                              >
                                {ready ? <Check size={16} className="text-green" /> : <FileText size={16} className="text-slate" />}
                                <span className={`text-xs ${ready ? 'text-green' : 'text-parchment'}`}>{d.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          {(a.status === 'shortlisted' || a.status === 'started') && program && (
                            <Button size="sm" onClick={() => navigate(`/studies/apply/${program.id}`)}>
                              {a.status === 'started' ? 'Continue application' : 'Start application'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {docPanel && apps && (
        <DocPanel
          docKey={docPanel.key}
          docs={docsFromApp(apps.find((a) => a.id === docPanel.appId)!)}
          hasTranscriptCred={hasTranscriptCred}
          onClose={() => setDocPanel(null)}
          onSave={async (key, files) => {
            const app = apps.find((a) => a.id === docPanel.appId)!;
            await saveDoc(app, key, files);
          }}
          onRequestCredential={() => {
            setDocPanel(null);
            navigate('/studies/verification');
          }}
        />
      )}
    </div>
  );
}
