import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BadgeCheck,
  Check,
  Copy,
  Eye,
  FileQuestion,
  Inbox,
  QrCode,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '@/state/AppContext';
import * as db from '@/lib/db';
import { Credential, CredentialShare, CredentialType } from '@/lib/types';
import { truncateHash } from '@/lib/hash';
import { TiltCard } from '@/components/effects';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Eyebrow,
  Input,
  Modal,
  PageTitle,
  Pill,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/ui';

const SCOPE_OPTIONS = [
  'Degree and institution',
  'CGPA',
  'Individual course grades',
  'Semester breakdown',
  'Personal details',
];

const REQUEST_TYPES: { type: CredentialType; label: string; sub: string }[] = [
  { type: 'transcript', label: 'Official Transcript', sub: 'Full course list with grades and CGPA' },
  { type: 'marksheet', label: 'Semester Marksheet', sub: 'Per-semester grade record' },
  { type: 'bonafide', label: 'Bonafide Certificate', sub: 'Proof of enrolment / graduation' },
  { type: 'migration', label: 'Migration Certificate', sub: 'For joining another university' },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function relTime(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'just now';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function expiryLabel(s: CredentialShare): { text: string; tone: 'orange' | 'slate' | 'red' } {
  if (s.revoked) return { text: 'Revoked', tone: 'red' };
  if (!s.expires_at) return { text: 'Never expires', tone: 'slate' };
  const hrs = Math.round((new Date(s.expires_at).getTime() - Date.now()) / 3600000);
  if (hrs <= 0) return { text: 'Expired', tone: 'slate' };
  return { text: `Expires in ${hrs} hours`, tone: 'orange' };
}

/* ---------------- Share modal ---------------- */

function ShareModal({
  credential,
  recipientType,
  onClose,
  onShared,
}: {
  credential: Credential;
  recipientType: 'company' | 'university';
  onClose: () => void;
  onShared: () => void;
}) {
  const toast = useToast();
  const [recipient, setRecipient] = useState('');
  const [recipientError, setRecipientError] = useState('');
  const [scopes, setScopes] = useState<string[]>(['Degree and institution', 'CGPA']);
  const [expires48, setExpires48] = useState(true);
  const [oneTime, setOneTime] = useState(false);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { profile } = useApp();

  async function generate() {
    if (busy) return;
    if (!recipient.trim()) {
      setRecipientError('Who is this for? Name the recipient.');
      return;
    }
    if (scopes.length === 0) {
      setRecipientError('Select at least one thing they can see.');
      return;
    }
    setBusy(true);
    try {
      await db.createShare({
        credential_id: credential.id,
        student_id: profile!.id,
        recipient_label: recipient.trim(),
        recipient_type: recipientType,
        scopes,
        expires_at: expires48 ? new Date(Date.now() + 48 * 3600000).toISOString() : null,
        one_time: oneTime,
        notify_on_view: notify,
      });
      setLink(`passage.app/v/${Math.random().toString(16).slice(2, 10)}`);
      onShared();
    } finally {
      setBusy(false);
    }
  }

  const toggles: { label: string; value: boolean; set: (v: boolean) => void }[] = [
    { label: 'Expires in 48 hours', value: expires48, set: setExpires48 },
    { label: 'One-time view only', value: oneTime, set: setOneTime },
    { label: 'Notify me when viewed', value: notify, set: setNotify },
  ];

  return (
    <Modal open onClose={onClose} labelledBy="share-title">
      <h2 id="share-title" className="mb-1 font-display text-xl text-parchment">
        Share {credential.title}
      </h2>
      <p className="mb-4 text-sm text-slate">You decide exactly what they see, and for how long.</p>

      {!link ? (
        <>
          <Input
            label="Share with"
            placeholder={recipientType === 'university' ? 'e.g. Carnegie Mellon — Graduate Admissions' : 'e.g. Sarvam AI — Recruiting'}
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
              setRecipientError('');
            }}
            error={recipientError}
          />

          <div className="mt-4">
            <div className="mb-2 text-xs font-medium text-slate">They can see</div>
            <div className="space-y-1.5">
              {SCOPE_OPTIONS.map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-2.5 rounded-btn px-2 py-1.5 text-sm text-parchment transition-colors hover:bg-ink-3">
                  <input
                    type="checkbox"
                    checked={scopes.includes(s)}
                    onChange={(e) =>
                      setScopes((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))
                    }
                    className="h-4 w-4 accent-[#E75C2B]"
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 text-xs font-medium text-slate">Access controls</div>
            <div className="space-y-2">
              {toggles.map((t) => (
                <button
                  key={t.label}
                  onClick={() => t.set(!t.value)}
                  className="flex w-full items-center justify-between rounded-btn px-2 py-1.5 text-sm text-parchment transition-colors hover:bg-ink-3"
                  role="switch"
                  aria-checked={t.value}
                >
                  {t.label}
                  <span
                    className={`relative h-5 w-9 rounded-full transition-colors ${t.value ? 'bg-orange' : 'bg-ink-3 border border-hairline'}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-parchment transition-all ${t.value ? 'left-[18px]' : 'left-0.5'}`}
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={busy} onClick={() => void generate()}>
              Generate secure link
            </Button>
          </div>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.45, bounce: 0.35 }}
        >
          <div className="flex flex-col items-center gap-4 rounded-card border border-hairline bg-ink-3/50 p-6">
            <div className="flex h-28 w-28 items-center justify-center rounded-card border border-dashed border-hairline-strong">
              <QrCode size={56} className="text-slate" />
            </div>
            <div className="flex w-full items-center gap-2">
              <code className="flex-1 truncate rounded-btn border border-hairline bg-ink px-3 py-2 font-mono text-sm text-parchment">
                {link}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(link).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check size={14} className="text-green" /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-center text-xs text-slate">
              Shared with <span className="text-parchment">{recipient}</span>. They now appear in your access list — revoke any time.
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => {
                toast('Secure link created');
                onClose();
              }}
            >
              Done
            </Button>
          </div>
        </motion.div>
      )}
    </Modal>
  );
}

/* ---------------- View credential modal ---------------- */

function ViewModal({ credential, onClose }: { credential: Credential; onClose: () => void }) {
  const issuer = db.getInstitutionSync(credential.issuing_institution_id);
  return (
    <Modal open onClose={onClose} wide labelledBy="view-cred-title">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id="view-cred-title" className="font-display text-xl text-parchment">{credential.title}</h2>
          <p className="text-sm text-slate">Issued by {issuer?.name} · {fmtDate(credential.issued_date)}</p>
        </div>
        <Pill tone="green"><ShieldCheck size={12} /> Verified</Pill>
      </div>
      <div className="space-y-2 rounded-card border border-hairline bg-ink-3/40 p-4 text-sm">
        <div className="flex justify-between"><span className="text-slate">Student</span><span className="text-parchment">{credential.payload.student_name}</span></div>
        <div className="flex justify-between"><span className="text-slate">ID</span><span className="font-mono text-parchment">{credential.payload.student_id}</span></div>
        <div className="flex justify-between"><span className="text-slate">Degree</span><span className="text-parchment">{credential.payload.degree}</span></div>
        <div className="flex justify-between"><span className="text-slate">CGPA</span><span className="font-mono text-parchment">{credential.payload.cgpa}</span></div>
      </div>
      {credential.payload.courses && (
        <div className="mt-4 overflow-x-auto rounded-card border border-hairline">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-3 text-left text-xs text-slate">
                <th className="px-3 py-2 font-medium">Course</th>
                <th className="px-3 py-2 font-medium">Credits</th>
                <th className="px-3 py-2 font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {credential.payload.courses.map((c) => (
                <tr key={c.name} className="border-t border-hairline">
                  <td className="px-3 py-2 text-parchment">{c.name}</td>
                  <td className="px-3 py-2 font-mono text-slate">{c.credits}</td>
                  <td className="px-3 py-2 font-mono text-parchment">{c.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 font-mono text-xs text-slate">
        hash {credential.hash.slice(0, 26)}… · signed by {issuer?.name}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

/* ---------------- Request credential modal ---------------- */

function RequestModal({ onClose, onRequested }: { onClose: () => void; onRequested: () => void }) {
  const { profile } = useApp();
  const toast = useToast();
  const [type, setType] = useState<CredentialType | null>(null);
  const [typeError, setTypeError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const home = profile?.home_institution_id ? db.getInstitutionSync(profile.home_institution_id) : null;

  async function submit() {
    if (busy) return;
    if (!type) {
      setTypeError('Pick what you need.');
      return;
    }
    if (!home || !profile) return;
    setBusy(true);
    try {
      await db.createCredentialRequest({
        student_id: profile.id,
        institution_id: home.id,
        credential_type: type,
        note: note.trim() || null,
      });
      toast(`Request sent to ${home.name}`);
      onRequested();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="req-title">
      <h2 id="req-title" className="mb-1 font-display text-xl text-parchment">Request a credential</h2>
      <p className="mb-4 text-sm text-slate">Your college signs it; it lands in your vault.</p>

      <div className="mb-2 text-xs font-medium text-slate">From</div>
      <div className="mb-1 flex items-center gap-3 rounded-card border border-hairline bg-ink-3/50 p-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange/15 font-display text-sm font-semibold text-orange">
          {home?.initials ?? '?'}
        </div>
        <div className="text-sm text-parchment">{home?.name ?? 'No home institution on your profile'}</div>
      </div>
      <p className="mb-4 text-xs text-slate-2">You can only request credentials from the institution you attended.</p>

      <div className="mb-2 text-xs font-medium text-slate">What you need</div>
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {REQUEST_TYPES.map((r) => (
          <button
            key={r.type}
            onClick={() => {
              setType(r.type);
              setTypeError('');
            }}
            className={`rounded-card border p-3 text-left transition-all ${type === r.type ? 'border-orange bg-orange/10' : 'border-hairline bg-ink-3/40 hover:border-hairline-strong'}`}
          >
            <div className="text-sm font-medium text-parchment">{r.label}</div>
            <div className="mt-0.5 text-xs text-slate">{r.sub}</div>
          </button>
        ))}
      </div>
      {typeError && <p className="mb-3 -mt-2 text-xs text-red">{typeError}</p>}

      <Textarea
        label="Reason (optional)"
        rows={2}
        placeholder="e.g. Required for my Carnegie Mellon application, deadline Dec 15."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={busy} onClick={() => void submit()} disabled={!home}>Send request</Button>
      </div>
    </Modal>
  );
}

/* ---------------- main vault page ---------------- */

export default function Vault() {
  const { profile, track } = useApp();
  const toast = useToast();
  const recipientType: 'company' | 'university' = track === 'studies' ? 'university' : 'company';

  const [credentials, setCredentials] = useState<Credential[] | null>(null);
  const [shares, setShares] = useState<CredentialShare[] | null>(null);
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof db.listCredentialRequestsByStudent>> | null>(null);
  const [error, setError] = useState(false);
  const [shareTarget, setShareTarget] = useState<Credential | null>(null);
  const [viewTarget, setViewTarget] = useState<Credential | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<CredentialShare | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadAll = useCallback(async () => {
    if (!profile) return;
    setError(false);
    try {
      const [creds, shs, reqs] = await Promise.all([
        db.listCredentialsByStudent(profile.id),
        db.listSharesByStudent(profile.id, recipientType),
        db.listCredentialRequestsByStudent(profile.id),
      ]);
      setCredentials(creds);
      setShares(shs);
      setRequests(reqs);
    } catch {
      setError(true);
    }
  }, [profile, recipientType]);

  useEffect(() => {
    setCredentials(null);
    setShares(null);
    void loadAll();
  }, [loadAll]);

  const refreshShares = useCallback(() => {
    if (profile) void db.listSharesByStudent(profile.id, recipientType).then(setShares);
  }, [profile, recipientType]);

  const refreshRequests = useCallback(() => {
    if (profile) void db.listCredentialRequestsByStudent(profile.id).then(setRequests);
  }, [profile]);

  const activeShares = useMemo(() => (shares ?? []).filter(() => true), [shares]);

  async function confirmRevoke() {
    if (!revokeTarget || revoking) return;
    setRevoking(true);
    try {
      await db.revokeShare(revokeTarget.id);
      toast('Access revoked — link is now dead');
      refreshShares();
      setRevokeTarget(null);
    } finally {
      setRevoking(false);
    }
  }

  if (error) return <ErrorState onRetry={() => void loadAll()} />;

  return (
    <div>
      <Eyebrow>Credential vault</Eyebrow>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageTitle>Your record. Held by you.</PageTitle>
          <p className="mt-2 text-sm text-slate">Signed by your institution. Verifiable by anyone. Revocable by you.</p>
        </div>
        <Button onClick={() => setRequestOpen(true)}>
          <FileQuestion size={15} /> Request a credential
        </Button>
      </div>

      {/* credential cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {credentials === null ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-surface space-y-3 p-5">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))
        ) : credentials.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState
              icon={ShieldCheck}
              title="No credentials yet"
              body="Request a signed record from your college — it appears here the moment they issue it."
              action={<Button onClick={() => setRequestOpen(true)}>Request a credential</Button>}
            />
          </div>
        ) : (
          credentials.map((c, idx) => {
            const issuer = db.getInstitutionSync(c.issuing_institution_id);
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.06, 0.35), duration: 0.3 }}
              >
              <TiltCard amplitude={6} className="h-full">
              <Card className="flex h-full flex-col p-5">
                <div className="mb-3 flex items-start justify-between">
                  <div className="seal-circle flex h-10 w-10 items-center justify-center rounded-full border border-orange/40 font-display text-sm font-semibold text-orange">
                    {issuer?.initials}
                  </div>
                  <Pill tone="green"><ShieldCheck size={11} /> Verified</Pill>
                </div>
                <h3 className="font-display text-lg font-semibold text-parchment">{c.title}</h3>
                <p className="text-xs text-slate">Issued by {issuer?.name}</p>
                <p className="mt-1 font-mono text-xs text-slate">{c.issued_date}</p>
                <p className="mt-1 font-mono text-xs text-slate">{truncateHash(c.hash)}</p>
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => setViewTarget(c)}>
                    <Eye size={13} /> View
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => setShareTarget(c)}>
                    <Share2 size={13} /> Share
                  </Button>
                </div>
              </Card>
              </TiltCard>
              </motion.div>
            );
          })
        )}
      </div>

      {/* access log */}
      <div className="mt-12">
        <h2 className="font-display text-2xl font-semibold text-parchment">Who has access</h2>
        <p className="mt-1 text-sm text-slate">Revoke a link any time — it dies instantly.</p>

        <div className="mt-5 space-y-3">
          {shares === null ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="card-surface flex items-center justify-between p-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))
          ) : activeShares.length === 0 ? (
            <EmptyState
              icon={Share2}
              title="Nothing shared yet"
              body={`When you share a credential with a ${recipientType === 'university' ? 'university' : 'company'}, it appears here with full view history.`}
            />
          ) : (
            activeShares.map((s) => {
              const exp = expiryLabel(s);
              return (
                <div
                  key={s.id}
                  className={`card-surface flex flex-col gap-3 p-4 transition-opacity sm:flex-row sm:items-center sm:justify-between ${s.revoked ? 'opacity-45' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="font-display text-base font-semibold text-parchment">{s.recipient_label}</div>
                    <div className="text-xs text-slate">Can see: {s.scopes.join(', ')}</div>
                    <div className="mt-1 font-mono text-xs text-slate">
                      shared {relTime(s.created_at)} · viewed {s.view_count}× · last{' '}
                      {s.last_viewed_at ? fmtDateTime(s.last_viewed_at) : 'never'}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {s.revoked ? (
                      <Pill tone="red">Revoked</Pill>
                    ) : (
                      <>
                        <span className={`text-xs font-medium ${exp.tone === 'orange' ? 'text-orange' : 'text-slate'}`}>
                          {exp.text}
                        </span>
                        <Button variant="danger" size="sm" onClick={() => setRevokeTarget(s)}>
                          Revoke
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* your requests */}
      <div className="mt-12">
        <h2 className="font-display text-2xl font-semibold text-parchment">Your requests</h2>
        <p className="mt-1 text-sm text-slate">What you've asked your college for.</p>

        <div className="mt-5 space-y-3">
          {requests === null ? (
            <Skeleton className="h-20 w-full rounded-card" />
          ) : requests.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No requests yet"
              body="Ask your college for a signed transcript, marksheet or certificate — they'll issue it into your vault."
              action={<Button variant="secondary" onClick={() => setRequestOpen(true)}>Request a credential</Button>}
            />
          ) : (
            requests.map((r) => {
              const inst = db.getInstitutionSync(r.institution_id);
              const typeLabel = REQUEST_TYPES.find((t) => t.type === r.credential_type)?.label ?? r.credential_type;
              const olderThan3Days = Date.now() - new Date(r.requested_at).getTime() > 3 * 86400000;
              return (
                <div key={r.id} className="card-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-display text-base font-semibold text-parchment">{typeLabel}</div>
                    <div className="text-xs text-slate">{inst?.name}</div>
                    <div className="mt-1 font-mono text-xs text-slate">requested {fmtDate(r.requested_at)}</div>
                    {r.status === 'declined' && r.decline_reason && (
                      <div className="mt-1.5 text-xs text-red">Reason: {r.decline_reason}</div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {r.status === 'pending' && (
                      <>
                        <Pill tone="orange">Awaiting institution</Pill>
                        {olderThan3Days && (
                          <button
                            className="text-xs text-slate underline-offset-2 transition-colors hover:text-parchment hover:underline"
                            onClick={() => toast(`Reminder sent to ${inst?.name}`)}
                          >
                            Send a reminder
                          </button>
                        )}
                      </>
                    )}
                    {r.status === 'issued' && (
                      <>
                        <Pill tone="green"><BadgeCheck size={11} /> Issued</Pill>
                        <button
                          className="text-xs text-green underline-offset-2 hover:underline"
                          onClick={() => {
                            const cred = credentials?.find((c) => c.id === r.resolved_credential_id);
                            if (cred) setViewTarget(cred);
                            else window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                        >
                          View in vault
                        </button>
                      </>
                    )}
                    {r.status === 'declined' && <Pill tone="red">Declined</Pill>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* modals */}
      {shareTarget && (
        <ShareModal
          credential={shareTarget}
          recipientType={recipientType}
          onClose={() => setShareTarget(null)}
          onShared={refreshShares}
        />
      )}
      {viewTarget && <ViewModal credential={viewTarget} onClose={() => setViewTarget(null)} />}
      {requestOpen && <RequestModal onClose={() => setRequestOpen(false)} onRequested={refreshRequests} />}

      <Modal open={!!revokeTarget} onClose={() => setRevokeTarget(null)} labelledBy="revoke-title">
        <h2 id="revoke-title" className="mb-2 font-display text-xl text-parchment">Revoke this access?</h2>
        <p className="mb-5 text-sm text-slate">
          <span className="text-parchment">{revokeTarget?.recipient_label}</span> will lose access immediately. The
          link they hold stops working.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRevokeTarget(null)}>Keep access</Button>
          <Button variant="danger-solid" loading={revoking} onClick={() => void confirmRevoke()}>
            Revoke
          </Button>
        </div>
      </Modal>
    </div>
  );
}
