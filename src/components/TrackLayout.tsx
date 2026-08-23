import { ReactNode, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Check, ChevronDown, LogOut, UserCircle2 } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { TRACKS, TRACK_ORDER } from '@/lib/tracks';
import { Track } from '@/lib/types';
import * as db from '@/lib/db';
import { LogoFull } from '@/components/Logo';
import { AvatarCircle, useToast } from '@/components/ui';

function TrackSwitcher() {
  const { track, setTrack } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!track) return null;

  function pick(t: Track) {
    setOpen(false);
    if (t === track) return;
    // change track state and navigate in the same tick — no stale content
    setTrack(t);
    navigate(TRACKS[t].tabs[0].path);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-btn border border-hairline bg-ink-3 px-3 py-1.5 text-xs font-medium text-parchment transition-colors hover:border-hairline-strong"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {TRACKS[track].label}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-card border border-hairline bg-ink-2 py-1 shadow-[0_12px_32px_rgba(22,35,63,0.16)]"
            role="menu"
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-2">Switch track</div>
            {TRACK_ORDER.map((t) => (
              <button
                key={t}
                role="menuitem"
                onClick={() => pick(t)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-parchment transition-colors hover:bg-ink-3"
              >
                {TRACKS[t].label}
                {t === track && <Check size={14} className="text-orange" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AvatarMenu() {
  const { profile, signOut } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const initial = (profile?.full_name ?? profile?.email ?? '?').slice(0, 1).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full"
      >
        <AvatarCircle text={initial} size={34} colorSeed={profile?.email} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-card border border-hairline bg-ink-2 py-1 shadow-[0_12px_32px_rgba(22,35,63,0.16)]"
            role="menu"
          >
            <div className="border-b border-hairline px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-parchment">
                <UserCircle2 size={15} className="text-slate" />
                {profile?.full_name ?? 'Unnamed'}
              </div>
              <div className="mt-0.5 truncate font-mono text-[11px] text-slate">{profile?.email}</div>
            </div>
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-parchment transition-colors hover:bg-ink-3"
            >
              <LogOut size={14} className="text-slate" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InstitutionSwitcher() {
  const { track, activeInstitution, setActiveInstitution } = useApp();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const wantedType = track === 'hiring' ? 'company' : 'university';
  const [options, setOptions] = useState(() =>
    [] as { id: string; name: string }[],
  );

  useEffect(() => {
    void db.listInstitutions(wantedType).then((list) => {
      // Admissions demo switcher only makes sense for universities that run programs
      const withContent = track === 'admissions'
        ? list.filter((i) => ['i-vit', 'i-iitm', 'i-iiith', 'i-cmu', 'i-tum', 'i-rwth', 'i-edin', 'i-nus', 'i-toronto'].includes(i.id))
        : list;
      setOptions(withContent.map((i) => ({ id: i.id, name: i.name })));
    });
  }, [wantedType, track]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function pick(id: string) {
    setOpen(false);
    if (id === activeInstitution?.id) return;
    const inst = db.getInstitutionSync(id);
    if (!inst) return;
    setActiveInstitution(inst);
    const count = await db.countApplicationsByInstitution(inst.id);
    toast(`Now viewing ${inst.name} — ${count} application${count === 1 ? '' : 's'}`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-btn border border-hairline px-2.5 py-1 text-xs text-slate transition-colors hover:border-hairline-strong hover:text-parchment"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Switch institution (demo)
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-40 mt-2 max-h-72 w-60 overflow-y-auto rounded-card border border-hairline bg-ink-2 py-1 shadow-[0_12px_32px_rgba(22,35,63,0.16)] thin-scroll"
            role="menu"
          >
            {options.map((o) => (
              <button
                key={o.id}
                role="menuitem"
                onClick={() => void pick(o.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-parchment transition-colors hover:bg-ink-3"
              >
                {o.name}
                {o.id === activeInstitution?.id && <Check size={14} className="text-orange" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScopeBanner() {
  const { activeInstitution } = useApp();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    setCount(null);
    if (activeInstitution) {
      void db.countApplicationsByInstitution(activeInstitution.id).then(setCount);
    }
  }, [activeInstitution]);

  if (!activeInstitution) return null;

  return (
    <div className="border-b border-hairline bg-ink-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 md:px-6">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          <Building2 size={14} className="shrink-0 text-slate" />
          <span className="truncate">
            <span className="font-medium text-parchment">Viewing {activeInstitution.name} only</span>
            <span className="text-slate">
              {' '}· {count === null ? '…' : `${count} application${count === 1 ? '' : 's'} to your ${activeInstitution.type === 'university' ? 'programs' : 'roles'}`}
            </span>
          </span>
        </div>
        <InstitutionSwitcher />
      </div>
    </div>
  );
}

export default function TrackLayout({ children }: { children: ReactNode }) {
  const { track, activeInstitution } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    if (track === 'admissions' && activeInstitution) {
      void db.countPendingRequests(activeInstitution.id).then(setPendingRequests);
    } else {
      setPendingRequests(0);
    }
  }, [track, activeInstitution]);

  useEffect(() => {
    if (!track) navigate('/purpose', { replace: true });
  }, [track, navigate]);

  if (!track) return null;
  const cfg = TRACKS[track];
  const isInstitutionTrack = track === 'hiring' || track === 'admissions';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-30 border-b border-hairline">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <button onClick={() => navigate('/purpose')} aria-label="Passage home" className="logo-aura">
            <LogoFull markSize={30} />
          </button>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Track navigation">
            {cfg.tabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === cfg.base}
                className={({ isActive }) =>
                  `relative rounded-btn px-3 py-1.5 text-sm transition-colors ${isActive ? 'font-semibold text-parchment' : 'text-slate hover:text-parchment'}`
                }
              >
                {({ isActive }) => (
                  <>
                    {tab.label}
                    {tab.label === 'Requests' && pendingRequests > 0 && (
                      <span className="ml-1.5 rounded-full bg-orange px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {pendingRequests}
                      </span>
                    )}
                    {isActive && (
                      <motion.span
                        layoutId="nav-underline"
                        className="nav-underline absolute inset-x-2"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <TrackSwitcher />
            <AvatarMenu />
          </div>
        </div>
        {/* mobile tabs */}
        <nav className="flex gap-1 overflow-x-auto border-t border-hairline px-3 py-1.5 md:hidden thin-scroll" aria-label="Track navigation">
          {cfg.tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === cfg.base}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-btn px-3 py-1 text-sm ${isActive ? 'bg-ink-3 font-semibold text-parchment' : 'text-slate'}`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {isInstitutionTrack && <ScopeBanner />}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
