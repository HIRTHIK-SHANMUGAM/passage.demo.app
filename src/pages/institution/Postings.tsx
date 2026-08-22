import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import * as db from '@/lib/db';
import { JobPosting } from '@/lib/types';
import {
  Button,
  EmptyState,
  ErrorState,
  Eyebrow,
  Input,
  Modal,
  PageTitle,
  Select,
  SkeletonRows,
  Textarea,
  useToast,
} from '@/components/ui';

interface PostingStats {
  applicants: number;
  verified: number;
  shortlisted: number;
}

function ListInput({
  label,
  items,
  setItems,
  placeholder,
}: {
  label: string;
  items: string[];
  setItems: (v: string[]) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-slate">{label}</div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              placeholder={placeholder}
              onChange={(e) => setItems(items.map((x, k) => (k === i ? e.target.value : x)))}
              className="flex-1 rounded-btn border border-hairline bg-ink-3 px-3 py-2 text-sm text-parchment placeholder:text-slate-2"
            />
            {items.length > 1 && (
              <Button variant="ghost" size="sm" aria-label="Remove line" onClick={() => setItems(items.filter((_, k) => k !== i))}>
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setItems([...items, ''])}>
          <Plus size={13} /> Add line
        </Button>
      </div>
    </div>
  );
}

function PostRoleModal({ onClose, onPosted }: { onClose: () => void; onPosted: (j: JobPosting) => void }) {
  const { activeInstitution } = useApp();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [locationField, setLocationField] = useState('');
  const [workMode, setWorkMode] = useState<JobPosting['work_mode']>('Hybrid');
  const [empType, setEmpType] = useState<JobPosting['employment_type']>('Full-time');
  const [expLevel, setExpLevel] = useState<JobPosting['experience_level']>('Entry level');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [salaryUnit, setSalaryUnit] = useState<JobPosting['salary_unit']>('LPA');
  const [description, setDescription] = useState('');
  const [responsibilities, setResponsibilities] = useState<string[]>(['']);
  const [requirements, setRequirements] = useState<string[]>(['']);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy || !activeInstitution) return;
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'A role needs a title.';
    if (!locationField.trim()) errs.location = 'Where is this role based?';
    if (!description.trim()) errs.description = 'Describe the role.';
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      const posted = await db.createJobPosting({
        institution_id: activeInstitution.id,
        title: title.trim(),
        location: locationField.trim(),
        work_mode: workMode,
        employment_type: empType,
        experience_level: expLevel,
        salary_min: parseFloat(salaryMin) || 0,
        salary_max: parseFloat(salaryMax) || 0,
        salary_unit: salaryUnit,
        description: description.trim(),
        responsibilities: responsibilities.map((r) => r.trim()).filter(Boolean),
        requirements: requirements.map((r) => r.trim()).filter(Boolean),
        skills: requirements.map((r) => r.trim()).filter(Boolean).slice(0, 3),
      });
      toast('Role posted — now visible to candidates');
      onPosted(posted);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} wide labelledBy="post-role-title">
      <h2 id="post-role-title" className="mb-4 font-display text-xl text-parchment">Post a new role</h2>
      <div className="space-y-4">
        <Input
          label="Title"
          placeholder="e.g. ML Engineer"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setErrors((x) => ({ ...x, title: '' })); }}
          error={errors.title}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Location"
            placeholder="e.g. Bengaluru"
            value={locationField}
            onChange={(e) => { setLocationField(e.target.value); setErrors((x) => ({ ...x, location: '' })); }}
            error={errors.location}
          />
          <Select label="Work mode" value={workMode} onChange={(e) => setWorkMode(e.target.value as JobPosting['work_mode'])}>
            <option>Remote</option><option>Hybrid</option><option>Onsite</option>
          </Select>
          <Select label="Employment type" value={empType} onChange={(e) => setEmpType(e.target.value as JobPosting['employment_type'])}>
            <option>Full-time</option><option>Internship</option><option>Contract</option>
          </Select>
          <Select label="Experience level" value={expLevel} onChange={(e) => setExpLevel(e.target.value as JobPosting['experience_level'])}>
            <option>Entry level</option><option>Mid</option><option>Senior</option>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Salary min" placeholder="12" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} inputMode="numeric" />
          <Input label="Salary max" placeholder="18" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} inputMode="numeric" />
          <Select label="Unit" value={salaryUnit} onChange={(e) => setSalaryUnit(e.target.value as JobPosting['salary_unit'])}>
            <option value="LPA">LPA</option><option value="per_month">per month</option>
          </Select>
        </div>
        <Textarea
          label="Description"
          rows={3}
          placeholder="What does this person do all day?"
          value={description}
          onChange={(e) => { setDescription(e.target.value); setErrors((x) => ({ ...x, description: '' })); }}
          error={errors.description}
        />
        <ListInput label="Responsibilities" items={responsibilities} setItems={setResponsibilities} placeholder="e.g. Own features end to end" />
        <ListInput label="Requirements" items={requirements} setItems={setRequirements} placeholder="e.g. Python" />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button loading={busy} onClick={() => void submit()}>Post role</Button>
      </div>
    </Modal>
  );
}

export default function Postings() {
  const { activeInstitution } = useApp();
  const navigate = useNavigate();
  const [postings, setPostings] = useState<JobPosting[] | null>(null);
  const [stats, setStats] = useState<Record<string, PostingStats>>({});
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!activeInstitution) return;
    setError(false);
    setPostings(null);
    try {
      // scoped: only this institution's postings
      const list = await db.listJobPostingsByInstitution(activeInstitution.id);
      setPostings(list);
      const applicants = await db.listApplicantsByInstitution(activeInstitution.id, { targetType: 'job' });
      const s: Record<string, PostingStats> = {};
      for (const j of list) {
        const mine = applicants.filter((a) => a.application.job_posting_id === j.id);
        s[j.id] = {
          applicants: mine.length,
          verified: mine.filter((a) => a.verification === 'verified').length,
          shortlisted: mine.filter((a) => Boolean((a.application.documents as Record<string, unknown>).shortlisted_by_institution)).length,
        };
      }
      setStats(s);
    } catch {
      setError(true);
    }
  }, [activeInstitution]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!activeInstitution) return null;

  return (
    <div>
      <Eyebrow>Postings</Eyebrow>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <PageTitle>{activeInstitution.name} — your open roles.</PageTitle>
          <p className="mt-2 text-sm text-slate">Candidates apply with verified credentials attached.</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={15} /> Post a new role
        </Button>
      </div>

      <div className="mt-8 space-y-3">
        {error ? (
          <ErrorState onRetry={() => void load()} />
        ) : postings === null ? (
          <SkeletonRows rows={3} />
        ) : postings.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No open roles"
            body="Post your first role and it becomes visible to every candidate on Passage."
            action={<Button onClick={() => setModalOpen(true)}>Post a new role</Button>}
          />
        ) : (
          postings.map((j) => {
            const s = stats[j.id];
            return (
              <button
                key={j.id}
                onClick={() =>
                  navigate('/hiring/applicants', { state: { jobPostingId: j.id, targetName: j.title } })
                }
                className="card-surface flex w-full flex-wrap items-center justify-between gap-3 p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(22,35,63,0.12)]"
              >
                <div>
                  <div className="font-display text-lg font-semibold text-parchment">{j.title}</div>
                  <div className="text-xs text-slate">
                    {j.location} · {j.work_mode} · posted{' '}
                    <span className="font-mono">{new Date(j.posted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
                <div className="font-mono text-xs text-slate">
                  {s ? `${s.applicants} applicants · ${s.verified} verified · ${s.shortlisted} shortlisted` : '…'}
                </div>
              </button>
            );
          })
        )}
      </div>

      {modalOpen && (
        <PostRoleModal
          onClose={() => setModalOpen(false)}
          onPosted={(j) => setPostings((p) => (p ? [j, ...p] : [j]))}
        />
      )}
    </div>
  );
}
