import {
  Application,
  Credential,
  CredentialRequest,
  CredentialShare,
  Institution,
  JobPosting,
  Membership,
  Profile,
  Program,
  VerificationEvent,
} from './types';
import { deriveHash, deriveSignature } from './hash';

export interface Database {
  institutions: Institution[];
  profiles: Profile[];
  memberships: Membership[];
  programs: Program[];
  job_postings: JobPosting[];
  credentials: Credential[];
  credential_requests: CredentialRequest[];
  applications: Application[];
  credential_shares: CredentialShare[];
  verification_events: VerificationEvent[];
}

/* Deterministic PRNG so the seed is stable across loads. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOW = new Date('2026-08-22T10:00:00+05:30').getTime();
const DAY = 86400000;
const iso = (t: number) => new Date(t).toISOString();

export const DEMO_STUDENT_ID = 'u-hirthik';
export const DEMO_STUDENT_EMAIL = 'hirthikshanmugam7@gmail.com';

export function buildSeed(): Database {
  const rand = mulberry32(20260822);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  /* ---------- institutions ---------- */
  const uni = (id: string, name: string, domain: string, initials: string, country: string): Institution => ({
    id, name, type: 'university', domain, initials, country, created_at: iso(NOW - 400 * DAY),
  });
  const co = (id: string, name: string, domain: string, initials: string): Institution => ({
    id, name, type: 'company', domain, initials, country: 'India', created_at: iso(NOW - 400 * DAY),
  });

  const institutions: Institution[] = [
    uni('i-vit', 'VIT Chennai', 'vitstudent.ac.in', 'VC', 'India'),
    uni('i-iitm', 'IIT Madras', 'iitm.ac.in', 'IM', 'India'),
    uni('i-iiith', 'IIIT Hyderabad', 'iiit.ac.in', 'IH', 'India'),
    uni('i-cmu', 'Carnegie Mellon', 'cmu.edu', 'CM', 'USA'),
    uni('i-tum', 'TU Munich', 'tum.de', 'TM', 'Germany'),
    uni('i-rwth', 'RWTH Aachen', 'rwth-aachen.de', 'RA', 'Germany'),
    uni('i-edin', 'University of Edinburgh', 'ed.ac.uk', 'UE', 'UK'),
    uni('i-nus', 'NUS Singapore', 'nus.edu.sg', 'NS', 'Singapore'),
    uni('i-toronto', 'University of Toronto', 'utoronto.ca', 'UT', 'Canada'),
    // Additional undergrad-only institutions so applicant profiles look real
    uni('i-anna', 'Anna University', 'annauniv.edu', 'AU', 'India'),
    uni('i-bits', 'BITS Pilani', 'bits-pilani.ac.in', 'BP', 'India'),
    uni('i-manipal', 'Manipal University', 'manipal.edu', 'MU', 'India'),
    uni('i-nitt', 'NIT Trichy', 'nitt.edu', 'NT', 'India'),
    co('c-sarvam', 'Sarvam AI', 'sarvam.ai', 'SA'),
    co('c-zoho', 'Zoho', 'zoho.com', 'ZO'),
    co('c-ati', 'Ati Motors', 'atimotors.com', 'AM'),
    co('c-fractal', 'Fractal Analytics', 'fractal.ai', 'FA'),
    co('c-razorpay', 'Razorpay', 'razorpay.com', 'RP'),
    co('c-ather', 'Ather Energy', 'atherenergy.com', 'AE'),
    co('c-freshworks', 'Freshworks', 'freshworks.com', 'FW'),
    co('c-niramai', 'Niramai', 'niramai.com', 'NI'),
  ];

  /* ---------- programs ---------- */
  let pn = 0;
  const prog = (
    instId: string, name: string, level: 'Masters' | 'PhD', field: string,
    tuition: number, deadline: string, exams: string[], tier: Program['acceptance_tier'], qs: number,
  ): Program => ({
    id: `p-${++pn}`,
    institution_id: instId,
    name,
    degree_level: level,
    field,
    tuition_lakhs: tuition,
    deadline,
    duration_years: level === 'PhD' ? 4 : 2,
    required_exams: exams,
    intake: 'Fall 2027',
    description:
      `${name} focuses on ${field.toLowerCase()} with a strong applied component: coursework in the first year, ` +
      `a supervised project or thesis in the second, and close ties to industry and research labs.`,
    curriculum: [
      'Advanced Algorithms & Systems',
      `Core ${field}`,
      'Research Methods & Seminar',
      'Industry / Lab Project',
      'Thesis or Capstone',
    ],
    acceptance_tier: tier,
    qs_rank: qs,
    created_at: iso(NOW - 200 * DAY),
  });

  const programs: Program[] = [
    prog('i-vit', 'M.Tech CSE', 'Masters', 'Computer Science', 8, '2026-12-20', ['GATE'], 'safe', 601),
    prog('i-vit', 'M.Tech AI & Robotics', 'Masters', 'Artificial Intelligence', 9, '2027-01-10', ['GATE'], 'safe', 601),
    prog('i-iitm', 'M.Tech CSE', 'Masters', 'Computer Science', 4, '2027-02-28', ['GATE'], 'reach', 227),
    prog('i-iitm', 'MS Data Science', 'Masters', 'Data Science', 5, '2027-02-15', ['GATE'], 'reach', 227),
    prog('i-iiith', 'M.Tech CSE', 'Masters', 'Computer Science', 6, '2027-01-31', ['GATE'], 'target', 580),
    prog('i-iiith', 'MS by Research (AI)', 'Masters', 'Artificial Intelligence', 6, '2027-02-10', ['GATE'], 'target', 580),
    prog('i-cmu', 'MS Computer Science', 'Masters', 'Computer Science', 62, '2026-12-15', ['GRE', 'TOEFL'], 'reach', 52),
    prog('i-cmu', 'MS Machine Learning', 'Masters', 'Machine Learning', 64, '2026-12-10', ['GRE', 'TOEFL'], 'reach', 52),
    prog('i-tum', 'MSc Informatics', 'Masters', 'Computer Science', 3, '2027-01-15', ['IELTS'], 'target', 28),
    prog('i-tum', 'MSc Robotics & AI', 'Masters', 'Robotics', 3, '2027-01-15', ['IELTS'], 'target', 28),
    prog('i-rwth', 'MSc Software Systems', 'Masters', 'Software Engineering', 2, '2027-03-01', ['IELTS'], 'safe', 99),
    prog('i-rwth', 'MSc Data Science', 'Masters', 'Data Science', 2, '2027-03-01', ['IELTS'], 'target', 99),
    prog('i-edin', 'MSc Artificial Intelligence', 'Masters', 'Artificial Intelligence', 38, '2026-12-31', ['IELTS'], 'target', 27),
    prog('i-edin', 'MSc Cognitive Science', 'Masters', 'Cognitive Science', 34, '2027-01-20', ['IELTS'], 'safe', 27),
    prog('i-nus', 'MComp Computer Science', 'Masters', 'Computer Science', 30, '2026-11-30', ['GRE', 'TOEFL'], 'reach', 8),
    prog('i-nus', 'MSc Data Science & ML', 'Masters', 'Data Science', 32, '2026-12-05', ['GRE', 'IELTS'], 'reach', 8),
    prog('i-toronto', 'MScAC Applied Computing', 'Masters', 'Computer Science', 40, '2026-12-01', ['GRE', 'IELTS'], 'reach', 21),
    prog('i-toronto', 'MEng ECE', 'Masters', 'Electrical & Computer Eng', 36, '2027-01-05', ['IELTS'], 'target', 21),
  ];

  /* ---------- job postings ---------- */
  let jn = 0;
  const job = (
    instId: string, title: string, location: string, mode: JobPosting['work_mode'],
    type: JobPosting['employment_type'], exp: JobPosting['experience_level'],
    sMin: number, sMax: number, skills: string[], daysAgo: number,
  ): JobPosting => ({
    id: `j-${++jn}`,
    institution_id: instId,
    title,
    location,
    work_mode: mode,
    employment_type: type,
    experience_level: exp,
    salary_min: sMin,
    salary_max: sMax,
    salary_unit: 'LPA',
    description:
      `We're looking for a ${title} to join a small, fast team. You'll own features end to end — ` +
      `from design conversations to shipping and measuring — with real users from week one.`,
    responsibilities: [
      'Own features from spec to production',
      'Collaborate with design and product in short cycles',
      'Write clean, tested, reviewable code',
      'Debug and improve live systems',
    ],
    requirements: skills.map((s) => `Working proficiency with ${s}`),
    skills,
    posted_at: iso(NOW - daysAgo * DAY),
    is_open: true,
  });

  const job_postings: JobPosting[] = [
    job('c-sarvam', 'ML Engineer', 'Bengaluru', 'Hybrid', 'Full-time', 'Entry level', 18, 28, ['Python', 'PyTorch', 'LLMs'], 3),
    job('c-sarvam', 'Full-stack Engineer', 'Bengaluru', 'Hybrid', 'Full-time', 'Mid', 22, 34, ['React', 'TypeScript', 'Node.js'], 8),
    job('c-sarvam', 'Research Intern — Speech', 'Bengaluru', 'Onsite', 'Internship', 'Entry level', 6, 10, ['Python', 'ASR', 'PyTorch'], 15),
    job('c-zoho', 'Software Developer', 'Chennai', 'Onsite', 'Full-time', 'Entry level', 8, 12, ['Java', 'SQL', 'REST APIs'], 5),
    job('c-zoho', 'Frontend Engineer', 'Chennai', 'Onsite', 'Full-time', 'Mid', 12, 18, ['JavaScript', 'React', 'CSS'], 12),
    job('c-ati', 'Robotics Software Engineer', 'Bengaluru', 'Onsite', 'Full-time', 'Entry level', 14, 22, ['C++', 'ROS', 'Python'], 6),
    job('c-ati', 'Perception Engineer', 'Bengaluru', 'Onsite', 'Full-time', 'Mid', 20, 30, ['C++', 'Computer Vision', 'SLAM'], 20),
    job('c-fractal', 'Data Scientist', 'Mumbai', 'Hybrid', 'Full-time', 'Entry level', 12, 18, ['Python', 'SQL', 'ML'], 4),
    job('c-fractal', 'AI Engineer', 'Mumbai', 'Remote', 'Full-time', 'Mid', 20, 32, ['Python', 'LLMs', 'MLOps'], 10),
    job('c-razorpay', 'Backend Engineer', 'Bengaluru', 'Hybrid', 'Full-time', 'Entry level', 16, 24, ['Go', 'PostgreSQL', 'Kubernetes'], 2),
    job('c-razorpay', 'SDE Intern', 'Bengaluru', 'Hybrid', 'Internship', 'Entry level', 8, 12, ['Python', 'APIs', 'Git'], 9),
    job('c-ather', 'Embedded Software Engineer', 'Bengaluru', 'Onsite', 'Full-time', 'Entry level', 12, 18, ['C', 'RTOS', 'CAN'], 7),
    job('c-ather', 'Cloud Platform Engineer', 'Bengaluru', 'Hybrid', 'Full-time', 'Senior', 30, 45, ['AWS', 'Terraform', 'Go'], 18),
    job('c-freshworks', 'Product Engineer', 'Chennai', 'Hybrid', 'Full-time', 'Entry level', 10, 16, ['Ruby', 'React', 'MySQL'], 6),
    job('c-freshworks', 'QA Automation Engineer', 'Chennai', 'Onsite', 'Full-time', 'Mid', 12, 18, ['Selenium', 'Java', 'CI/CD'], 14),
    job('c-niramai', 'ML Engineer — Imaging', 'Bengaluru', 'Onsite', 'Full-time', 'Mid', 18, 26, ['Python', 'Computer Vision', 'TensorFlow'], 11),
    job('c-niramai', 'Software Engineer', 'Bengaluru', 'Hybrid', 'Full-time', 'Entry level', 10, 15, ['Python', 'Django', 'PostgreSQL'], 21),
  ];

  /* ---------- students ---------- */
  const firstNames = ['Ananya', 'Arjun', 'Devika', 'Karthik', 'Meera', 'Priya', 'Rahul', 'Vikram', 'Sneha', 'Aditya', 'Ishita', 'Rohan', 'Kavya', 'Nikhil', 'Divya', 'Siddharth', 'Pooja', 'Varun', 'Shruti', 'Aakash'];
  const lastNames = ['Rao', 'Pillai', 'Krishnan', 'Nair', 'Joshi', 'Menon', 'Verma', 'Reddy', 'Iyer', 'Sharma', 'Gupta', 'Das', 'Patel', 'Singh', 'Bose', 'Kulkarni'];
  const homeUnis = ['i-vit', 'i-anna', 'i-bits', 'i-manipal', 'i-nitt', 'i-iiith'];
  const degrees = ['B.Tech CSE', 'B.E. CSE', 'B.Tech IT', 'B.Tech ECE', 'B.Tech EEE', 'B.Tech Mech'];

  const profiles: Profile[] = [];
  const credentials: Credential[] = [];
  const applications: Application[] = [];
  const verification_events: VerificationEvent[] = [];

  const instName = (id: string) => institutions.find((i) => i.id === id)!.name;

  // Demo student
  const hirthik: Profile = {
    id: DEMO_STUDENT_ID,
    full_name: 'Hirthik S',
    email: DEMO_STUDENT_EMAIL,
    student_id: 'VIT2026CS001',
    degree: 'B.Tech CSE AI & Robotics',
    cgpa: 9.2,
    home_institution_id: 'i-vit',
    created_at: iso(NOW - 90 * DAY),
  };
  profiles.push(hirthik);

  const usedNames = new Set<string>(['Hirthik S']);
  for (let s = 1; s <= 40; s++) {
    let name = '';
    do {
      name = `${pick(firstNames)} ${pick(lastNames)}`;
    } while (usedNames.has(name));
    usedNames.add(name);
    const home = pick(homeUnis);
    const cgpa = Math.round((6.8 + rand() * 3.0) * 10) / 10;
    profiles.push({
      id: `u-s${s}`,
      full_name: name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      student_id: `${institutions.find((i) => i.id === home)!.initials}2026${String(s).padStart(3, '0')}`,
      degree: pick(degrees),
      cgpa: Math.min(cgpa, 9.9),
      home_institution_id: home,
      created_at: iso(NOW - Math.floor(rand() * 120) * DAY),
    });
  }

  /* ---------- credentials for every student ---------- */
  let cn = 0;
  const makeCredential = (p: Profile, type: Credential['credential_type'], title: string, cgpaOverride?: string, issuedDaysAgo = 30): Credential => {
    const payload = {
      student_name: p.full_name!,
      student_id: p.student_id!,
      degree: p.degree!,
      cgpa: cgpaOverride ?? String(p.cgpa),
      courses: type === 'transcript' ? [
        { name: 'Data Structures & Algorithms', credits: 4, grade: 'A' },
        { name: 'Operating Systems', credits: 4, grade: 'A' },
        { name: 'Machine Learning', credits: 3, grade: 'S' },
        { name: 'Computer Networks', credits: 3, grade: 'A' },
        { name: 'Database Systems', credits: 4, grade: 'A' },
      ] : undefined,
    };
    const hash = deriveHash(JSON.stringify(payload) + p.id + type);
    return {
      id: `cr-${++cn}`,
      student_id: p.id,
      issuing_institution_id: p.home_institution_id!,
      credential_type: type,
      title,
      issued_date: iso(NOW - issuedDaysAgo * DAY).slice(0, 10),
      payload,
      hash,
      signature: deriveSignature(hash),
      status: 'issued',
      created_at: iso(NOW - issuedDaysAgo * DAY),
    };
  };

  // Hirthik's vault: three credentials
  const hTranscript = makeCredential(hirthik, 'transcript', 'B.Tech Transcript', undefined, 1);
  const hMarks = makeCredential(hirthik, 'marksheet', 'Semester Marksheets', undefined, 1);
  const hBonafide = makeCredential(hirthik, 'bonafide', 'Bonafide Certificate', undefined, 51);
  credentials.push(hTranscript, hMarks, hBonafide);

  const studentPool = profiles.filter((p) => p.id !== DEMO_STUDENT_ID);
  for (const p of studentPool) {
    credentials.push(makeCredential(p, 'transcript', `${p.degree} Transcript`, undefined, 20 + Math.floor(rand() * 60)));
  }

  /* ---------- applications, distributed unevenly ---------- */
  let an = 0;
  const statuses: Application['status'][] = ['submitted', 'submitted', 'in_review', 'in_review', 'interview', 'submitted', 'offer'];
  const addApp = (p: Profile, target: Program | JobPosting, type: 'program' | 'job', status?: Application['status']) => {
    applications.push({
      id: `a-${++an}`,
      student_id: p.id,
      target_type: type,
      job_posting_id: type === 'job' ? target.id : null,
      program_id: type === 'program' ? target.id : null,
      institution_id: target.institution_id,
      status: status ?? pick(statuses),
      documents: {},
      form_data: {},
      submitted_at: iso(NOW - Math.floor(rand() * 20) * DAY),
      created_at: iso(NOW - (5 + Math.floor(rand() * 30)) * DAY),
    });
  };

  // Weight institutions unevenly: VIT and Sarvam heavy, others lighter.
  const programWeights: Record<string, number> = {
    'i-vit': 5, 'i-iitm': 3, 'i-iiith': 3, 'i-cmu': 2, 'i-tum': 2,
    'i-rwth': 1, 'i-edin': 1, 'i-nus': 2, 'i-toronto': 1,
  };
  const companyWeights: Record<string, number> = {
    'c-sarvam': 5, 'c-zoho': 3, 'c-fractal': 3, 'c-razorpay': 3,
    'c-ati': 2, 'c-ather': 2, 'c-freshworks': 2, 'c-niramai': 1,
  };
  const weightedPrograms = programs.flatMap((p) => Array(programWeights[p.institution_id] ?? 1).fill(p) as Program[]);
  const weightedJobs = job_postings.flatMap((j) => Array(companyWeights[j.institution_id] ?? 1).fill(j) as JobPosting[]);

  for (const p of studentPool) {
    const nProg = Math.floor(rand() * 3); // 0–2 program applications
    const nJob = 1 + Math.floor(rand() * 3); // 1–3 job applications
    const chosenProg = new Set<string>();
    for (let k = 0; k < nProg; k++) {
      const t = pick(weightedPrograms);
      if (!chosenProg.has(t.id)) {
        chosenProg.add(t.id);
        addApp(p, t, 'program');
      }
    }
    const chosenJob = new Set<string>();
    for (let k = 0; k < nJob; k++) {
      const t = pick(weightedJobs);
      if (!chosenJob.has(t.id)) {
        chosenJob.add(t.id);
        addApp(p, t, 'job');
      }
    }
  }

  // Demo student's own applications
  addApp(hirthik, job_postings[0], 'job', 'in_review'); // Sarvam ML Engineer
  addApp(hirthik, job_postings[8], 'job', 'submitted'); // Fractal AI Engineer
  addApp(hirthik, job_postings[9], 'job', 'interview'); // Razorpay Backend
  addApp(hirthik, programs.find((p) => p.institution_id === 'i-tum')!, 'program', 'started');
  addApp(hirthik, programs.find((p) => p.institution_id === 'i-cmu')!, 'program', 'shortlisted');
  addApp(hirthik, programs.find((p) => p.institution_id === 'i-nus')!, 'program', 'shortlisted');

  /* ---------- verification events ---------- */
  // ~65% of applicant credentials verified, ~10% failed, rest pending.
  let vn = 0;
  const failedStudents: string[] = [];
  for (const p of studentPool) {
    const cred = credentials.find((c) => c.student_id === p.id)!;
    const roll = rand();
    if (roll < 0.62) {
      verification_events.push({
        id: `v-${++vn}`,
        credential_hash: cred.hash,
        verifier_user_id: null,
        result: 'authentic',
        checked_at: iso(NOW - Math.floor(rand() * 10) * DAY),
      });
    } else if (roll < 0.74) {
      failedStudents.push(p.id);
      verification_events.push({
        id: `v-${++vn}`,
        credential_hash: cred.hash,
        verifier_user_id: null,
        result: 'mismatch',
        checked_at: iso(NOW - Math.floor(rand() * 10) * DAY),
      });
    }
    // else: pending — no event
  }
  // Hirthik's transcript has been verified before
  verification_events.push({
    id: `v-${++vn}`,
    credential_hash: hTranscript.hash,
    verifier_user_id: null,
    result: 'authentic',
    checked_at: iso(NOW - 2 * DAY),
  });

  /* ---------- credential shares (demo student, both track types) ---------- */
  const share = (
    id: string, credId: string, label: string, rType: 'company' | 'university',
    scopes: string[], expiresH: number | null, views: number, lastViewedDaysAgo: number | null, sharedDaysAgo: number,
  ): CredentialShare => ({
    id,
    credential_id: credId,
    student_id: DEMO_STUDENT_ID,
    recipient_label: label,
    recipient_type: rType,
    scopes,
    expires_at: expiresH === null ? null : iso(NOW + expiresH * 3600000),
    one_time: false,
    notify_on_view: true,
    view_count: views,
    last_viewed_at: lastViewedDaysAgo === null ? null : iso(NOW - lastViewedDaysAgo * DAY),
    revoked: false,
    created_at: iso(NOW - sharedDaysAgo * DAY),
  });

  const credential_shares: CredentialShare[] = [
    share('sh-1', hTranscript.id, 'Sarvam AI — Recruiting', 'company', ['CGPA', 'Degree and institution'], 41, 3, 2, 2),
    share('sh-2', hTranscript.id, 'Fractal Analytics — HR', 'company', ['Full transcript'], null, 1, 5, 5),
    share('sh-3', hTranscript.id, 'Carnegie Mellon — Graduate Admissions', 'university', ['Full transcript', 'Semester breakdown'], 72, 2, 1, 3),
    share('sh-4', hMarks.id, 'TU Munich — Admissions Office', 'university', ['Degree and institution', 'CGPA'], null, 4, 1, 6),
    share('sh-5', hTranscript.id, 'NUS — Postgraduate Admissions', 'university', ['CGPA', 'Individual course grades'], 120, 0, null, 1),
  ];

  /* ---------- credential requests ---------- */
  const credential_requests: CredentialRequest[] = [
    {
      id: 'req-1',
      student_id: DEMO_STUDENT_ID,
      institution_id: 'i-vit',
      credential_type: 'migration',
      note: 'Needed for my TU Munich application, deadline Jan 15.',
      status: 'pending',
      decline_reason: null,
      resolved_credential_id: null,
      requested_at: iso(NOW - 4 * DAY),
      resolved_at: null,
    },
    {
      id: 'req-2',
      student_id: DEMO_STUDENT_ID,
      institution_id: 'i-vit',
      credential_type: 'bonafide',
      note: null,
      status: 'issued',
      decline_reason: null,
      resolved_credential_id: hBonafide.id,
      requested_at: iso(NOW - 52 * DAY),
      resolved_at: iso(NOW - 51 * DAY),
    },
    // Requests from other VIT students, so the admissions inbox has content
    ...studentPool
      .filter((p) => p.home_institution_id === 'i-vit')
      .slice(0, 3)
      .map((p, k) => ({
        id: `req-${3 + k}`,
        student_id: p.id,
        institution_id: 'i-vit',
        credential_type: (['transcript', 'bonafide', 'marksheet'] as const)[k],
        note: k === 0 ? 'Required for my NUS application, deadline Nov 30.' : null,
        status: 'pending' as const,
        decline_reason: null,
        resolved_credential_id: null,
        requested_at: iso(NOW - (1 + k) * DAY),
        resolved_at: null,
      })),
  ];

  /* ---------- memberships (none for students; staff created via onboarding) ---------- */
  const memberships: Membership[] = [];

  // silence unused helper warning
  void instName;

  return {
    institutions,
    profiles,
    memberships,
    programs,
    job_postings,
    credentials,
    credential_requests,
    applications,
    credential_shares,
    verification_events,
  };
}
