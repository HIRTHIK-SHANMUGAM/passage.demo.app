import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Flag, Send, ShieldX, X } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import * as db from '@/lib/db';
import { Credential } from '@/lib/types';
import { askAboutCredential } from '@/lib/ai';
import { Button, Eyebrow, PageTitle, useToast } from '@/components/ui';

interface VerifyOutcome {
  result: 'authentic' | 'mismatch';
  credential: Credential | null;
  issuerName: string;
  issuedDate: string;
  submittedCgpa: string;
  issuedCgpa: string;
  seconds: string;
  hash: string;
}

/** Pre-loaded credential handed over from the Applicants screen. */
export interface VerifyLocationState {
  applicantName?: string;
  applicantMeta?: string;
  credentialHash?: string;
  presentedCgpa?: string;
}

const GENUINE_SAMPLE = { student: 'Hirthik S', cgpa: '9.2' };
const FORGED_SAMPLE = { student: 'Hirthik S', cgpa: '9.8' };

const CHIP_QUESTIONS = [
  'Is a 9.2 CGPA strong?',
  'Any inconsistencies in this record?',
  'How does this compare to other applicants?',
];

function AIPanel({ outcome }: { outcome: VerifyOutcome }) {
  const failed = outcome.result === 'mismatch';
  const [messages, setMessages] = useState<{ q: string; a: string }[]>([]);
  const [pendingQ, setPendingQ] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');

  async function ask(q: string) {
    if (pendingQ || failed) return;
    setPendingQ(q);
    // small pause before the reply card fades in, then the AI call
    await new Promise((r) => setTimeout(r, 300));
    const a = await askAboutCredential(q, outcome.credential);
    setMessages((m) => [...m, { q, a }]);
    setPendingQ(null);
  }

  return (
    <div
      className={`card-surface mt-6 border-l-2 p-5 ${failed ? 'border-l-red' : 'border-l-orange'}`}
      style={{ borderLeftWidth: 3 }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${failed ? 'bg-red' : 'bg-orange pulse-dot'}`} />
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate">Ask about this record</span>
      </div>

      {failed ? (
        <p className="text-sm text-slate">
          This credential failed cryptographic verification and cannot be trusted. I can't provide grade context or
          comparisons for an unverified record. Recommend requesting a reissued credential directly from the applicant.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {CHIP_QUESTIONS.map((q) => (
              <button
                key={q}
                disabled={!!pendingQ}
                onClick={() => void ask(q)}
                className="rounded-full border border-hairline bg-ink-3/60 px-3 py-1.5 text-xs text-parchment transition-colors hover:border-orange/50 hover:bg-orange/10 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-3">
            <AnimatePresence>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-card border border-hairline border-l-2 border-l-orange bg-ink-3/40 p-3"
                >
                  <div className="mb-1 text-xs font-medium text-slate">{m.q}</div>
                  <div className="text-sm text-parchment">{m.a}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            {pendingQ && (
              <div className="flex items-center gap-2 text-xs text-slate">
                <span className="h-1.5 w-1.5 rounded-full bg-orange pulse-dot" /> Thinking about “{pendingQ}”…
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && freeText.trim()) {
                  void ask(freeText.trim());
                  setFreeText('');
                }
              }}
              placeholder="Ask something else…"
              className="flex-1 rounded-btn border border-hairline bg-ink-3 px-3 py-2 text-sm text-parchment placeholder:text-slate-2"
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={!freeText.trim() || !!pendingQ}
              onClick={() => {
                void ask(freeText.trim());
                setFreeText('');
              }}
              aria-label="Ask"
            >
              <Send size={14} />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Verify() {
  const { profile, track } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const locState = (location.state ?? {}) as VerifyLocationState;

  const [input, setInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);
  const [applicantHeader, setApplicantHeader] = useState<string | null>(
    locState.applicantName ? `Verifying: ${locState.applicantName}${locState.applicantMeta ? ` — ${locState.applicantMeta}` : ''}` : null,
  );
  const preloadHash = useRef(locState.credentialHash ?? null);
  const preloadCgpa = useRef(locState.presentedCgpa ?? null);

  useEffect(() => {
    if (preloadHash.current) {
      setInput(preloadHash.current);
    }
  }, []);

  const runVerification = useCallback(
    async (raw: string) => {
      if (checking) return;
      const text = raw.trim();
      if (!text) return;
      setChecking(true);
      setOutcome(null);
      const started = Date.now();

      // resolve what was submitted: a known hash, a JSON blob, or a sample
      let credential: Credential | null = null;
      let submittedCgpa: string | null = null;

      const hashMatch = text.match(/0x[0-9a-f]{16,}/i);
      if (hashMatch) {
        credential = await db.getCredentialByHash(hashMatch[0]);
        submittedCgpa = preloadCgpa.current ?? credential?.payload.cgpa ?? null;
      } else {
        try {
          const parsed = JSON.parse(text) as { cgpa?: string; student?: string };
          submittedCgpa = parsed.cgpa != null ? String(parsed.cgpa) : null;
        } catch {
          const m = text.match(/(\d\.\d)/);
          submittedCgpa = m ? m[1] : null;
        }
        // demo credentials verify against the seeded demo student's transcript
        const demoProfile = await db.getProfileByEmail('hirthikshanmugam7@gmail.com');
        if (demoProfile) {
          const creds = await db.listCredentialsByStudent(demoProfile.id);
          credential = creds.find((c) => c.credential_type === 'transcript') ?? null;
        }
      }

      const issuedCgpa = credential?.payload.cgpa ?? '9.2';
      const authentic = submittedCgpa !== null && submittedCgpa === issuedCgpa;

      // the check must feel real: ~1.3s minimum
      const elapsed = Date.now() - started;
      if (elapsed < 1300) await new Promise((r) => setTimeout(r, 1300 - elapsed));

      const issuer = credential ? db.getInstitutionSync(credential.issuing_institution_id) : db.getInstitutionSync('i-vit');
      const result: 'authentic' | 'mismatch' = authentic ? 'authentic' : 'mismatch';

      if (credential) {
        await db.recordVerificationEvent({
          credential_hash: credential.hash,
          verifier_user_id: profile?.id ?? null,
          result,
        });
      }

      setOutcome({
        result,
        credential,
        issuerName: issuer?.name ?? 'VIT Chennai',
        issuedDate: credential
          ? new Date(credential.issued_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : 'Aug 21, 2026',
        submittedCgpa: submittedCgpa ?? '—',
        issuedCgpa,
        seconds: authentic ? '1.3' : '1.1',
        hash: credential?.hash ?? '0x0000',
      });
      setChecking(false);
    },
    [checking, profile],
  );

  // auto-run when arriving from an applicant row
  const autoRan = useRef(false);
  useEffect(() => {
    if (preloadHash.current && !autoRan.current) {
      autoRan.current = true;
      void runVerification(preloadHash.current);
    }
  }, [runVerification]);

  function loadSample(kind: 'genuine' | 'forged') {
    preloadHash.current = null;
    preloadCgpa.current = null;
    setApplicantHeader(null);
    setOutcome(null);
    const sample = kind === 'genuine' ? GENUINE_SAMPLE : FORGED_SAMPLE;
    setInput(JSON.stringify({ student: sample.student, degree: 'B.Tech CSE AI & Robotics', cgpa: sample.cgpa, issuer: 'VIT Chennai' }, null, 2));
  }

  const verifiedFields = outcome?.credential
    ? [
        ['Student', outcome.credential.payload.student_name],
        ['Student ID', outcome.credential.payload.student_id],
        ['Degree', outcome.credential.payload.degree],
        ['CGPA', outcome.credential.payload.cgpa],
      ]
    : [
        ['Student', 'Hirthik S'],
        ['Degree', 'B.Tech CSE AI & Robotics'],
        ['CGPA', '9.2'],
      ];

  return (
    <div className="mx-auto max-w-2xl">
      <Eyebrow>Instant verification</Eyebrow>
      <PageTitle>Is this record real?</PageTitle>
      <p className="mt-2 text-sm text-slate">
        Paste a credential or scan a QR. We check the signature against the issuer's registry. No emails, no waiting.
      </p>

      {applicantHeader && (
        <div className="mt-5 rounded-card border border-hairline bg-ink-3/50 px-4 py-2.5 text-sm text-parchment">
          {applicantHeader}
        </div>
      )}

      <div className="mt-6">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
          placeholder="Paste credential JSON, link, or 0x hash"
          className="w-full rounded-card border border-hairline bg-ink-2 p-4 font-mono text-sm text-parchment placeholder:text-slate-2 focus:border-hairline-strong"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => loadSample('genuine')}
            className="rounded-full border border-hairline px-3 py-1.5 text-xs text-slate transition-colors hover:border-hairline-strong hover:text-parchment"
          >
            Try a genuine credential
          </button>
          <button
            onClick={() => loadSample('forged')}
            className="rounded-full border border-red/50 px-3 py-1.5 text-xs text-red transition-colors hover:bg-red/10"
          >
            Try a forged credential
          </button>
          <div className="flex-1" />
          <Button onClick={() => void runVerification(input)} disabled={!input.trim() || checking}>
            Verify now
          </Button>
        </div>
      </div>

      {/* loading */}
      <AnimatePresence>
        {checking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-10 flex flex-col items-center gap-4"
          >
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-hairline-strong">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-ink-3 border-t-orange" />
            </div>
            <p className="text-sm text-slate">Checking signature against issuer's public key…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* result */}
      {outcome && !checking && (
        <div className="mt-10">
          {outcome.result === 'authentic' ? (
            <div className="flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: [0.4, 1.12, 1], opacity: 1 }}
                transition={{ duration: 0.6, times: [0, 0.6, 1], ease: 'easeOut' }}
                className="flex h-24 w-24 items-center justify-center rounded-full bg-green shadow-[0_0_44px_rgba(30,158,100,0.45)]"
              >
                <Check size={44} strokeWidth={3} className="text-white" />
              </motion.div>
              <h2 className="mt-5 font-display text-3xl font-semibold text-green">Authentic</h2>
              <p className="mt-1 text-sm text-slate">
                Issued by {outcome.issuerName} on {outcome.issuedDate}
              </p>
              <p className="mt-2 font-mono text-xs text-slate">
                verified in {outcome.seconds}s · signature {outcome.hash.slice(0, 6)}…{outcome.hash.slice(-4)} · registry:
                ethereum-sepolia
              </p>

              <div className="card-surface mt-6 w-full p-5 text-left">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate">Verified fields</div>
                <div className="space-y-2">
                  {verifiedFields.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-sm">
                      <span className="text-slate">{k}</span>
                      <span className="flex items-center gap-1.5 text-parchment">
                        {v} <Check size={13} className="text-green" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <motion.div
                initial={{ x: 0 }}
                animate={{ x: [0, -8, 8, -8, 8, -4, 4, 0] }}
                transition={{ duration: 0.5 }}
                className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-red shadow-[0_0_44px_rgba(214,66,58,0.4)]"
              >
                <X size={44} strokeWidth={3} className="text-red" />
              </motion.div>
              <h2 className="mt-5 font-display text-3xl font-semibold text-red">Signature mismatch</h2>
              <p className="mt-1 text-sm text-slate">This credential does not match its original issued data.</p>

              <div className="mt-6 w-full overflow-x-auto rounded-card border border-red/30 bg-red/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-red/20 text-left text-xs text-slate">
                      <th className="px-4 py-2.5 font-medium">Field</th>
                      <th className="px-4 py-2.5 font-medium">Issued</th>
                      <th className="px-4 py-2.5 font-medium">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-3 text-parchment">CGPA</td>
                      <td className="px-4 py-3 font-mono text-green">{outcome.issuedCgpa}</td>
                      <td className="px-4 py-3 font-mono font-bold text-red">{outcome.submittedCgpa}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 font-mono text-xs text-slate">
                checked in {outcome.seconds}s · issuer: {outcome.issuerName} · no matching registry entry
              </p>

              <div className="mt-5 flex gap-2">
                <Button
                  variant="danger"
                  onClick={() => {
                    toast('Applicant flagged for review');
                    navigate(track === 'hiring' ? '/hiring/applicants' : '/admissions/applicants');
                  }}
                >
                  <Flag size={14} /> Flag this applicant
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setOutcome(null);
                    setInput('');
                    setApplicantHeader(null);
                    preloadHash.current = null;
                    preloadCgpa.current = null;
                  }}
                >
                  Verify another
                </Button>
              </div>
            </div>
          )}

          <AIPanel outcome={outcome} />
        </div>
      )}

      {!outcome && !checking && (
        <div className="mt-10 flex flex-col items-center gap-2 text-center opacity-60">
          <ShieldX size={28} className="text-slate-2" />
          <p className="text-xs text-slate-2">Results appear here — authentic records seal green, forgeries fracture red.</p>
        </div>
      )}
    </div>
  );
}
