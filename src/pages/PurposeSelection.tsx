import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Briefcase, Building2, CheckCircle2, GraduationCap, Landmark, Loader2, LogOut } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { Track } from '@/lib/types';
import { TRACKS } from '@/lib/tracks';
import * as db from '@/lib/db';
import { LogoFull } from '@/components/Logo';

const CARDS: { track: Track; icon: typeof Briefcase; title: string; body: string }[] = [
  { track: 'jobs', icon: Briefcase, title: 'Find a job', body: 'Search open roles, match by AI, apply with verified credentials.' },
  { track: 'studies', icon: GraduationCap, title: 'Apply for higher studies', body: 'Build a realistic shortlist, plan your exams, apply with proof.' },
  { track: 'hiring', icon: Building2, title: "I'm hiring", body: 'Post roles and screen applicants whose records verify in a second.' },
  { track: 'admissions', icon: Landmark, title: "I'm admitting students", body: 'Review applicants, issue credentials, verify transcripts instantly.' },
];

export default function PurposeSelection() {
  const { profile, membership, setTrack, signOut } = useApp();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState<Track | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  function identityLabel(track: Track): string {
    const homeName = profile?.home_institution_id
      ? db.getInstitutionSync(profile.home_institution_id)?.name ?? 'your institution'
      : 'your institution';
    if (track === 'jobs' || track === 'studies') return `Verified as ${homeName} student`;
    const memberInst = membership ? db.getInstitutionSync(membership.institution_id) : null;
    if (track === 'hiring') {
      const inst = memberInst?.type === 'company' ? memberInst.name : 'Sarvam AI';
      return `Verified as ${inst} — Recruiting`;
    }
    const inst = memberInst?.type === 'university' ? memberInst.name : 'VIT Chennai';
    return `Verified as ${inst} — Admissions`;
  }

  function choose(track: Track) {
    if (confirming) return;
    setConfirming(track);
    setConfirmed(false);
    setTimeout(() => setConfirmed(true), 800);
    setTimeout(() => {
      setTrack(track);
      navigate(TRACKS[track].tabs[0].path, { replace: true });
    }, 1400);
  }

  return (
    <div className="min-h-screen bg-ink">
      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-12">
        <div className="mb-2 flex w-full items-center justify-between">
          <LogoFull markSize={32} />
          <button
            onClick={() => {
              void signOut();
            }}
            className="flex items-center gap-1.5 text-xs text-slate transition-colors hover:text-parchment"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.5 }}
          className="mt-10 w-full text-center"
        >
          <h1 className="font-display text-3xl font-semibold text-parchment md:text-4xl">
            What brings you here{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}?
          </h1>
          <p className="mt-2 text-sm text-slate">Pick a path. You can switch any time from the top bar.</p>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {CARDS.map(({ track, icon: Icon, title, body }, idx) => (
              <motion.button
                key={track}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * idx, type: 'spring', duration: 0.45 }}
                onClick={() => choose(track)}
                className="card-surface group p-7 text-left transition-all duration-300 hover:-translate-y-1.5 hover:border-orange/50 hover:shadow-[0_14px_36px_rgba(0,0,0,0.4)]"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-btn bg-ink-3 transition-colors group-hover:bg-orange/15">
                  <Icon size={22} className="text-orange" />
                </div>
                <h2 className="font-display text-xl font-semibold text-parchment">{title}</h2>
                <p className="mt-1.5 text-sm text-slate">{body}</p>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="card-surface flex flex-col items-center gap-4 px-10 py-8"
            >
              {confirmed ? (
                <motion.div initial={{ scale: 0.4 }} animate={{ scale: [0.4, 1.12, 1] }} transition={{ duration: 0.4 }}>
                  <CheckCircle2 size={40} className="text-green" />
                </motion.div>
              ) : (
                <Loader2 size={40} className="animate-spin text-orange" />
              )}
              <div className="text-sm text-parchment">{identityLabel(confirming)}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
