# Passage

**Your records. Your access. Verified instantly.**

A platform for the moment after graduation. Students find a job or apply for a
master's degree; companies hire; universities admit. The spine of it all is a
credential system: academic records cryptographically signed by the issuing
institution, held by the student, and verifiable by anyone in about a second.

## Quick start

```bash
npm install
npm run dev
```

That's it — no configuration required. The app ships with a fully seeded local
demo database (40+ students, 21 institutions, programs, postings, credentials)
and mock auth: log in with any email, and the six-digit code is shown on
screen. Use `hirthikshanmugam7@gmail.com` to enter as the seeded demo student
with a populated vault, shares and applications.

## Configuration

Copy `.env.example` to `.env`:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Supabase project (schema + RLS in `supabase/migrations/`) |
| `VITE_GROQ_API_KEY` | Groq key for the AI features. Optional — every AI feature falls back to canned responses without it |
| `VITE_USE_REAL_AUTH` | `true` switches to real Supabase email OTP. Default `false` uses on-screen dev codes (no rate limits) |

## The four tracks

- **Job seeker** — job board with working filters, AI resume match, applications, credential vault
- **Higher studies** — university explorer, AI shortlist with exam planning, application forms with draft saving, vault
- **Hiring** — postings, applicants with instant credential verification
- **Admissions** — programs, credential request inbox (issue & sign), applicants, verification

Institution tracks are strictly scoped: every query filters by the active
institution, enforced again by row-level security at the database layer.

## Checks

```bash
npm run build      # production build
npm run typecheck  # tsc --noEmit, strict mode
```
