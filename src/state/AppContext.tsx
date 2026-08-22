import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Session, getSession, onAuthStateChange, signOut as authSignOut } from '@/lib/auth';
import { Institution, Membership, Profile, Track } from '@/lib/types';
import * as db from '@/lib/db';

interface AppState {
  session: Session | null;
  profile: Profile | null;
  membership: Membership | null;
  profileLoading: boolean;
  track: Track | null;
  /** Active institution for Tracks C and D. */
  activeInstitution: Institution | null;
  setTrack: (t: Track | null) => void;
  setActiveInstitution: (i: Institution) => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

const trackKey = (userId: string) => `passage.track.${userId}`;
const instKey = (userId: string, track: string) => `passage.inst.${userId}.${track}`;

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [track, setTrackState] = useState<Track | null>(null);
  const [activeInstitution, setActiveInstitutionState] = useState<Institution | null>(null);

  useEffect(() => onAuthStateChange(setSession), []);

  const loadProfile = useCallback(async (s: Session) => {
    setProfileLoading(true);
    try {
      const p = await db.ensureProfile(s.userId, s.email);
      // demo student maps by email to the seeded profile, which may use a
      // different id — resolve by email first
      const byEmail = await db.getProfileByEmail(s.email);
      const resolved = byEmail ?? p;
      setProfile(resolved);
      setMembership(await db.getMembership(resolved.id));
      const savedTrack = localStorage.getItem(trackKey(resolved.id)) as Track | null;
      setTrackState(savedTrack);
      if (savedTrack === 'hiring' || savedTrack === 'admissions') {
        const savedInst = localStorage.getItem(instKey(resolved.id, savedTrack));
        if (savedInst) setActiveInstitutionState(db.getInstitutionSync(savedInst));
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      void loadProfile(session);
    } else {
      setProfile(null);
      setMembership(null);
      setTrackState(null);
      setActiveInstitutionState(null);
      setProfileLoading(false);
    }
  }, [session, loadProfile]);

  const setTrack = useCallback(
    (t: Track | null) => {
      setTrackState(t);
      if (profile) {
        if (t) localStorage.setItem(trackKey(profile.id), t);
        else localStorage.removeItem(trackKey(profile.id));
      }
      // entering an institution track: pick the default institution
      if (t === 'hiring' || t === 'admissions') {
        const saved = profile ? localStorage.getItem(instKey(profile.id, t)) : null;
        const fromSaved = saved ? db.getInstitutionSync(saved) : null;
        if (fromSaved && (t === 'hiring' ? fromSaved.type === 'company' : fromSaved.type === 'university')) {
          setActiveInstitutionState(fromSaved);
          return;
        }
        const memberInst = membership ? db.getInstitutionSync(membership.institution_id) : null;
        const wanted = t === 'hiring' ? 'company' : 'university';
        if (memberInst && memberInst.type === wanted) {
          setActiveInstitutionState(memberInst);
        } else {
          // demo default: Sarvam AI for hiring, VIT Chennai for admissions
          setActiveInstitutionState(db.getInstitutionSync(t === 'hiring' ? 'c-sarvam' : 'i-vit'));
        }
      }
    },
    [profile, membership],
  );

  const setActiveInstitution = useCallback(
    (i: Institution) => {
      setActiveInstitutionState(i);
      if (profile && track) localStorage.setItem(instKey(profile.id, track), i.id);
    },
    [profile, track],
  );

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    const byEmail = await db.getProfileByEmail(session.email);
    if (byEmail) {
      setProfile(byEmail);
      setMembership(await db.getMembership(byEmail.id));
    }
  }, [session]);

  const signOut = useCallback(async () => {
    await authSignOut();
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile,
      membership,
      profileLoading,
      track,
      activeInstitution,
      setTrack,
      setActiveInstitution,
      refreshProfile,
      signOut,
    }),
    [session, profile, membership, profileLoading, track, activeInstitution, setTrack, setActiveInstitution, refreshProfile, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
