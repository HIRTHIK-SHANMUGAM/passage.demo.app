export type InstitutionType = 'university' | 'company';

export interface Institution {
  id: string;
  name: string;
  type: InstitutionType;
  domain: string;
  initials: string;
  country: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  student_id: string | null;
  degree: string | null;
  cgpa: number | null;
  home_institution_id: string | null;
  created_at: string;
}

export type StaffRole = 'admissions' | 'recruiter';

export interface Membership {
  id: string;
  user_id: string;
  institution_id: string;
  role: StaffRole;
  created_at: string;
}

export type AcceptanceTier = 'reach' | 'target' | 'safe';

export interface Program {
  id: string;
  institution_id: string;
  name: string;
  degree_level: 'Masters' | 'PhD';
  field: string;
  tuition_lakhs: number;
  deadline: string;
  duration_years: number;
  required_exams: string[];
  intake: string;
  description: string;
  curriculum: string[];
  acceptance_tier: AcceptanceTier;
  qs_rank: number;
  created_at: string;
}

export interface JobPosting {
  id: string;
  institution_id: string;
  title: string;
  location: string;
  work_mode: 'Remote' | 'Hybrid' | 'Onsite';
  employment_type: 'Full-time' | 'Internship' | 'Contract';
  experience_level: 'Entry level' | 'Mid' | 'Senior';
  salary_min: number;
  salary_max: number;
  salary_unit: 'LPA' | 'per_month';
  description: string;
  responsibilities: string[];
  requirements: string[];
  skills: string[];
  posted_at: string;
  is_open: boolean;
}

export type CredentialType = 'transcript' | 'marksheet' | 'bonafide' | 'migration';

export interface CredentialCourse {
  name: string;
  credits: number;
  grade: string;
}

export interface CredentialPayload {
  student_name: string;
  student_id: string;
  degree: string;
  cgpa: string;
  courses?: CredentialCourse[];
}

export interface Credential {
  id: string;
  student_id: string;
  issuing_institution_id: string;
  credential_type: CredentialType;
  title: string;
  issued_date: string;
  payload: CredentialPayload;
  hash: string;
  signature: string;
  status: 'issued' | 'revoked';
  created_at: string;
}

export type RequestStatus = 'pending' | 'issued' | 'declined';

export interface CredentialRequest {
  id: string;
  student_id: string;
  institution_id: string;
  credential_type: CredentialType;
  note: string | null;
  status: RequestStatus;
  decline_reason: string | null;
  resolved_credential_id: string | null;
  requested_at: string;
  resolved_at: string | null;
}

export type ApplicationStatus =
  | 'shortlisted'
  | 'started'
  | 'submitted'
  | 'in_review'
  | 'interview'
  | 'rejected'
  | 'offer';

export interface Application {
  id: string;
  student_id: string;
  target_type: 'job' | 'program';
  job_posting_id: string | null;
  program_id: string | null;
  institution_id: string;
  status: ApplicationStatus;
  documents: Record<string, unknown>;
  form_data: Record<string, unknown>;
  submitted_at: string | null;
  created_at: string;
}

export interface CredentialShare {
  id: string;
  credential_id: string;
  student_id: string;
  recipient_label: string;
  recipient_type: 'company' | 'university';
  scopes: string[];
  expires_at: string | null;
  one_time: boolean;
  notify_on_view: boolean;
  view_count: number;
  last_viewed_at: string | null;
  revoked: boolean;
  created_at: string;
}

export interface VerificationEvent {
  id: string;
  credential_hash: string;
  verifier_user_id: string | null;
  result: 'authentic' | 'mismatch';
  checked_at: string;
}

export type VerificationStatus = 'verified' | 'pending' | 'failed';

/** Applicant row as the institution tracks see it: application + student. */
export interface ApplicantRow {
  application: Application;
  profile: Profile;
  homeInstitution: Institution | null;
  credential: Credential | null;
  verification: VerificationStatus;
  matchPct: number;
  examScores: { gate?: string; gre?: string; toefl?: string };
}

export type Track = 'jobs' | 'studies' | 'hiring' | 'admissions';
