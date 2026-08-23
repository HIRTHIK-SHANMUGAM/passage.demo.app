import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  forwardRef,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, LucideIcon } from 'lucide-react';

/* ---------- Button ---------- */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-solid' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'btn-primary bg-orange text-white hover:bg-orange-dim border border-transparent font-medium',
  secondary:
    'bg-transparent text-parchment border border-hairline-strong hover:bg-ink-3 font-medium',
  danger:
    'bg-transparent text-red border border-red/50 hover:bg-red/10 font-medium',
  'danger-solid': 'bg-red text-white hover:opacity-90 border border-transparent font-medium',
  ghost: 'bg-transparent text-slate hover:text-parchment border border-transparent font-medium',
};

const sizeClasses = {
  sm: 'text-xs px-3 py-1.5 rounded-[9px]',
  md: 'text-sm px-4 py-2 rounded-btn',
  lg: 'text-sm px-6 py-2.5 rounded-[11px]',
};

export function Button({
  variant = 'primary',
  loading = false,
  size = 'md',
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ---------- Card ---------- */

export function Card({
  children,
  className = '',
  hover = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`card-surface ${hover ? 'transition-all duration-300 hover:-translate-y-1.5 hover:border-orange/40 hover:shadow-[0_14px_36px_rgba(22,35,63,0.14)]' : ''} ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------- Pill ---------- */

export type PillTone = 'green' | 'orange' | 'amber' | 'red' | 'slate' | 'outline';

const pillTones: Record<PillTone, string> = {
  green: 'bg-green/15 text-green border border-green/30',
  orange: 'bg-orange/15 text-orange border border-orange/30',
  amber: 'bg-amber/15 text-amber border border-amber/30',
  red: 'bg-red/15 text-red border border-red/30',
  slate: 'bg-ink-3 text-slate border border-hairline',
  outline: 'bg-transparent text-parchment border border-hairline-strong',
};

export function Pill({
  tone = 'slate',
  children,
  className = '',
  dot = false,
  live = false,
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
  /** Leading status dot (Untitled UI BadgeWithDot pattern). */
  dot?: boolean;
  /** Adds a soft halo around the dot for "currently active" states. */
  live?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${pillTones[tone]} ${className}`}
    >
      {dot && <span className={`pill-dot ${live ? 'pill-dot-live' : ''}`} />}
      {children}
    </span>
  );
}

/* ---------- StatCard (Untitled UI metrics pattern) ---------- */

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'var(--blue)',
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  accent?: string;
  hint?: string;
}) {
  return (
    <div className="card-surface group p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-slate">{label}</div>
        {Icon && (
          <span
            className="featured-icon h-8 w-8"
            style={{ '--chip': accent } as React.CSSProperties}
          >
            <Icon size={15} />
          </span>
        )}
      </div>
      <div className="mt-1 font-display text-2xl font-semibold text-parchment">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-slate-2">{hint}</div>}
    </div>
  );
}

/* ---------- Inputs ---------- */

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, FieldProps>(function Input(
  { label, error, className = '', id, ...rest },
  ref,
) {
  const inputId = id ?? (label ? `f-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined);
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-slate">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`w-full rounded-btn border bg-ink-3 px-3 py-2 text-sm text-parchment placeholder:text-slate-2 transition-colors ${error ? 'border-red' : 'border-hairline focus:border-hairline-strong'}`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-red">{error}</p>}
    </div>
  );
});

interface AreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, AreaProps>(function Textarea(
  { label, error, className = '', id, ...rest },
  ref,
) {
  const inputId = id ?? (label ? `t-${label.replace(/\W+/g, '-').toLowerCase()}` : undefined);
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-slate">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        className={`w-full rounded-btn border bg-ink-3 px-3 py-2 text-sm text-parchment placeholder:text-slate-2 transition-colors ${error ? 'border-red' : 'border-hairline focus:border-hairline-strong'}`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-red">{error}</p>}
    </div>
  );
});

export function Select({
  label,
  error,
  className = '',
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }) {
  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-xs font-medium text-slate">{label}</label>}
      <select
        className={`w-full rounded-btn border bg-ink-3 px-3 py-2 text-sm text-parchment ${error ? 'border-red' : 'border-hairline'}`}
        {...rest}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red">{error}</p>}
    </div>
  );
}

/* ---------- Modal ---------- */

export function Modal({
  open,
  onClose,
  children,
  wide = false,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  labelledBy?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;
    const panel = panelRef.current;
    // focus the first focusable element in the panel
    const focusables = () =>
      panel?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ) ?? [];
    const first = focusables()[0];
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab') {
        const els = Array.from(focusables());
        if (els.length === 0) return;
        const firstEl = els[0];
        const lastEl = els[els.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      (triggerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
            className={`card-surface thin-scroll max-h-[90vh] w-full overflow-y-auto p-6 ${wide ? 'max-w-2xl' : 'max-w-md'}`}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ---------- Skeleton ---------- */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-block ${className}`} />;
}

export function SkeletonRows({ rows = 4, height = 'h-20' }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`card-surface flex items-center gap-4 p-4 ${height}`}>
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

/* ---------- EmptyState ---------- */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-surface group flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="icon-chip flex h-14 w-14 items-center justify-center rounded-full">
        <Icon size={24} />
      </div>
      <h3 className="font-display text-lg text-parchment">{title}</h3>
      {body && <p className="max-w-sm text-sm text-slate">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------- ErrorState ---------- */

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="card-surface flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="text-sm text-parchment">
        {message ?? "Something went wrong loading this. It's not you — try again."}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/* ---------- Avatar circle ---------- */

const avatarPalette = [
  '#2563EB', // blue-600
  '#7C3AED', // violet-600
  '#0D9488', // teal-600
  '#DB2777', // pink-600
  '#D97706', // amber-600
  '#059669', // emerald-600
  '#4F46E5', // indigo-600
  '#0284C7', // sky-600
];

export function AvatarCircle({
  text,
  size = 40,
  colorSeed,
  className = '',
}: {
  text: string;
  size?: number;
  colorSeed?: string;
  className?: string;
}) {
  const seed = colorSeed ?? text;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const bg = avatarPalette[h % avatarPalette.length];
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-display font-semibold text-parchment ${className}`}
      style={{ width: size, height: size, background: bg, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {text.slice(0, 2)}
    </div>
  );
}

/* ---------- Toast system ---------- */

interface ToastItem {
  id: number;
  message: string;
}

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((message: string) => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ type: 'spring', duration: 0.35, bounce: 0.3 }}
                className="rounded-full border border-hairline-strong bg-ink-3 px-5 py-2.5 text-sm text-parchment shadow-[0_8px_24px_rgba(22,35,63,0.16)]"
              >
                {t.message}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

/* ---------- Match percentage ---------- */

export function matchTone(pct: number): 'green' | 'orange' | 'slate' {
  if (pct >= 85) return 'green';
  if (pct >= 70) return 'orange';
  return 'slate';
}

export function MatchPct({ pct, className = '' }: { pct: number; className?: string }) {
  const tone = matchTone(pct);
  const color = tone === 'green' ? 'text-green' : tone === 'orange' ? 'text-orange' : 'text-slate';
  return (
    <div className={`text-center ${className}`}>
      <div className={`font-display text-xl font-semibold ${color}`}>{pct}%</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-2">match</div>
    </div>
  );
}

/* ---------- Page eyebrow/title helpers ---------- */

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange">
      {children}
    </div>
  );
}

export function PageTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={`font-display text-3xl font-semibold text-parchment md:text-4xl ${className}`}>
      {children}
    </h1>
  );
}
