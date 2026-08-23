import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, Star, Users, X } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import * as db from '@/lib/db';
import { ApplicantRow } from '@/lib/types';
import {
  AvatarCircle,
  Button,
  EmptyState,
  ErrorState,
  Eyebrow,
  MatchPct,
  Modal,
  PageTitle,
  Pill,
  SkeletonRows,
  useToast,
} from '@/components/ui';

type FilterChip = 'all' | 'verified' | 'pending' | 'failed';

function ViewApplicantModal({ row, onClose }: { row: ApplicantRow; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} labelledBy="applicant-title">
      <div className="flex items-center gap-3">
        <AvatarCircle text={(row.profile.full_name ?? '?').slice(0, 1)} size={44} colorSeed={row.profile.id} />
        <div>
          <h2 id="applicant-title" className="font-display text-xl text-parchment">{row.profile.full_name}</h2>
          <p className="text-xs text-slate">
            {row.profile.degree} · {row.homeInstitution?.name}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2 rounded-card border border-hairline bg-ink-3/40 p-4 text-sm">
        <div className="flex justify-between"><span className="text-slate">Student ID</span><span className="font-mono text-parchment">{row.profile.student_id}</span></div>
        <div className="flex justify-between"><span className="text-slate">CGPA</span><span className="font-mono text-parchment">{row.profile.cgpa}</span></div>
        <div className="flex justify-between"><span className="text-slate">GATE</span><span className="font-mono text-parchment">{row.examScores.gate}</span></div>
        <div className="flex justify-between"><span className="text-slate">Status</span><span className="capitalize text-parchment">{row.application.status.replace('_', ' ')}</span></div>
        <div className="flex justify-between">
          <span className="text-slate">Credentials</span>
          <span>
            {row.verification === 'verified' && <Pill tone="green">Verified</Pill>}
            {row.verification === 'pending' && <Pill tone="orange">Pending</Pill>}
            {row.verification === 'failed' && <Pill tone="red">Failed</Pill>}
          </span>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

export default function Applicants() {
  const { activeInstitution, track } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const focus = (location.state ?? {}) as { jobPostingId?: string; programId?: string; targetName?: string };
  const isAdmissions = track === 'admissions';

  const [rows, setRows] = useState<ApplicantRow[] | null>(null);
  const [error, setError] = useState(false);
  const [chip, setChip] = useState<FilterChip>('all');
  const [byScore, setByScore] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ApplicantRow | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [viewTarget, setViewTarget] = useState<ApplicantRow | null>(null);
  const [shortlisted, setShortlisted] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  const targetType = isAdmissions ? 'program' : 'job';

  const load = useCallback(async () => {
    if (!activeInstitution) return;
    setError(false);
    setRows(null);
    try {
      // every applicant query is scoped to the active institution — no
      // unscoped fetch exists in the data layer
      const data = await db.listApplicantsByInstitution(activeInstitution.id, {
        targetType,
        jobPostingId: focus.jobPostingId,
        programId: focus.programId,
      });
      setRows(data);
      setShortlisted(
        new Set(
          data
            .filter((r) => Boolean((r.application.documents as Record<string, unknown>).shortlisted_by_institution))
            .map((r) => r.application.id),
        ),
      );
    } catch {
      setError(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeInstitution?.id, targetType, focus.jobPostingId, focus.programId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let out = rows ?? [];
    if (chip === 'verified') out = out.filter((r) => r.verification === 'verified');
    if (chip === 'pending') out = out.filter((r) => r.verification === 'pending');
    if (chip === 'failed') out = out.filter((r) => r.verification === 'failed');
    if (byScore) {
      out = [...out].sort((a, b) => (b.profile.cgpa ?? 0) - (a.profile.cgpa ?? 0));
    }
    return out;
  }, [rows, chip, byScore]);

  async function confirmReject() {
    if (!rejectTarget || rejecting) return;
    setRejecting(true);
    try {
      await db.updateApplication(rejectTarget.application.id, { status: 'rejected' });
      const id = rejectTarget.application.id;
      setRejectTarget(null);
      setRemoving((s) => new Set(s).add(id));
      setTimeout(() => {
        setRows((r) => (r ? r.filter((x) => x.application.id !== id) : r));
        setRemoving((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      }, 320);
      toast('Applicant rejected');
    } finally {
      setRejecting(false);
    }
  }

  async function toggleShortlist(row: ApplicantRow) {
    const id = row.application.id;
    const nowOn = !shortlisted.has(id);
    setShortlisted((s) => {
      const n = new Set(s);
      if (nowOn) n.add(id);
      else n.delete(id);
      return n;
    });
    await db.updateApplication(id, {
      documents: { ...row.application.documents, shortlisted_by_institution: nowOn },
    });
    toast(nowOn ? `${row.profile.full_name} shortlisted` : `Removed from shortlist`);
  }

  function verifyNow(row: ApplicantRow, forgeIt: boolean) {
    navigate(isAdmissions ? '/admissions/verify' : '/hiring/verify', {
      state: {
        applicantName: row.profile.full_name,
        applicantMeta: `${row.profile.degree}, ${row.homeInstitution?.name}`,
        credentialHash: row.credential?.hash,
        // failed rows re-show the forgery; pending rows verify the real value
        presentedCgpa: forgeIt
          ? String(Math.min(9.9, (parseFloat(row.credential?.payload.cgpa ?? '9') + 0.6)).toFixed(1))
          : row.credential?.payload.cgpa,
      },
    });
  }

  if (!activeInstitution) return null;

  const targetName = focus.targetName ?? (isAdmissions ? 'M.Tech CSE' : 'your roles');
  const chips: { key: FilterChip; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'verified', label: isAdmissions ? 'Verified' : 'Verified only' },
    { key: 'pending', label: 'Pending' },
    { key: 'failed', label: 'Failed' },
  ];

  return (
    <div>
      <Eyebrow>Applicants</Eyebrow>
      <PageTitle>
        {focus.targetName
          ? `${focus.targetName} — applicants`
          : `${activeInstitution.name} — applicants`}
      </PageTitle>
      <p className="mt-2 text-sm text-slate">
        {rows === null
          ? 'Loading applications…'
          : `${rows.length} application${rows.length === 1 ? '' : 's'} ${focus.targetName ? `for ${isAdmissions ? 'this program' : 'this role'}` : `to ${activeInstitution.name}${isAdmissions ? "'s programs" : "'s roles"}`}. ${isAdmissions ? 'Transcript authenticity' : 'Credential status'} is checked automatically.`}
      </p>
      {void targetName}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            onClick={() => setChip(c.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${chip === c.key ? 'bg-orange text-white' : 'border border-hairline bg-ink-2 text-slate hover:text-parchment'}`}
          >
            {c.label}
          </button>
        ))}
        {isAdmissions && (
          <button
            onClick={() => setByScore((b) => !b)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${byScore ? 'bg-orange text-white' : 'border border-hairline bg-ink-2 text-slate hover:text-parchment'}`}
          >
            By exam score
          </button>
        )}
      </div>

      <div className="mt-6 space-y-3">
        {error ? (
          <ErrorState onRetry={() => void load()} />
        ) : rows === null ? (
          <SkeletonRows rows={5} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={chip === 'all' ? 'No applicants yet' : `No ${chip} applicants`}
            body={
              chip === 'all'
                ? `When someone applies to ${activeInstitution.name}, they appear here with their credential status.`
                : 'Try a different filter.'
            }
            action={chip !== 'all' ? <Button variant="secondary" onClick={() => setChip('all')}>Show all</Button> : undefined}
          />
        ) : (
          <AnimatePresence>
            {filtered.map((row) => (
              <motion.div
                key={row.application.id}
                layout
                initial={false}
                animate={{ opacity: removing.has(row.application.id) ? 0 : 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="card-surface p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <AvatarCircle text={(row.profile.full_name ?? '?').slice(0, 1)} size={42} colorSeed={row.profile.id} />
                    <div className="min-w-0 flex-1">
                      <div className="font-display text-base font-semibold text-parchment">{row.profile.full_name}</div>
                      <div className="text-xs text-slate">
                        {row.profile.degree}{isAdmissions ? ', ' : ' · '}{row.homeInstitution?.name}
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-slate">
                        CGPA {row.profile.cgpa}
                        {isAdmissions && <>{'  '}GATE: {row.examScores.gate}{'  '}TOEFL: {row.examScores.toefl}</>}
                      </div>
                    </div>

                    {row.verification === 'verified' && (
                      <Pill tone="green" dot>Credentials verified</Pill>
                    )}
                    {row.verification === 'pending' && (
                      <span className="flex items-center gap-1.5">
                        <Pill tone="orange" dot live>Verification pending</Pill>
                        <Button size="sm" variant="secondary" onClick={() => verifyNow(row, false)}>
                          Verify now
                        </Button>
                      </span>
                    )}
                    {row.verification === 'failed' && (
                      <Pill tone="red" dot>Verification failed</Pill>
                    )}

                    {!isAdmissions && <MatchPct pct={row.matchPct} />}

                    <div className="flex items-center gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setViewTarget(row)}>
                        <Eye size={13} /> View
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        className={shortlisted.has(row.application.id) ? 'border-green/50 text-green' : ''}
                        onClick={() => void toggleShortlist(row)}
                      >
                        <Star size={13} /> {shortlisted.has(row.application.id) ? 'Shortlisted' : 'Shortlist'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        aria-label={`Reject ${row.profile.full_name}`}
                        onClick={() => setRejectTarget(row)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>

                  {row.verification === 'failed' && (
                    <button
                      onClick={() => verifyNow(row, true)}
                      className="mt-3 block text-left text-xs text-red underline-offset-2 hover:underline"
                    >
                      This {isAdmissions ? 'transcript' : 'credential'} failed verification — review it in the Verify tab →
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {viewTarget && <ViewApplicantModal row={viewTarget} onClose={() => setViewTarget(null)} />}

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} labelledBy="reject-title">
        <h2 id="reject-title" className="mb-2 font-display text-xl text-parchment">Reject this applicant?</h2>
        <p className="mb-5 text-sm text-slate">
          <span className="text-parchment">{rejectTarget?.profile.full_name}</span> will be removed from your list.
          This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" autoFocus onClick={() => setRejectTarget(null)}>
            No, keep them
          </Button>
          <Button variant="danger-solid" loading={rejecting} onClick={() => void confirmReject()}>
            Yes, reject
          </Button>
        </div>
      </Modal>
    </div>
  );
}
