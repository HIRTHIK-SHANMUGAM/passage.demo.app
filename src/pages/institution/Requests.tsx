import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Inbox, Loader2, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import * as db from '@/lib/db';
import { CredentialCourse, CredentialRequest, CredentialType, Profile } from '@/lib/types';
import {
  AvatarCircle,
  Button,
  EmptyState,
  ErrorState,
  Eyebrow,
  Input,
  Modal,
  PageTitle,
  Pill,
  SkeletonRows,
  Textarea,
  useToast,
} from '@/components/ui';

const TYPE_LABELS: Record<CredentialType, string> = {
  transcript: 'Official Transcript',
  marksheet: 'Semester Marksheet',
  bonafide: 'Bonafide Certificate',
  migration: 'Migration Certificate',
};

type Chip = 'all' | 'pending' | 'issued' | 'declined';

const SIGN_STEPS = [
  'Canonicalising record',
  'Computing hash',
  'Signing with institution key',
  'Anchoring to registry',
];

function IssueModal({
  request,
  student,
  onClose,
  onIssued,
}: {
  request: CredentialRequest;
  student: Profile;
  onClose: () => void;
  onIssued: () => void;
}) {
  const { activeInstitution } = useApp();
  const toast = useToast();
  const [name, setName] = useState(student.full_name ?? '');
  const [studentId, setStudentId] = useState(student.student_id ?? '');
  const [degree, setDegree] = useState(student.degree ?? '');
  const [cgpa, setCgpa] = useState(String(student.cgpa ?? ''));
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [courses, setCourses] = useState<CredentialCourse[]>(
    request.credential_type === 'transcript'
      ? [
          { name: 'Data Structures & Algorithms', credits: 4, grade: 'A' },
          { name: 'Operating Systems', credits: 4, grade: 'A' },
          { name: 'Machine Learning', credits: 3, grade: 'S' },
        ]
      : [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<'edit' | 'signing' | 'done'>('edit');
  const [stepIdx, setStepIdx] = useState(-1);
  const [issuedHash, setIssuedHash] = useState('');

  async function signAndIssue() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Required';
    if (!studentId.trim()) errs.studentId = 'Required';
    if (!degree.trim()) errs.degree = 'Required';
    if (!cgpa.trim() || isNaN(parseFloat(cgpa))) errs.cgpa = 'Numeric CGPA required';
    setErrors(errs);
    if (Object.values(errs).some(Boolean) || !activeInstitution) return;

    setPhase('signing');
    for (let i = 0; i < SIGN_STEPS.length; i++) {
      setStepIdx(i);
      await new Promise((r) => setTimeout(r, 520));
    }

    const cred = await db.issueCredential({
      student_id: student.id,
      issuing_institution_id: activeInstitution.id,
      credential_type: request.credential_type,
      title: TYPE_LABELS[request.credential_type],
      payload: {
        student_name: name.trim(),
        student_id: studentId.trim(),
        degree: degree.trim(),
        cgpa: cgpa.trim(),
        courses: request.credential_type === 'transcript' ? courses.filter((c) => c.name.trim()) : undefined,
      },
    });
    await db.resolveCredentialRequest(request.id, { status: 'issued', resolved_credential_id: cred.id });
    setIssuedHash(cred.hash);
    setPhase('done');
    onIssued();
  }

  return (
    <Modal open onClose={phase === 'signing' ? () => {} : onClose} wide labelledBy="issue-title">
      {phase === 'edit' && (
        <>
          <h2 id="issue-title" className="mb-1 font-display text-xl text-parchment">
            Issue &amp; sign — {TYPE_LABELS[request.credential_type]}
          </h2>
          <p className="mb-4 text-sm text-slate">For {student.full_name}. Check every field — this becomes the record.</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Student name" value={name} onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: '' })); }} error={errors.name} />
            <Input label="Student ID" value={studentId} onChange={(e) => { setStudentId(e.target.value); setErrors((x) => ({ ...x, studentId: '' })); }} error={errors.studentId} />
            <Input label="Degree" value={degree} onChange={(e) => { setDegree(e.target.value); setErrors((x) => ({ ...x, degree: '' })); }} error={errors.degree} />
            <Input label="CGPA" value={cgpa} onChange={(e) => { setCgpa(e.target.value); setErrors((x) => ({ ...x, cgpa: '' })); }} error={errors.cgpa} />
            <Input label="Issue date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>

          {request.credential_type === 'transcript' && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs font-medium text-slate">Course list</div>
              <div className="space-y-2">
                {courses.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={c.name}
                      placeholder="Course name"
                      onChange={(e) => setCourses(courses.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))}
                      className="flex-1 rounded-btn border border-hairline bg-ink-3 px-3 py-2 text-sm text-parchment placeholder:text-slate-2"
                    />
                    <input
                      value={c.credits}
                      aria-label="Credits"
                      onChange={(e) => setCourses(courses.map((x, k) => (k === i ? { ...x, credits: parseInt(e.target.value) || 0 } : x)))}
                      className="w-16 rounded-btn border border-hairline bg-ink-3 px-3 py-2 text-center font-mono text-sm text-parchment"
                    />
                    <input
                      value={c.grade}
                      aria-label="Grade"
                      onChange={(e) => setCourses(courses.map((x, k) => (k === i ? { ...x, grade: e.target.value } : x)))}
                      className="w-16 rounded-btn border border-hairline bg-ink-3 px-3 py-2 text-center font-mono text-sm text-parchment"
                    />
                    <Button variant="ghost" size="sm" aria-label="Remove course" onClick={() => setCourses(courses.filter((_, k) => k !== i))}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <Button variant="ghost" size="sm" onClick={() => setCourses([...courses, { name: '', credits: 3, grade: 'A' }])}>
                  <Plus size={13} /> Add course
                </Button>
              </div>
            </div>
          )}

          <p className="mt-4 rounded-btn border border-hairline bg-ink-3/50 px-3 py-2 text-xs text-slate">
            Once signed, this record cannot be altered. Any change breaks the signature.
          </p>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => void signAndIssue()}>Sign &amp; issue</Button>
          </div>
        </>
      )}

      {phase === 'signing' && (
        <div className="py-6">
          <h2 className="mb-6 text-center font-display text-xl text-parchment">Signing with {activeInstitution?.name ?? 'the institution'}'s key</h2>
          <div className="mx-auto max-w-xs space-y-3">
            {SIGN_STEPS.map((s, i) => (
              <div key={s} className={`flex items-center gap-3 text-sm ${i <= stepIdx ? 'text-parchment' : 'text-slate-2'}`}>
                {i < stepIdx ? (
                  <Check size={16} className="text-green" />
                ) : i === stepIdx ? (
                  <Loader2 size={16} className="animate-spin text-orange" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-hairline" />
                )}
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div className="flex flex-col items-center py-6 text-center">
          <motion.div
            initial={{ scale: 0.4 }}
            animate={{ scale: [0.4, 1.12, 1] }}
            transition={{ duration: 0.5 }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-green shadow-[0_0_32px_rgba(30,158,100,0.4)]"
          >
            <Check size={30} strokeWidth={3} className="text-white" />
          </motion.div>
          <h2 className="mt-4 font-display text-2xl font-semibold text-green">Issued</h2>
          <p className="mt-1 text-sm text-slate">The credential is now in {student.full_name}'s vault.</p>
          <code className="mt-3 break-all rounded-btn border border-hairline bg-ink px-3 py-2 font-mono text-xs text-slate">
            {issuedHash.slice(0, 34)}…
          </code>
          <Button
            className="mt-5"
            onClick={() => {
              toast(`Credential issued to ${student.full_name}`);
              onClose();
            }}
          >
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}

function DeclineModal({
  request,
  student,
  onClose,
  onDeclined,
}: {
  request: CredentialRequest;
  student: Profile;
  onClose: () => void;
  onDeclined: () => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function decline() {
    if (busy) return;
    if (!reason.trim()) {
      setError('A reason is required — the student sees it.');
      return;
    }
    setBusy(true);
    try {
      await db.resolveCredentialRequest(request.id, { status: 'declined', decline_reason: reason.trim() });
      toast('Request declined');
      onDeclined();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="decline-title">
      <h2 id="decline-title" className="mb-2 font-display text-xl text-parchment">Decline this request?</h2>
      <p className="mb-4 text-sm text-slate">
        {student.full_name} asked for a {TYPE_LABELS[request.credential_type].toLowerCase()}. Your reason is shown to them.
      </p>
      <Textarea
        label="Reason (required)"
        rows={2}
        placeholder="e.g. Outstanding library dues must be cleared first."
        value={reason}
        onChange={(e) => { setReason(e.target.value); setError(''); }}
        error={error}
      />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger-solid" loading={busy} onClick={() => void decline()}>Decline request</Button>
      </div>
    </Modal>
  );
}

export default function Requests() {
  const { activeInstitution } = useApp();
  const [requests, setRequests] = useState<CredentialRequest[] | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [error, setError] = useState(false);
  const [chip, setChip] = useState<Chip>('all');
  const [issueTarget, setIssueTarget] = useState<CredentialRequest | null>(null);
  const [declineTarget, setDeclineTarget] = useState<CredentialRequest | null>(null);

  const load = useCallback(async () => {
    if (!activeInstitution) return;
    setError(false);
    setRequests(null);
    try {
      // scoped to the active institution, like everything else in this track
      const list = await db.listCredentialRequestsByInstitution(activeInstitution.id);
      setRequests(list);
      const ps: Record<string, Profile> = {};
      await Promise.all(
        [...new Set(list.map((r) => r.student_id))].map(async (sid) => {
          const p = await db.getProfile(sid);
          if (p) ps[sid] = p;
        }),
      );
      setProfiles(ps);
    } catch {
      setError(true);
    }
  }, [activeInstitution]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => (requests ?? []).filter((r) => chip === 'all' || r.status === chip),
    [requests, chip],
  );

  if (!activeInstitution) return null;

  const chips: Chip[] = ['all', 'pending', 'issued', 'declined'];

  return (
    <div>
      <Eyebrow>Requests</Eyebrow>
      <PageTitle>{activeInstitution.name} — credential requests.</PageTitle>
      <p className="mt-2 text-sm text-slate">Students asking for signed records. Issuing takes a minute; verification takes them a second.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => setChip(c)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${chip === c ? 'bg-orange text-white' : 'border border-hairline bg-ink-2 text-slate hover:text-parchment'}`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {error ? (
          <ErrorState onRetry={() => void load()} />
        ) : requests === null ? (
          <SkeletonRows rows={3} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={chip === 'all' ? 'No requests' : `No ${chip} requests`}
            body={
              chip === 'all'
                ? `When a ${activeInstitution.name} graduate requests a record, it lands here for signing.`
                : 'Try a different filter.'
            }
            action={chip !== 'all' ? <Button variant="secondary" onClick={() => setChip('all')}>Show all</Button> : undefined}
          />
        ) : (
          filtered.map((r) => {
            const student = profiles[r.student_id];
            return (
              <div key={r.id} className="card-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <AvatarCircle text={(student?.full_name ?? '?').slice(0, 1)} size={42} colorSeed={r.student_id} />
                  <div className="min-w-0">
                    <div className="font-display text-base font-semibold text-parchment">{student?.full_name ?? '…'}</div>
                    <div className="text-xs text-slate">
                      <span className="font-mono">{student?.student_id}</span> · {student?.degree}
                    </div>
                    <div className="mt-0.5 text-xs text-parchment">
                      {TYPE_LABELS[r.credential_type]}
                      <span className="font-mono text-slate"> · requested {new Date(r.requested_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    {r.note && <div className="mt-1 text-xs italic text-slate">“{r.note}”</div>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.status === 'pending' && student && (
                    <>
                      <Button size="sm" onClick={() => setIssueTarget(r)}>Issue &amp; sign</Button>
                      <Button variant="danger" size="sm" onClick={() => setDeclineTarget(r)}>Decline</Button>
                    </>
                  )}
                  {r.status === 'issued' && <Pill tone="green">Issued</Pill>}
                  {r.status === 'declined' && <Pill tone="red">Declined</Pill>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {issueTarget && profiles[issueTarget.student_id] && (
        <IssueModal
          request={issueTarget}
          student={profiles[issueTarget.student_id]}
          onClose={() => setIssueTarget(null)}
          onIssued={() => void load()}
        />
      )}
      {declineTarget && profiles[declineTarget.student_id] && (
        <DeclineModal
          request={declineTarget}
          student={profiles[declineTarget.student_id]}
          onClose={() => setDeclineTarget(null)}
          onDeclined={() => void load()}
        />
      )}
    </div>
  );
}
