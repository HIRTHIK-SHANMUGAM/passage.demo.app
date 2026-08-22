import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ShieldCheck } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import * as db from '@/lib/db';
import { Application, Credential, Program } from '@/lib/types';
import { Button, ErrorState, Input, Modal, Skeleton, Textarea, useToast } from '@/components/ui';
import { DOC_TYPES, DocPanel, docReady } from './StudyApplications';

interface FormValues {
  name: string;
  dob: string;
  nationality: string;
  passport: string;
  email: string;
  phone: string;
  institution: string;
  degree: string;
  cgpa: string;
  gradYear: string;
  gre: string;
  english: string;
  notTakenYet: boolean;
  sop: string;
  recommenders: { name: string; email: string; institution: string }[];
}

const EMPTY_FORM: FormValues = {
  name: '', dob: '', nationality: 'Indian', passport: '', email: '', phone: '',
  institution: '', degree: '', cgpa: '', gradYear: '2026',
  gre: '', english: '', notTakenYet: false,
  sop: '',
  recommenders: [
    { name: '', email: '', institution: '' },
    { name: '', email: '', institution: '' },
    { name: '', email: '', institution: '' },
  ],
};

const SECTIONS = ['Personal', 'Academic', 'Test scores', 'SOP', 'Recommenders', 'Documents'];

function VerifiedBadge() {
  return (
    <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-green/30 bg-green/10 px-2 py-0.5 text-[10px] font-medium text-green">
      <ShieldCheck size={10} /> Verified from your credential
    </span>
  );
}

export default function ApplicationForm() {
  const { programId } = useParams<{ programId: string }>();
  const { profile } = useApp();
  const toast = useToast();
  const navigate = useNavigate();

  const [program, setProgram] = useState<Program | null>(null);
  const [app, setApp] = useState<Application | null>(null);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [docPanel, setDocPanel] = useState<string | null>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);

  const transcriptCred = creds.find((c) => c.credential_type === 'transcript') ?? null;

  const load = useCallback(async () => {
    if (!profile || !programId) return;
    setError(false);
    setLoading(true);
    try {
      const [allPrograms, myApps, myCreds] = await Promise.all([
        db.listAllPrograms(),
        db.listApplicationsByStudent(profile.id),
        db.listCredentialsByStudent(profile.id),
      ]);
      const prog = allPrograms.find((p) => p.id === programId) ?? null;
      setProgram(prog);
      setCreds(myCreds);
      let existing = myApps.find((a) => a.program_id === programId) ?? null;
      if (!existing && prog) {
        existing = await db.createApplication(profile.id, { type: 'program', program: prog }, 'started');
      } else if (existing && existing.status === 'shortlisted') {
        existing = await db.updateApplication(existing.id, { status: 'started' });
      }
      setApp(existing);

      // restore draft, pre-filling from the profile + signed credential
      const transcript = myCreds.find((c) => c.credential_type === 'transcript') ?? null;
      const draft = (existing?.form_data as { draft?: Partial<FormValues> } | undefined)?.draft;
      setValues({
        ...EMPTY_FORM,
        name: transcript?.payload.student_name ?? profile.full_name ?? '',
        email: profile.email,
        institution: profile.home_institution_id ? db.getInstitutionSync(profile.home_institution_id)?.name ?? '' : '',
        degree: transcript?.payload.degree ?? profile.degree ?? '',
        cgpa: transcript?.payload.cgpa ?? String(profile.cgpa ?? ''),
        ...draft,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [profile, programId]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof FormValues>(k: K, v: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const wordCount = useMemo(
    () => values.sop.trim().split(/\s+/).filter(Boolean).length,
    [values.sop],
  );

  const docs = ((app?.documents as Record<string, unknown> | undefined)?.files as Record<string, string[]>) ?? {};

  const sectionComplete: boolean[] = [
    Boolean(values.name && values.dob && values.nationality && values.email),
    Boolean(values.institution && values.degree && values.cgpa && values.gradYear),
    Boolean(values.notTakenYet || values.gre || values.english),
    wordCount >= 100,
    values.recommenders.every((r) => r.name && r.email),
    DOC_TYPES.filter((d) => docReady(d.key, docs, !!transcriptCred)).length >= 3,
  ];

  async function saveDraft(silent = false) {
    if (!app) return;
    setSavingDraft(true);
    try {
      const updated = await db.updateApplication(app.id, { form_data: { ...app.form_data, draft: values } });
      setApp(updated);
      if (!silent) toast('Draft saved — safe to come back later');
    } finally {
      setSavingDraft(false);
    }
  }

  function validateAndConfirm() {
    const errs: Record<string, string> = {};
    if (!values.name.trim()) errs.name = 'Required';
    if (!values.dob) errs.dob = 'Required';
    if (!values.email.trim()) errs.email = 'Required';
    if (!values.institution.trim()) errs.institution = 'Required';
    if (!values.cgpa.trim()) errs.cgpa = 'Required';
    if (!values.notTakenYet && !values.gre.trim() && !values.english.trim())
      errs.tests = 'Enter a score or tick “Not taken yet”.';
    if (wordCount < 100) errs.sop = `Your statement is ${wordCount} words — write at least 100.`;
    values.recommenders.forEach((r, i) => {
      if (!r.name.trim() || !r.email.trim()) errs[`rec${i}`] = 'Name and email required';
    });
    setErrors(errs);
    const firstBad = [
      errs.name || errs.dob || errs.email ? 0 : -1,
      errs.institution || errs.cgpa ? 1 : -1,
      errs.tests ? 2 : -1,
      errs.sop ? 3 : -1,
      errs.rec0 || errs.rec1 || errs.rec2 ? 4 : -1,
    ].find((x) => x >= 0);
    if (firstBad !== undefined && firstBad >= 0) {
      sectionRefs.current[firstBad]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setConfirmOpen(true);
  }

  async function submit() {
    if (!app || submitting) return;
    setSubmitting(true);
    try {
      await db.updateApplication(app.id, {
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        form_data: { ...app.form_data, draft: values },
      });
      setConfirmOpen(false);
      toast(`Application submitted to ${uniName}`);
      navigate('/studies/applications');
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <ErrorState onRetry={() => void load()} />;
  if (loading || !program) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-40 w-full rounded-card" />
      </div>
    );
  }

  const uni = db.getInstitutionSync(program.institution_id);
  const uniName = uni?.name ?? 'the university';
  const daysLeft = Math.max(0, Math.ceil((new Date(program.deadline).getTime() - Date.now()) / 86400000));
  const fromCredential = !!transcriptCred;

  return (
    <div className="mx-auto max-w-2xl pb-24">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-parchment md:text-3xl">{program.name}</h1>
          <p className="mt-1 text-sm text-slate">{uniName} · {program.intake}</p>
        </div>
        <div className="rounded-card border border-orange/30 bg-orange/10 px-4 py-2 text-center">
          <div className="font-display text-xl font-semibold text-orange">{daysLeft} days</div>
          <div className="text-[10px] uppercase tracking-wider text-slate">until deadline</div>
        </div>
      </div>

      {/* progress */}
      <div className="mt-5 flex flex-wrap gap-2">
        {SECTIONS.map((s, i) => (
          <button
            key={s}
            onClick={() => sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${sectionComplete[i] ? 'border-green/40 bg-green/10 text-green' : 'border-hairline bg-ink-2 text-slate hover:text-parchment'}`}
          >
            {sectionComplete[i] && <Check size={11} />}
            {s}
          </button>
        ))}
      </div>

      {/* 1. personal */}
      <section ref={(el) => (sectionRefs.current[0] = el)} className="card-surface mt-6 scroll-mt-24 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-parchment">1 · Personal details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Full name" value={values.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />
          <Input label="Date of birth" type="date" value={values.dob} onChange={(e) => set('dob', e.target.value)} error={errors.dob} />
          <Input label="Nationality" value={values.nationality} onChange={(e) => set('nationality', e.target.value)} />
          <Input label="Passport number" placeholder="M1234567" value={values.passport} onChange={(e) => set('passport', e.target.value)} />
          <Input label="Email" type="email" value={values.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
          <Input label="Phone" placeholder="+91…" value={values.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
      </section>

      {/* 2. academic */}
      <section ref={(el) => (sectionRefs.current[1] = el)} className="card-surface mt-4 scroll-mt-24 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-parchment">2 · Academic history</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Input label="Institution" value={values.institution} onChange={(e) => set('institution', e.target.value)} error={errors.institution} />
            {fromCredential && <VerifiedBadge />}
          </div>
          <div>
            <Input label="Degree" value={values.degree} onChange={(e) => set('degree', e.target.value)} />
            {fromCredential && <VerifiedBadge />}
          </div>
          <div>
            <Input label="CGPA" value={values.cgpa} onChange={(e) => set('cgpa', e.target.value)} error={errors.cgpa} />
            {fromCredential && <VerifiedBadge />}
          </div>
          <Input label="Graduation year" value={values.gradYear} onChange={(e) => set('gradYear', e.target.value)} />
        </div>
      </section>

      {/* 3. tests */}
      <section ref={(el) => (sectionRefs.current[2] = el)} className="card-surface mt-4 scroll-mt-24 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-parchment">3 · Test scores</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="GRE (if taken)" placeholder="326" value={values.gre} onChange={(e) => set('gre', e.target.value)} disabled={values.notTakenYet} />
          <Input label="TOEFL / IELTS" placeholder="112 or 8.0" value={values.english} onChange={(e) => set('english', e.target.value)} disabled={values.notTakenYet} />
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-parchment">
          <input
            type="checkbox"
            checked={values.notTakenYet}
            onChange={(e) => {
              set('notTakenYet', e.target.checked);
              setErrors((x) => ({ ...x, tests: '' }));
            }}
            className="h-4 w-4 accent-[#E75C2B]"
          />
          Not taken yet —{' '}
          <button
            type="button"
            className="text-orange underline-offset-2 hover:underline"
            onClick={() => navigate('/studies/exams')}
          >
            plan it in the Exams tab
          </button>
        </label>
        {errors.tests && <p className="mt-2 text-xs text-red">{errors.tests}</p>}
      </section>

      {/* 4. SOP */}
      <section ref={(el) => (sectionRefs.current[3] = el)} className="card-surface mt-4 scroll-mt-24 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-parchment">4 · Statement of purpose</h2>
        <Textarea
          rows={8}
          placeholder="Why this program, why now, and why you…"
          value={values.sop}
          onChange={(e) => set('sop', e.target.value)}
          error={errors.sop}
        />
        <div className="mt-1 text-right font-mono text-xs text-slate">{wordCount} / 1000 words</div>
      </section>

      {/* 5. recommenders */}
      <section ref={(el) => (sectionRefs.current[4] = el)} className="card-surface mt-4 scroll-mt-24 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-parchment">5 · Recommenders</h2>
        <div className="space-y-4">
          {values.recommenders.map((r, i) => (
            <div key={i}>
              <div className="mb-1.5 text-xs font-medium text-slate">Recommender {i + 1}</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input placeholder="Name" value={r.name} onChange={(e) => set('recommenders', values.recommenders.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                <Input placeholder="Email" value={r.email} onChange={(e) => set('recommenders', values.recommenders.map((x, k) => (k === i ? { ...x, email: e.target.value } : x)))} />
                <Input placeholder="Institution" value={r.institution} onChange={(e) => set('recommenders', values.recommenders.map((x, k) => (k === i ? { ...x, institution: e.target.value } : x)))} />
              </div>
              {errors[`rec${i}`] && <p className="mt-1 text-xs text-red">{errors[`rec${i}`]}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* 6. documents */}
      <section ref={(el) => (sectionRefs.current[5] = el)} className="card-surface mt-4 scroll-mt-24 p-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-parchment">6 · Documents</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DOC_TYPES.map((d) => {
            const ready = docReady(d.key, docs, !!transcriptCred);
            return (
              <button
                key={d.key}
                onClick={() => setDocPanel(d.key)}
                className={`flex flex-col items-center gap-1.5 rounded-card border p-3 text-center transition-all ${ready ? 'border-green/40 bg-green/10' : 'border-hairline bg-ink-3/40 hover:border-hairline-strong'}`}
              >
                {ready ? <Check size={16} className="text-green" /> : <span className="h-4 w-4 rounded-full border border-hairline" />}
                <span className={`text-xs ${ready ? 'text-green' : 'text-parchment'}`}>{d.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="text-xs text-slate">
            {sectionComplete.filter(Boolean).length} of {SECTIONS.length} sections complete
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" loading={savingDraft} onClick={() => void saveDraft()}>
              Save draft
            </Button>
            <Button onClick={validateAndConfirm}>Submit application</Button>
          </div>
        </div>
      </div>

      {docPanel && app && (
        <DocPanel
          docKey={docPanel}
          docs={docs}
          hasTranscriptCred={!!transcriptCred}
          onClose={() => setDocPanel(null)}
          onSave={async (key, files) => {
            const updated = await db.updateApplication(app.id, {
              documents: { ...app.documents, files: { ...docs, [key]: files } },
            });
            setApp(updated);
            toast(`${DOC_TYPES.find((d) => d.key === key)?.label} saved`);
          }}
          onRequestCredential={() => {
            setDocPanel(null);
            navigate('/studies/verification');
          }}
        />
      )}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} labelledBy="submit-title">
        <h2 id="submit-title" className="mb-2 font-display text-xl text-parchment">Submit to {uniName}?</h2>
        <p className="mb-5 text-sm text-slate">You won't be able to edit after this.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Keep editing</Button>
          <Button loading={submitting} onClick={() => void submit()}>Submit</Button>
        </div>
      </Modal>
    </div>
  );
}
