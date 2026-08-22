# Passage — Build Plan

Working through the master spec milestone by milestone. `npm run build` + `npx tsc --noEmit` must pass after each.

## Milestone 1 — Foundation
- [x] Scaffold Vite + React + TS + Tailwind + Router + Framer Motion
- [x] `@/` alias in vite.config.ts and tsconfig.json
- [x] Design tokens as CSS custom properties + Tailwind theme
- [x] Fonts: Fraunces / Inter / JetBrains Mono from Google Fonts
- [x] Logo component (LogoMark / LogoWordmark / LogoFull) + favicon
- [x] App shell: routing, nav, toast system
- [x] UI primitives: Button, Card, Modal, Pill, Input, Skeleton, EmptyState

## Milestone 2 — Database
- [x] Migration: all tables (institutions, profiles, memberships, programs, job_postings, credentials, credential_requests, applications, credential_shares, verification_events)
- [x] RLS policies on every table
- [x] Profile auto-create trigger
- [x] Seed data (universities, companies, programs, postings, ~40 students, demo student Hirthik S)
- [x] Local data store mirroring the schema so the app runs with no Supabase project

## Milestone 3 — Auth
- [x] `src/lib/auth.ts` single interface; mock + real behind `VITE_USE_REAL_AUTH`
- [x] Mock: on-screen dev code, localStorage session, ~700ms delay
- [x] Real: signInWithOtp / verifyOtp, explicit 429 message
- [x] Login screen: email → 6 OTP boxes (auto-advance, paste, backspace), resend countdown, different-email link, inline errors, spinner/disable
- [x] Session persistence, route guards, sign-out
- [x] First-login onboarding (student vs staff)

## Milestone 4 — Purpose selection & track shell
- [x] Four-card 2×2 purpose grid
- [x] Identity-confirmation modal (~1.2s, after purpose pick only)
- [x] Per-track nav tabs
- [x] "Switch track" dropdown with instant switch, no stale content

## Milestone 5 — Institution scoping
- [x] `activeInstitution` state from membership
- [x] Every Track C/D query filters by institution id (in the query, not client-side)
- [x] Scope banner under nav on every C/D screen
- [x] Demo institution switcher with full re-fetch + toast
- [x] Institution-named page titles

## Milestone 6 — Credential system
- [x] Vault (credential cards, hash, View/Share)
- [x] Share modal: selective disclosure, access toggles, generated link, real recipient name
- [x] Track-aware access log with revoke + confirm
- [x] Verify screen: samples, loading, green spring success, red shake failure + diff table
- [x] AI assistant panel with chips, free text, blocked state on failed credential

## Milestone 7 — Credential request loop
- [x] Student request modal (locked to home institution, option cards, reason)
- [x] "Your requests" status list (pending/issued/declined + reminder)
- [x] Admissions Requests inbox with pending count badge
- [x] Issue & sign modal with editable payload, staged signing animation, hash
- [x] Decline with required reason shown to student
- [x] Full round trip verified

## Milestone 8 — Track A
- [x] Jobs list/detail split, all filters + search + sort working, live count
- [x] Job cards with Applied badge; detail panel with match callout
- [x] Apply modal with verified-credentials row + toast
- [x] AI Match: drag-drop upload, staged analysis, honest read, ranked matches, stretch toggle
- [x] Applications: stats, filters, expandable timeline

## Milestone 9 — Track B
- [x] Universities: sidebar filters (all working incl. degree level), dual-handle tuition slider
- [x] University cards + detail view with requirements checklist
- [x] AI Shortlist: profile card, staged analysis, honest read, reach/target/safe groups, exam table + timeline, save shortlist
- [x] Exams tab with countdowns and warnings
- [x] Applications with clickable document checklist (transcript auto-attached from vault)
- [x] Full application form route with draft save/restore + submit confirm

## Milestone 10 — Tracks C & D
- [x] Postings + working "Post a new role" modal with validation
- [x] Programs list
- [x] Applicants: filter chips, verification badges, match %, View/Shortlist/reject-with-confirm, Verify now that persists
- [x] Verify screen wired into both tracks (failed rows deep-link)

## Milestone 11 — Polish
- [x] Colour-semantic audit (red only for failure; Reach = amber; match % coded by value)
- [x] Skeletons, empty states, error states everywhere
- [x] Contrast pass (mono metadata uses slate on ink/ink-2)
- [x] Responsive to 375px
- [x] Keyboard/focus: modal trap, Escape, focus return, visible rings
- [x] Dead-control audit — every button does something
- [x] Final verification checklist pass
