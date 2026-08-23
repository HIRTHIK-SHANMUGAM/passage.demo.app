import { Track } from './types';

export interface TrackTab {
  label: string;
  path: string;
}

export interface TrackConfig {
  id: Track;
  label: string;
  base: string;
  tabs: TrackTab[];
}

export const TRACKS: Record<Track, TrackConfig> = {
  jobs: {
    id: 'jobs',
    label: 'Job seeker',
    base: '/jobs',
    tabs: [
      { label: 'Jobs', path: '/jobs' },
      { label: 'AI Match', path: '/jobs/match' },
      { label: 'Applications', path: '/jobs/applications' },
      { label: 'Verification', path: '/jobs/verification' },
    ],
  },
  studies: {
    id: 'studies',
    label: 'Higher studies',
    base: '/studies',
    tabs: [
      { label: 'Universities', path: '/studies' },
      { label: 'AI Shortlist', path: '/studies/shortlist' },
      { label: 'Exams', path: '/studies/exams' },
      { label: 'Applications', path: '/studies/applications' },
      { label: 'Verification', path: '/studies/verification' },
    ],
  },
  hiring: {
    id: 'hiring',
    label: 'Hiring',
    base: '/hiring',
    tabs: [
      { label: 'Postings', path: '/hiring' },
      { label: 'Applicants', path: '/hiring/applicants' },
      { label: 'Verify', path: '/hiring/verify' },
    ],
  },
  admissions: {
    id: 'admissions',
    label: 'Admissions',
    base: '/admissions',
    tabs: [
      { label: 'Programs', path: '/admissions' },
      { label: 'Requests', path: '/admissions/requests' },
      { label: 'Applicants', path: '/admissions/applicants' },
      { label: 'Verify', path: '/admissions/verify' },
    ],
  },
};

export const TRACK_ORDER: Track[] = ['jobs', 'studies', 'hiring', 'admissions'];
