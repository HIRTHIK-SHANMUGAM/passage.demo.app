import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DEV_CODE, getSession, isDevAuth, signInWithEmail, verifyCode } from '@/lib/auth';
import { LogoMark } from '@/components/Logo';
import { ShinyText } from '@/components/effects';
import { Button, Input } from '@/components/ui';

type Step = 'email' | 'code';

export default function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [busy, setBusy] = useState(false);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resendIn, setResendIn] = useState(0);
  const boxRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (getSession()) navigate('/', { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  async function submitEmail(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    if (!validEmail(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    const { error } = await signInWithEmail(email);
    setBusy(false);
    if (error) {
      setEmailError(error);
      return;
    }
    setStep('code');
    setResendIn(60);
    setDigits(['', '', '', '', '', '']);
    setTimeout(() => boxRefs.current[0]?.focus(), 50);
  }

  async function submitCode(code: string) {
    if (busy) return;
    setBusy(true);
    const { error } = await verifyCode(email, code);
    setBusy(false);
    if (error) {
      setCodeError(error);
      return;
    }
    navigate('/', { replace: true });
  }

  function setDigit(i: number, v: string) {
    setCodeError('');
    const clean = v.replace(/\D/g, '');
    if (clean.length > 1) {
      // paste-to-fill
      const next = ['', '', '', '', '', ''];
      for (let k = 0; k < 6; k++) next[k] = clean[k] ?? '';
      setDigits(next);
      const lastFilled = Math.min(clean.length, 6) - 1;
      boxRefs.current[Math.min(lastFilled + 1, 5)]?.focus();
      if (clean.length >= 6) void submitCode(clean.slice(0, 6));
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) boxRefs.current[i + 1]?.focus();
    const full = next.join('');
    if (full.length === 6) void submitCode(full);
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      boxRefs.current[i - 1]?.focus();
      const next = [...digits];
      next[i - 1] = '';
      setDigits(next);
    }
  }

  async function resend() {
    if (resendIn > 0 || busy) return;
    setBusy(true);
    await signInWithEmail(email);
    setBusy(false);
    setResendIn(60);
    setCodeError('');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <LogoMark size={96} />
          <ShinyText
            text="Passage"
            speed={4}
            className="font-display text-4xl font-semibold tracking-wide"
          />
          <p className="text-[10px] uppercase tracking-[0.24em] text-slate">
            Your records. Your access. Verified instantly.
          </p>
        </div>

        <div className="card-surface p-6">
          {step === 'email' ? (
            <div>
              <h1 className="mb-1 font-display text-xl text-parchment">Enter Passage</h1>
              <p className="mb-5 text-sm text-slate">We'll email you a six-digit code. No passwords.</p>
              <Input
                label="Email"
                type="email"
                placeholder="you@university.ac.in"
                value={email}
                autoFocus
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && submitEmail()}
                error={emailError}
              />
              <Button className="mt-4 w-full" loading={busy} onClick={() => submitEmail()}>
                Continue
              </Button>
            </div>
          ) : (
            <div>
              <h1 className="mb-1 font-display text-xl text-parchment">Check your email</h1>
              <p className="mb-4 text-sm text-slate">
                We sent a code to <span className="text-parchment">{email}</span>
              </p>

              {isDevAuth() && (
                <div className="mb-4 rounded-btn border border-dashed border-hairline-strong bg-ink-3/60 px-3 py-2 text-center text-sm text-slate">
                  Dev mode — your code is{' '}
                  <span className="font-mono font-semibold text-orange">{DEV_CODE}</span>
                </div>
              )}

              <div className="mb-2 flex justify-between gap-2">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (boxRefs.current[i] = el)}
                    value={d}
                    inputMode="numeric"
                    aria-label={`Digit ${i + 1}`}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => onKeyDown(i, e)}
                    onFocus={(e) => e.target.select()}
                    className={`h-12 w-11 rounded-btn border bg-ink-3 text-center font-mono text-lg text-parchment ${codeError ? 'border-red' : 'border-hairline focus:border-hairline-strong'}`}
                  />
                ))}
              </div>
              {codeError && <p className="mb-2 text-xs text-red">{codeError}</p>}

              <Button
                className="mt-3 w-full"
                loading={busy}
                onClick={() => {
                  const full = digits.join('');
                  if (full.length < 6) {
                    setCodeError('Enter all six digits.');
                    return;
                  }
                  void submitCode(full);
                }}
              >
                Enter Passage
              </Button>

              <div className="mt-4 flex items-center justify-between text-xs">
                <button
                  className="text-slate transition-colors hover:text-parchment disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={resendIn > 0 || busy}
                  onClick={resend}
                >
                  {resendIn > 0 ? `Resend code (${resendIn}s)` : 'Resend code'}
                </button>
                <button
                  className="text-slate transition-colors hover:text-parchment"
                  onClick={() => {
                    setStep('email');
                    setCodeError('');
                    setDigits(['', '', '', '', '', '']);
                  }}
                >
                  Use a different email
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
