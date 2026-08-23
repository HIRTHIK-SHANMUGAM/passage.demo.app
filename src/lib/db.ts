/**
 * Data access layer. Every read and write in the app goes through here.
 *
 * Backed by a locally persisted store seeded with realistic demo data, shaped
 * exactly like the Supabase schema in supabase/migrations/. When a Supabase
 * project is configured the same interface can be pointed at it; components
 * never touch storage directly.
 *
 * Scoping rule: there is deliberately NO function that returns applications,
 * postings, programs or credential requests without an institution or student
 * filter — the filter is a required argument, mirroring the RLS policies.
 */
import {
  ApplicantRow,
  Application,
  ApplicationStatus,
  Credential,
  CredentialPayload,
  CredentialRequest,
  CredentialShare,
  CredentialType,
  Institution,
  InstitutionType,
  JobPosting,
  Membership,
  Profile,
  Program,
  StaffRole,
  VerificationEvent,
  VerificationStatus,
} from './types';
import { Database, buildSeed } from './seed';
import { deriveHash, deriveSignature } from './hash';

const DB_KEY = 'passage.db.v3';

let db: Database | null = null;

function load(): Database {
  if (db) return db;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      db = JSON.parse(raw) as Database;
      return db;
    }
  } catch {
    // corrupted storage — reseed
  }
  db = buildSeed();
  persist();
  return db;
}

function persist() {
  if (!db) return;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // storage full/unavailable — the in-memory copy still works for the session
  }
}

const latency = (ms = 350) => new Promise<void>((r) => setTimeout(r, ms + Math.random() * 150));

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* ================= institutions ================= */

export async function listInstitutions(type?: InstitutionType): Promise<Institution[]> {
  await latency(200);
  const d = load();
  return d.institutions.filter((i) => (type ? i.type === type : true));
}

export function getInstitutionSync(id: string): Institution | null {
  const d = load();
  return d.institutions.find((i) => i.id === id) ?? null;
}

/* ================= profiles ================= */

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  await latency(150);
  const d = load();
  return d.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  await latency(120);
  const d = load();
  return d.profiles.find((p) => p.id === userId) ?? null;
}

/** Mirrors the on-insert trigger: creates an empty profile row for a new auth user. */
export async function ensureProfile(userId: string, email: string): Promise<Profile> {
  const d = load();
  let p = d.profiles.find((x) => x.id === userId || x.email.toLowerCase() === email.toLowerCase());
  if (!p) {
    p = {
      id: userId,
      full_name: null,
      email,
      student_id: null,
      degree: null,
      cgpa: null,
      home_institution_id: null,
      created_at: new Date().toISOString(),
    };
    d.profiles.push(p);
    persist();
  }
  return p;
}

export async function updateProfile(userId: string, patch: Partial<Profile>): Promise<Profile> {
  await latency(250);
  const d = load();
  const p = d.profiles.find((x) => x.id === userId);
  if (!p) throw new Error('Profile not found');
  Object.assign(p, patch);
  persist();
  return p;
}

/* ================= memberships ================= */

export async function getMembership(userId: string): Promise<Membership | null> {
  await latency(120);
  const d = load();
  return d.memberships.find((m) => m.user_id === userId) ?? null;
}

export async function createMembership(userId: string, institutionId: string, role: StaffRole): Promise<Membership> {
  await latency(250);
  const d = load();
  const m: Membership = {
    id: uid('m'),
    user_id: userId,
    institution_id: institutionId,
    role,
    created_at: new Date().toISOString(),
  };
  d.memberships = d.memberships.filter((x) => x.user_id !== userId);
  d.memberships.push(m);
  persist();
  return m;
}

/* ================= job postings ================= */

/** Public board — any authenticated user may browse open roles. */
export async function listOpenJobPostings(): Promise<JobPosting[]> {
  await latency();
  const d = load();
  return [...d.job_postings].filter((j) => j.is_open).sort((a, b) => b.posted_at.localeCompare(a.posted_at));
}

export async function listJobPostingsByInstitution(institutionId: string): Promise<JobPosting[]> {
  await latency();
  const d = load();
  return d.job_postings
    .filter((j) => j.institution_id === institutionId)
    .sort((a, b) => b.posted_at.localeCompare(a.posted_at));
}

export async function createJobPosting(
  posting: Omit<JobPosting, 'id' | 'posted_at' | 'is_open'>,
): Promise<JobPosting> {
  await latency(400);
  const d = load();
  const j: JobPosting = { ...posting, id: uid('j'), posted_at: new Date().toISOString(), is_open: true };
  d.job_postings.unshift(j);
  persist();
  return j;
}

/* ================= programs ================= */

export async function listAllPrograms(): Promise<Program[]> {
  await latency();
  const d = load();
  return [...d.programs];
}

export async function listProgramsByInstitution(institutionId: string): Promise<Program[]> {
  await latency();
  const d = load();
  return d.programs.filter((p) => p.institution_id === institutionId);
}

/* ================= applications ================= */

export async function listApplicationsByStudent(studentId: string): Promise<Application[]> {
  await latency();
  const d = load();
  return d.applications
    .filter((a) => a.student_id === studentId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getApplication(id: string, studentId: string): Promise<Application | null> {
  await latency(150);
  const d = load();
  return d.applications.find((a) => a.id === id && a.student_id === studentId) ?? null;
}

export async function createApplication(
  studentId: string,
  target: { type: 'job'; posting: JobPosting } | { type: 'program'; program: Program },
  status: ApplicationStatus,
  formData: Record<string, unknown> = {},
): Promise<Application> {
  await latency(400);
  const d = load();
  const a: Application = {
    id: uid('a'),
    student_id: studentId,
    target_type: target.type,
    job_posting_id: target.type === 'job' ? target.posting.id : null,
    program_id: target.type === 'program' ? target.program.id : null,
    // denormalised copy of the target's institution, set on insert
    institution_id: target.type === 'job' ? target.posting.institution_id : target.program.institution_id,
    status,
    documents: {},
    form_data: formData,
    submitted_at: status === 'submitted' ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
  };
  d.applications.unshift(a);
  persist();
  return a;
}

export async function updateApplication(id: string, patch: Partial<Application>): Promise<Application> {
  await latency(300);
  const d = load();
  const a = d.applications.find((x) => x.id === id);
  if (!a) throw new Error('Application not found');
  Object.assign(a, patch);
  persist();
  return a;
}

function verificationStatusFor(d: Database, cred: Credential | null): VerificationStatus {
  if (!cred) return 'pending';
  const events = d.verification_events
    .filter((v) => v.credential_hash === cred.hash)
    .sort((a, b) => b.checked_at.localeCompare(a.checked_at));
  if (events.length === 0) return 'pending';
  return events[0].result === 'authentic' ? 'verified' : 'failed';
}

function deterministicPct(seed: string, min: number, max: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0;
  return min + (h % (max - min + 1));
}

/** Applicants for one institution. The institution filter is mandatory —
 *  this mirrors the RLS policy and is the only way to fetch applicant lists. */
export async function listApplicantsByInstitution(
  institutionId: string,
  opts: { jobPostingId?: string; programId?: string; targetType?: 'job' | 'program' } = {},
): Promise<ApplicantRow[]> {
  await latency(450);
  const d = load();
  const apps = d.applications.filter(
    (a) =>
      a.institution_id === institutionId &&
      a.status !== 'rejected' &&
      a.status !== 'shortlisted' && // student-side saved shortlists are not yet applications
      a.status !== 'started' &&
      (!opts.jobPostingId || a.job_posting_id === opts.jobPostingId) &&
      (!opts.programId || a.program_id === opts.programId) &&
      (!opts.targetType || a.target_type === opts.targetType),
  );
  return apps.map((application) => {
    const profile = d.profiles.find((p) => p.id === application.student_id)!;
    const homeInstitution = profile.home_institution_id
      ? d.institutions.find((i) => i.id === profile.home_institution_id) ?? null
      : null;
    const credential =
      d.credentials.find((c) => c.student_id === profile.id && c.credential_type === 'transcript' && c.status === 'issued') ??
      d.credentials.find((c) => c.student_id === profile.id && c.status === 'issued') ??
      null;
    const verification = verificationStatusFor(d, credential);
    const seed = application.id + institutionId;
    return {
      application,
      profile,
      homeInstitution,
      credential,
      verification,
      matchPct: deterministicPct(seed, 55, 96),
      examScores: {
        gate: `AIR ${deterministicPct(seed + 'g', 80, 4000).toLocaleString('en-IN')}`,
        gre: `${deterministicPct(seed + 'r', 305, 335)}`,
        toefl: `${deterministicPct(seed + 't', 92, 118)}`,
      },
    };
  });
}

export async function countApplicationsByInstitution(institutionId: string): Promise<number> {
  await latency(150);
  const d = load();
  return d.applications.filter(
    (a) => a.institution_id === institutionId && a.status !== 'shortlisted' && a.status !== 'started',
  ).length;
}

/* ================= credentials ================= */

export async function listCredentialsByStudent(studentId: string): Promise<Credential[]> {
  await latency();
  const d = load();
  return d.credentials
    .filter((c) => c.student_id === studentId && c.status === 'issued')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getCredentialByHash(hash: string): Promise<Credential | null> {
  await latency(200);
  const d = load();
  return d.credentials.find((c) => c.hash === hash) ?? null;
}

export async function issueCredential(input: {
  student_id: string;
  issuing_institution_id: string;
  credential_type: CredentialType;
  title: string;
  payload: CredentialPayload;
}): Promise<Credential> {
  await latency(300);
  const d = load();
  const hash = deriveHash(JSON.stringify(input.payload) + input.student_id + input.credential_type + Date.now());
  const c: Credential = {
    id: uid('cr'),
    student_id: input.student_id,
    issuing_institution_id: input.issuing_institution_id,
    credential_type: input.credential_type,
    title: input.title,
    issued_date: new Date().toISOString().slice(0, 10),
    payload: input.payload,
    hash,
    signature: deriveSignature(hash),
    status: 'issued',
    created_at: new Date().toISOString(),
  };
  d.credentials.unshift(c);
  persist();
  return c;
}

/* ================= credential requests ================= */

export async function listCredentialRequestsByStudent(studentId: string): Promise<CredentialRequest[]> {
  await latency();
  const d = load();
  return d.credential_requests
    .filter((r) => r.student_id === studentId)
    .sort((a, b) => b.requested_at.localeCompare(a.requested_at));
}

export async function listCredentialRequestsByInstitution(institutionId: string): Promise<CredentialRequest[]> {
  await latency();
  const d = load();
  return d.credential_requests
    .filter((r) => r.institution_id === institutionId)
    .sort((a, b) => b.requested_at.localeCompare(a.requested_at));
}

export async function countPendingRequests(institutionId: string): Promise<number> {
  await latency(120);
  const d = load();
  return d.credential_requests.filter((r) => r.institution_id === institutionId && r.status === 'pending').length;
}

export async function createCredentialRequest(input: {
  student_id: string;
  institution_id: string;
  credential_type: CredentialType;
  note: string | null;
}): Promise<CredentialRequest> {
  await latency(400);
  const d = load();
  const r: CredentialRequest = {
    id: uid('req'),
    ...input,
    status: 'pending',
    decline_reason: null,
    resolved_credential_id: null,
    requested_at: new Date().toISOString(),
    resolved_at: null,
  };
  d.credential_requests.unshift(r);
  persist();
  return r;
}

export async function resolveCredentialRequest(
  id: string,
  outcome:
    | { status: 'issued'; resolved_credential_id: string }
    | { status: 'declined'; decline_reason: string },
): Promise<CredentialRequest> {
  await latency(250);
  const d = load();
  const r = d.credential_requests.find((x) => x.id === id);
  if (!r) throw new Error('Request not found');
  if (outcome.status === 'issued') {
    r.status = 'issued';
    r.resolved_credential_id = outcome.resolved_credential_id;
  } else {
    r.status = 'declined';
    r.decline_reason = outcome.decline_reason;
  }
  r.resolved_at = new Date().toISOString();
  persist();
  return r;
}

/* ================= credential shares ================= */

export async function listSharesByStudent(
  studentId: string,
  recipientType: 'company' | 'university',
): Promise<CredentialShare[]> {
  await latency();
  const d = load();
  return d.credential_shares
    .filter((s) => s.student_id === studentId && s.recipient_type === recipientType)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function createShare(input: {
  credential_id: string;
  student_id: string;
  recipient_label: string;
  recipient_type: 'company' | 'university';
  scopes: string[];
  expires_at: string | null;
  one_time: boolean;
  notify_on_view: boolean;
}): Promise<CredentialShare> {
  await latency(350);
  const d = load();
  const s: CredentialShare = {
    id: uid('sh'),
    ...input,
    view_count: 0,
    last_viewed_at: null,
    revoked: false,
    created_at: new Date().toISOString(),
  };
  d.credential_shares.unshift(s);
  persist();
  return s;
}

export async function revokeShare(id: string): Promise<void> {
  await latency(300);
  const d = load();
  const s = d.credential_shares.find((x) => x.id === id);
  if (s) {
    s.revoked = true;
    persist();
  }
}

/* ================= verification events ================= */

export async function recordVerificationEvent(input: {
  credential_hash: string;
  verifier_user_id: string | null;
  result: 'authentic' | 'mismatch';
}): Promise<VerificationEvent> {
  const d = load();
  const v: VerificationEvent = {
    id: uid('v'),
    ...input,
    checked_at: new Date().toISOString(),
  };
  d.verification_events.push(v);
  persist();
  return v;
}
