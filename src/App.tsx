import { ReactNode, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppProvider, useApp } from '@/state/AppContext';
import { ToastProvider } from '@/components/ui';
import TrackLayout from '@/components/TrackLayout';
import Login from '@/pages/Login';
import Onboarding from '@/pages/Onboarding';
import PurposeSelection from '@/pages/PurposeSelection';
import Jobs from '@/pages/jobs/Jobs';
import AIMatch from '@/pages/jobs/AIMatch';
import JobApplications from '@/pages/jobs/JobApplications';
import Universities from '@/pages/studies/Universities';
import AIShortlist from '@/pages/studies/AIShortlist';
import Exams from '@/pages/studies/Exams';
import StudyApplications from '@/pages/studies/StudyApplications';
import ApplicationForm from '@/pages/studies/ApplicationForm';
import Vault from '@/pages/credentials/Vault';
import Postings from '@/pages/institution/Postings';
import Programs from '@/pages/institution/Programs';
import Requests from '@/pages/institution/Requests';
import Applicants from '@/pages/institution/Applicants';
import Verify from '@/pages/institution/Verify';

function Guard({ children }: { children: ReactNode }) {
  const { session, profile, profileLoading } = useApp();
  if (!session) return <Navigate to="/login" replace />;
  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-3 border-t-orange" />
      </div>
    );
  }
  if (!profile?.full_name) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function OnboardingGuard() {
  const { session } = useApp();
  if (!session) return <Navigate to="/login" replace />;
  return <Onboarding />;
}

function InTrack({ children }: { children: ReactNode }) {
  return (
    <Guard>
      <TrackLayout>{children}</TrackLayout>
    </Guard>
  );
}

function Home() {
  const { track } = useApp();
  if (!track) return <Navigate to="/purpose" replace />;
  const first: Record<string, string> = {
    jobs: '/jobs',
    studies: '/studies',
    hiring: '/hiring',
    admissions: '/admissions',
  };
  return <Navigate to={first[track]} replace />;
}

export default function App() {
  // One delegate powers the cursor-tracking spotlight on every .card-surface
  // (adapted from React Bits SpotlightCard).
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const card = (e.target as Element | null)?.closest?.('.card-surface') as HTMLElement | null;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    };
    document.addEventListener('mousemove', onMove, { passive: true });
    return () => document.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <ToastProvider>
      <AppProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<OnboardingGuard />} />
          <Route
            path="/purpose"
            element={
              <Guard>
                <PurposeSelection />
              </Guard>
            }
          />
          <Route path="/" element={<Guard><Home /></Guard>} />

          {/* Track A — Job seeker */}
          <Route path="/jobs" element={<InTrack><Jobs /></InTrack>} />
          <Route path="/jobs/match" element={<InTrack><AIMatch /></InTrack>} />
          <Route path="/jobs/applications" element={<InTrack><JobApplications /></InTrack>} />
          <Route path="/jobs/verification" element={<InTrack><Vault /></InTrack>} />

          {/* Track B — Higher studies */}
          <Route path="/studies" element={<InTrack><Universities /></InTrack>} />
          <Route path="/studies/shortlist" element={<InTrack><AIShortlist /></InTrack>} />
          <Route path="/studies/exams" element={<InTrack><Exams /></InTrack>} />
          <Route path="/studies/applications" element={<InTrack><StudyApplications /></InTrack>} />
          <Route path="/studies/apply/:programId" element={<InTrack><ApplicationForm /></InTrack>} />
          <Route path="/studies/verification" element={<InTrack><Vault /></InTrack>} />

          {/* Track C — Hiring */}
          <Route path="/hiring" element={<InTrack><Postings /></InTrack>} />
          <Route path="/hiring/applicants" element={<InTrack><Applicants /></InTrack>} />
          <Route path="/hiring/verify" element={<InTrack><Verify /></InTrack>} />

          {/* Track D — Admissions */}
          <Route path="/admissions" element={<InTrack><Programs /></InTrack>} />
          <Route path="/admissions/requests" element={<InTrack><Requests /></InTrack>} />
          <Route path="/admissions/applicants" element={<InTrack><Applicants /></InTrack>} />
          <Route path="/admissions/verify" element={<InTrack><Verify /></InTrack>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProvider>
    </ToastProvider>
  );
}
