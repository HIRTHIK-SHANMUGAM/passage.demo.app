/**
 * The single auth interface for the entire app. Nothing outside this file
 * calls supabase.auth directly.
 *
 * VITE_USE_REAL_AUTH=false (default): a fully local mock — the OTP code is
 * shown on screen, the session lives in localStorage, no network calls, no
 * rate limits. VITE_USE_REAL_AUTH=true: real Supabase email OTP.
 * The rest of the app cannot tell which mode is active.
 */
import { getSupabase } from './supabase';

export interface Session {
  userId: string;
  email: string;
}

export const DEV_CODE = '429106';

const USE_REAL_AUTH = String(import.meta.env.VITE_USE_REAL_AUTH ?? 'false') === 'true';
const SESSION_KEY = 'passage.session.v1';
const PENDING_KEY = 'passage.pending-email.v1';

type Listener = (session: Session | null) => void;
const listeners = new Set<Listener>();

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(session: Session | null) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
  listeners.forEach((l) => l(session));
}

function emailToUserId(email: string): string {
  // Stable id per email so the same person keeps their profile across logins.
  let h = 0;
  const e = email.toLowerCase();
  for (let i = 0; i < e.length; i++) h = (h * 31 + e.charCodeAt(i)) >>> 0;
  return `u-${h.toString(36)}`;
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ---------------- mock implementation ---------------- */

async function mockSignIn(email: string): Promise<{ error?: string }> {
  await delay(700);
  localStorage.setItem(PENDING_KEY, email);
  return {};
}

async function mockVerify(email: string, code: string): Promise<{ error?: string }> {
  await delay(600);
  if (code !== DEV_CODE) {
    return { error: 'That code isn’t right. In dev mode the code is shown above.' };
  }
  localStorage.removeItem(PENDING_KEY);
  writeSession({ userId: emailToUserId(email), email });
  return {};
}

/* ---------------- real Supabase implementation ---------------- */

const RATE_LIMIT_MESSAGE =
  'Too many codes requested. Supabase limits this on the free tier — wait about an hour, or set VITE_USE_REAL_AUTH=false to use dev mode.';

async function realSignIn(email: string): Promise<{ error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or use dev mode.' };
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) {
    if (error.status === 429) return { error: RATE_LIMIT_MESSAGE };
    return { error: error.message };
  }
  localStorage.setItem(PENDING_KEY, email);
  return {};
}

async function realVerify(email: string, code: string): Promise<{ error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'Supabase is not configured.' };
  const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) {
    if (error.status === 429) return { error: RATE_LIMIT_MESSAGE };
    return { error: error.message };
  }
  const user = data.user;
  if (!user) return { error: 'Verification failed — no user returned.' };
  localStorage.removeItem(PENDING_KEY);
  writeSession({ userId: user.id, email: user.email ?? email });
  return {};
}

/* ---------------- public interface ---------------- */

export function signInWithEmail(email: string): Promise<{ error?: string }> {
  return USE_REAL_AUTH ? realSignIn(email) : mockSignIn(email);
}

export function verifyCode(email: string, code: string): Promise<{ error?: string }> {
  return USE_REAL_AUTH ? realVerify(email, code) : mockVerify(email, code);
}

export async function signOut(): Promise<void> {
  if (USE_REAL_AUTH) {
    await getSupabase()?.auth.signOut();
  }
  writeSession(null);
}

export function getSession(): Session | null {
  return readSession();
}

export function onAuthStateChange(callback: Listener): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function isDevAuth(): boolean {
  return !USE_REAL_AUTH;
}
