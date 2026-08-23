import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Landmark } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import * as db from '@/lib/db';
import { Institution, StaffRole } from '@/lib/types';
import { Button, Input, Select } from '@/components/ui';
import { LogoFull } from '@/components/Logo';

export default function Onboarding() {
  const { profile, session, refreshProfile } = useApp();
  const navigate = useNavigate();

  const [kind, setKind] = useState<'student' | 'staff' | null>(null);
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [degree, setDegree] = useState('');
  const [cgpa, setCgpa] = useState('');
  const [uniId, setUniId] = useState('');
  const [staffInstId, setStaffInstId] = useState('');
  const [role, setRole] = useState<StaffRole>('admissions');
  const [universities, setUniversities] = useState<Institution[]>([]);
  const [companies, setCompanies] = useState<Institution[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void db.listInstitutions('university').then(setUniversities);
    void db.listInstitutions('company').then(setCompanies);
  }, []);

  useEffect(() => {
    if (profile?.full_name) navigate('/', { replace: true });
  }, [profile, navigate]);

  const clearErr = (k: string) => setErrors((e) => ({ ...e, [k]: '' }));

  async function submit() {
    if (!profile || !session || busy) return;
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Your name is required.';
    if (kind === 'student') {
      if (!studentId.trim()) errs.studentId = 'Student ID is required.';
      if (!degree.trim()) errs.degree = 'Degree is required.';
      const c = parseFloat(cgpa);
      if (!cgpa || isNaN(c) || c < 0 || c > 10) errs.cgpa = 'Enter a CGPA between 0 and 10.';
      if (!uniId) errs.uni = 'Select your university.';
    } else if (kind === 'staff') {
      if (!staffInstId) errs.inst = 'Select your institution.';
    }
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setBusy(true);
    try {
      if (kind === 'student') {
        await db.updateProfile(profile.id, {
          full_name: fullName.trim(),
          student_id: studentId.trim(),
          degree: degree.trim(),
          cgpa: parseFloat(cgpa),
          home_institution_id: uniId,
        });
      } else {
        await db.updateProfile(profile.id, { full_name: fullName.trim() });
        await db.createMembership(profile.id, staffInstId, role);
      }
      await refreshProfile();
      navigate('/', { replace: true });
    } finally {
      setBusy(false);
    }
  }

  const staffOptions = role === 'recruiter' ? companies : universities;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="w-full max-w-lg"
      >
        <div className="mb-6 flex justify-center">
          <LogoFull markSize={40} />
        </div>
        <div className="card-surface p-6">
          <h1 className="mb-1 font-display text-2xl text-parchment">Welcome to Passage</h1>
          <p className="mb-5 text-sm text-slate">A few details before we open the door.</p>

          <Input
            label="Full name"
            placeholder="Your full name"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              clearErr('fullName');
            }}
            error={errors.fullName}
            className="mb-4"
          />

          <div className="mb-1.5 text-xs font-medium text-slate">You are…</div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            {(
              [
                { k: 'student' as const, icon: GraduationCap, label: 'A student', sub: 'Graduating or graduated' },
                { k: 'staff' as const, icon: Landmark, label: 'Institution staff', sub: 'Admissions or recruiting' },
              ]
            ).map(({ k, icon: Icon, label, sub }) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-card border p-4 text-left transition-all ${kind === k ? 'border-orange bg-orange/10' : 'border-hairline bg-ink-3/50 hover:border-hairline-strong'}`}
              >
                <Icon size={20} className={kind === k ? 'text-orange' : 'text-slate'} />
                <div className="mt-2 text-sm font-medium text-parchment">{label}</div>
                <div className="text-xs text-slate">{sub}</div>
              </button>
            ))}
          </div>

          {kind === 'student' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Student ID"
                  placeholder="VIT2026CS001"
                  value={studentId}
                  onChange={(e) => {
                    setStudentId(e.target.value);
                    clearErr('studentId');
                  }}
                  error={errors.studentId}
                />
                <Input
                  label="CGPA (/10)"
                  placeholder="9.2"
                  value={cgpa}
                  onChange={(e) => {
                    setCgpa(e.target.value);
                    clearErr('cgpa');
                  }}
                  error={errors.cgpa}
                />
              </div>
              <Input
                label="Degree"
                placeholder="B.Tech CSE"
                value={degree}
                onChange={(e) => {
                  setDegree(e.target.value);
                  clearErr('degree');
                }}
                error={errors.degree}
              />
              <Select
                label="University you graduated from"
                value={uniId}
                onChange={(e) => {
                  setUniId(e.target.value);
                  clearErr('uni');
                }}
                error={errors.uni}
              >
                <option value="">Select your university…</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {kind === 'staff' && (
            <div className="space-y-4">
              <Select label="Your role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
                <option value="admissions">Admissions</option>
                <option value="recruiter">Recruiter</option>
              </Select>
              <Select
                label="Your institution"
                value={staffInstId}
                onChange={(e) => {
                  setStaffInstId(e.target.value);
                  clearErr('inst');
                }}
                error={errors.inst}
              >
                <option value="">Select your institution…</option>
                {staffOptions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {kind && (
            <Button className="mt-5 w-full" loading={busy} onClick={submit}>
              Continue to Passage
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
