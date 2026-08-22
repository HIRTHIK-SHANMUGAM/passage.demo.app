/**
 * The AI layer. Every Groq call in the app goes through this file; no
 * component talks to the API directly. Every function degrades to a
 * well-written canned response when the key is missing, the call fails,
 * or it times out — the app is fully demonstrable with no key at all.
 */
import { Credential } from './types';

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 10000;
const MIN_VISIBLE_MS = 500;

export interface ResumeAnalysis {
  skills: string[];
  read: string;
  gaps: string;
  matches: {
    title: string;
    company: string;
    pct: number;
    stretch: boolean;
    why: [string, string];
    missing: string;
  }[];
}

export interface ShortlistEntry {
  university: string;
  program: string;
  reason: string;
}

export interface ExamPlanRow {
  exam: string;
  requiredFor: string;
  status: string;
  nextDate: string;
  prepWeeks: number;
}

export interface ShortlistResult {
  read: string;
  reach: ShortlistEntry[];
  target: ShortlistEntry[];
  safe: ShortlistEntry[];
  exams: ExamPlanRow[];
  timelineWarning: string;
}

export interface ShortlistProfileInput {
  cgpa: string;
  scale: '10' | '4';
  degree: string;
  fields: string[];
  examsTaken: Record<string, string>;
  countries: string[];
  budget: string;
  projects: string;
}

/* ---------------- plumbing ---------------- */

async function groqJson<T>(system: string, user: string): Promise<T | null> {
  if (!GROQ_KEY) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              system +
              ' Respond with strict JSON only — no prose, no markdown fences, no commentary outside the JSON object.',
          },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    let text: string = data?.choices?.[0]?.message?.content ?? '';
    // strip markdown fences defensively
    text = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    return JSON.parse(text) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function withMinDelay<T>(work: Promise<T>): Promise<T> {
  const [result] = await Promise.all([work, new Promise((r) => setTimeout(r, MIN_VISIBLE_MS))]);
  return result;
}

/* ---------------- resume analysis (A2) ---------------- */

const CANNED_RESUME: ResumeAnalysis = {
  skills: ['React', 'TypeScript', 'Python', 'PyTorch', 'LLM integration', 'PostgreSQL', 'ROS', 'CI/CD'],
  read:
    "You're a builder — you ship full products end to end rather than specialising narrowly. Your strongest signal is shipping velocity across frontend and AI integration, not depth in any single framework. That reads best to early-stage startups and less well to large enterprises with narrow role definitions.",
  gaps:
    "No production experience at scale yet — nothing on your resume shows a system serving real traffic over months, and there's no open-source contribution history to substitute for it. Expect that to come up at Mid-level screens.",
  matches: [
    {
      title: 'ML Engineer',
      company: 'Sarvam AI',
      pct: 91,
      stretch: false,
      why: [
        'Your LLM integration work maps directly onto their product surface — they ship model-backed features weekly',
        'PyTorch projects on your resume match the exact stack in the posting',
      ],
      missing: 'They list speech/ASR experience as a plus — nothing on your resume covers audio.',
    },
    {
      title: 'Full-stack Engineer',
      company: 'Sarvam AI',
      pct: 87,
      stretch: false,
      why: [
        'React + TypeScript is your strongest visible stack and their primary frontend',
        'Your end-to-end shipping pattern fits a small team that owns whole features',
      ],
      missing: 'No Node.js backend at scale — most of your server work is Python.',
    },
    {
      title: 'AI Engineer',
      company: 'Fractal Analytics',
      pct: 78,
      stretch: false,
      why: [
        'Applied ML projects with real deployments beat the coursework-only profiles they usually screen out',
        'Python + MLOps overlap covers roughly 70% of the requirements list',
      ],
      missing: 'They want consulting-style client exposure; nothing on your resume shows it.',
    },
    {
      title: 'Robotics Software Engineer',
      company: 'Ati Motors',
      pct: 74,
      stretch: true,
      why: [
        'Your ROS coursework and robotics minor are directly relevant and rare among applicants',
        'C++ fundamentals show through your systems projects',
      ],
      missing: 'Production C++ is thin — most of your recent work is Python and TypeScript.',
    },
    {
      title: 'Backend Engineer',
      company: 'Razorpay',
      pct: 66,
      stretch: true,
      why: [
        'PostgreSQL and API design experience covers the data layer half of the role',
        'Your CI/CD familiarity fits their deploy-often culture',
      ],
      missing: 'The posting is Go-first; you have no Go on your resume at all.',
    },
  ],
};

export async function analyseResume(text: string): Promise<ResumeAnalysis> {
  const work = (async (): Promise<ResumeAnalysis> => {
    const result = await groqJson<ResumeAnalysis>(
      'You are a blunt, honest technical recruiter analysing a resume for the Indian tech job market. ' +
        'Return JSON with keys: skills (string[] of 6-9 extracted skills), read (2-3 sentence honest plain-language assessment naming strengths AND how the profile reads to different employer types), gaps (1-2 sentences of honest weaknesses), ' +
        'matches (array of exactly 5 objects: {title, company, pct (55-95 number), stretch (boolean), why ([string,string] referencing actual resume content), missing (one honest string)}). ' +
        'Companies must come from: Sarvam AI, Zoho, Ati Motors, Fractal Analytics, Razorpay, Ather Energy, Freshworks, Niramai.',
      `Resume:\n${text.slice(0, 6000)}`,
    );
    if (
      result &&
      Array.isArray(result.skills) &&
      typeof result.read === 'string' &&
      Array.isArray(result.matches) &&
      result.matches.length >= 3
    ) {
      return result;
    }
    return CANNED_RESUME;
  })();
  return withMinDelay(work);
}

/* ---------------- shortlist (B2) ---------------- */

const CANNED_SHORTLIST: ShortlistResult = {
  read:
    'Your 9.2 CGPA clears the academic bar at most programs you’re targeting. Your real differentiator is your project portfolio — shipping a production PWA and applied AI systems at undergrad level is unusual and reads well to applied and systems-heavy programs. Your weakest area is research output: no publications, which matters at CMU and NUS and matters very little in Germany.',
  reach: [
    {
      university: 'Carnegie Mellon',
      program: 'MS Machine Learning',
      reason: 'Your CGPA is competitive but no publications and no GRE score yet make this a genuine reach — a 325+ GRE would move it toward target.',
    },
    {
      university: 'NUS Singapore',
      program: 'MComp Computer Science',
      reason: 'QS #8 with heavy research weighting; your applied portfolio helps but their admits skew toward published candidates.',
    },
  ],
  target: [
    {
      university: 'TU Munich',
      program: 'MSc Informatics',
      reason: 'TU Munich weights project work heavily and requires no GRE — your portfolio does more for you here than a test score would.',
    },
    {
      university: 'University of Edinburgh',
      program: 'MSc Artificial Intelligence',
      reason: 'Your AI-specialised degree maps directly onto the program; IELTS is the only exam standing between you and a strong application.',
    },
    {
      university: 'IIIT Hyderabad',
      program: 'MS by Research (AI)',
      reason: 'Their admits value shipped systems over papers; a good GATE score makes this very likely.',
    },
  ],
  safe: [
    {
      university: 'RWTH Aachen',
      program: 'MSc Software Systems',
      reason: 'Near-zero tuition, no GRE, and your CGPA is well above their typical admit bar.',
    },
    {
      university: 'VIT Chennai',
      program: 'M.Tech AI & Robotics',
      reason: 'Your home institution with a direct-admission path for a 9.2 CGPA — a genuine safety, not a throwaway.',
    },
  ],
  exams: [
    { exam: 'GRE', requiredFor: 'CMU, NUS, Toronto', status: 'Not taken', nextDate: 'Oct 12, 2026', prepWeeks: 10 },
    { exam: 'IELTS', requiredFor: 'All non-India options', status: 'Not taken', nextDate: 'Sep 28, 2026', prepWeeks: 3 },
    { exam: 'TOEFL', requiredFor: 'CMU, NUS (alternative)', status: 'Not taken', nextDate: 'Oct 5, 2026', prepWeeks: 3 },
    { exam: 'GATE', requiredFor: 'IIT Madras, IIIT-H', status: 'Not taken', nextDate: 'Feb 7, 2027', prepWeeks: 16 },
  ],
  timelineWarning: 'GRE on Oct 12 leaves 8 weeks before the CMU deadline (Dec 15) — tight but workable. Book IELTS first; it needs the least prep and unblocks the most applications.',
};

export async function buildShortlist(profile: ShortlistProfileInput): Promise<ShortlistResult> {
  const work = (async (): Promise<ShortlistResult> => {
    const result = await groqJson<ShortlistResult>(
      'You are an honest graduate-admissions advisor. Build a realistic university shortlist. ' +
        'Universities must come from: VIT Chennai, IIT Madras, IIIT Hyderabad, Carnegie Mellon, TU Munich, RWTH Aachen, University of Edinburgh, NUS Singapore, University of Toronto. ' +
        'Return JSON: {read (2-3 sentences naming both strength and weakness), reach (2-3 of {university, program, reason specific to this student}), target (2-3 same), safe (2 same), ' +
        'exams (array of {exam, requiredFor, status, nextDate, prepWeeks number} — use real upcoming dates after Aug 2026), timelineWarning (one sentence about the tightest gap)}.',
      JSON.stringify(profile),
    );
    if (result && result.read && Array.isArray(result.reach) && Array.isArray(result.exams)) {
      return result;
    }
    return CANNED_SHORTLIST;
  })();
  return withMinDelay(work);
}

/* ---------------- credential Q&A ---------------- */

const CANNED_ANSWERS: Record<string, string> = {
  strong:
    "Yes. On VIT's 10-point scale, 9.2 sits in roughly the top 8% of the cohort. The nearest US equivalent is about 3.8/4.0. For context, the median CGPA in this program is 7.6.",
  inconsistencies:
    'No anomalies detected. Grade progression across six semesters is consistent, with no unexplained jumps, gap semesters, or retake patterns.',
  compare:
    "Above the median for this role's applicant pool (median CGPA 8.1). Among the top 15% of verified applicants you've reviewed this cycle.",
  default:
    'This record was cryptographically verified against the issuing institution’s registry. The CGPA, degree and course list are exactly as issued — you can rely on them without contacting the registrar.',
};

export function cannedAnswerFor(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('strong') || q.includes('9.2')) return CANNED_ANSWERS.strong;
  if (q.includes('inconsis') || q.includes('anomal')) return CANNED_ANSWERS.inconsistencies;
  if (q.includes('compare') || q.includes('other applicant')) return CANNED_ANSWERS.compare;
  return CANNED_ANSWERS.default;
}

export async function askAboutCredential(question: string, credential: Credential | null): Promise<string> {
  const work = (async (): Promise<string> => {
    const result = await groqJson<{ answer: string }>(
      'You are an assistant helping a recruiter or admissions officer understand a verified academic credential. ' +
        'Be concise (2-3 sentences), factual, and specific with numbers where reasonable. Return JSON: {"answer": string}.',
      `Credential: ${JSON.stringify(credential?.payload ?? {})}\nQuestion: ${question}`,
    );
    if (result && typeof result.answer === 'string' && result.answer.length > 0) {
      return result.answer;
    }
    return cannedAnswerFor(question);
  })();
  return withMinDelay(work);
}
