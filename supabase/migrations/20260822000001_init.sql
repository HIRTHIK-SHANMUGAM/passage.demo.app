-- Passage — initial schema, RLS and seed
-- All PKs are uuid gen_random_uuid(); all timestamps are timestamptz.

create extension if not exists pgcrypto;

-- ============================================================ tables

create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('university', 'company')),
  domain text,
  initials char(2) not null,
  country text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text not null,
  student_id text,
  degree text,
  cgpa numeric,
  home_institution_id uuid references public.institutions (id),
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  institution_id uuid not null references public.institutions (id),
  role text not null check (role in ('admissions', 'recruiter')),
  created_at timestamptz not null default now()
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id),
  name text not null,
  degree_level text not null check (degree_level in ('Masters', 'PhD')),
  field text not null,
  tuition_lakhs numeric not null,
  deadline date not null,
  duration_years numeric not null,
  required_exams text[] not null default '{}',
  intake text,
  description text,
  curriculum text[] not null default '{}',
  acceptance_tier text not null check (acceptance_tier in ('reach', 'target', 'safe')),
  qs_rank int,
  created_at timestamptz not null default now()
);

create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id),
  title text not null,
  location text not null,
  work_mode text not null check (work_mode in ('Remote', 'Hybrid', 'Onsite')),
  employment_type text not null check (employment_type in ('Full-time', 'Internship', 'Contract')),
  experience_level text not null check (experience_level in ('Entry level', 'Mid', 'Senior')),
  salary_min numeric,
  salary_max numeric,
  salary_unit text check (salary_unit in ('LPA', 'per_month')),
  description text,
  responsibilities text[] not null default '{}',
  requirements text[] not null default '{}',
  posted_at timestamptz not null default now(),
  is_open boolean not null default true
);

create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  issuing_institution_id uuid not null references public.institutions (id),
  credential_type text not null check (credential_type in ('transcript', 'marksheet', 'bonafide', 'migration')),
  title text not null,
  issued_date date not null,
  payload jsonb not null,
  hash text not null,
  signature text not null,
  status text not null default 'issued' check (status in ('issued', 'revoked')),
  created_at timestamptz not null default now()
);

create table public.credential_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  institution_id uuid not null references public.institutions (id),
  credential_type text not null check (credential_type in ('transcript', 'marksheet', 'bonafide', 'migration')),
  note text,
  status text not null default 'pending' check (status in ('pending', 'issued', 'declined')),
  decline_reason text,
  resolved_credential_id uuid references public.credentials (id),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('job', 'program')),
  job_posting_id uuid references public.job_postings (id),
  program_id uuid references public.programs (id),
  -- Denormalised copy of the target's institution, set on insert. Exists to
  -- make institution scoping queries simple and fast — do not remove.
  institution_id uuid not null references public.institutions (id),
  status text not null check (status in ('shortlisted', 'started', 'submitted', 'in_review', 'interview', 'rejected', 'offer')),
  documents jsonb not null default '{}',
  form_data jsonb not null default '{}',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint one_target check (
    (job_posting_id is not null and program_id is null and target_type = 'job')
    or (program_id is not null and job_posting_id is null and target_type = 'program')
  )
);

create index applications_institution_idx on public.applications (institution_id);
create index applications_student_idx on public.applications (student_id);

create table public.credential_shares (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.credentials (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  recipient_label text not null,
  recipient_type text not null check (recipient_type in ('company', 'university')),
  scopes text[] not null default '{}',
  expires_at timestamptz,
  one_time boolean not null default false,
  notify_on_view boolean not null default false,
  view_count int not null default 0,
  last_viewed_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.verification_events (
  id uuid primary key default gen_random_uuid(),
  credential_hash text not null,
  verifier_user_id uuid references public.profiles (id),
  result text not null check (result in ('authentic', 'mismatch')),
  checked_at timestamptz not null default now()
);

-- ============================================================ profile trigger

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================ RLS

alter table public.institutions enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.programs enable row level security;
alter table public.job_postings enable row level security;
alter table public.credentials enable row level security;
alter table public.credential_requests enable row level security;
alter table public.applications enable row level security;
alter table public.credential_shares enable row level security;
alter table public.verification_events enable row level security;

-- helper: institutions the current user holds a membership in
create or replace function public.my_institution_ids()
returns setof uuid
language sql
security definer set search_path = public
stable
as $$
  select institution_id from public.memberships where user_id = auth.uid();
$$;

-- institutions: readable by all authenticated users
create policy "institutions readable" on public.institutions
  for select to authenticated using (true);

-- profiles: own row read/update; staff may read profiles of students who
-- applied to their institution
create policy "own profile read" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.applications a
      where a.student_id = profiles.id
        and a.institution_id in (select public.my_institution_ids())
    )
  );
create policy "own profile update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- memberships: user reads own; inserts own (onboarding)
create policy "own membership read" on public.memberships
  for select to authenticated using (user_id = auth.uid());
create policy "own membership insert" on public.memberships
  for insert to authenticated with check (user_id = auth.uid());

-- programs / job_postings: read for all authenticated; write only for staff
-- with a membership at that institution
create policy "programs readable" on public.programs
  for select to authenticated using (true);
create policy "programs staff write" on public.programs
  for all to authenticated
  using (institution_id in (select public.my_institution_ids()))
  with check (institution_id in (select public.my_institution_ids()));

create policy "postings readable" on public.job_postings
  for select to authenticated using (true);
create policy "postings staff write" on public.job_postings
  for all to authenticated
  using (institution_id in (select public.my_institution_ids()))
  with check (institution_id in (select public.my_institution_ids()));

-- credentials: student reads own; staff read credentials of students who
-- applied to their institution
create policy "credentials student read" on public.credentials
  for select to authenticated
  using (
    student_id = auth.uid()
    or exists (
      select 1 from public.applications a
      where a.student_id = credentials.student_id
        and a.institution_id in (select public.my_institution_ids())
    )
  );
create policy "credentials staff issue" on public.credentials
  for insert to authenticated
  with check (issuing_institution_id in (select public.my_institution_ids()));

-- credential_requests: student inserts/reads own; staff read+update rows for
-- their institution
create policy "requests student read" on public.credential_requests
  for select to authenticated
  using (student_id = auth.uid() or institution_id in (select public.my_institution_ids()));
create policy "requests student insert" on public.credential_requests
  for insert to authenticated with check (student_id = auth.uid());
create policy "requests staff update" on public.credential_requests
  for update to authenticated
  using (institution_id in (select public.my_institution_ids()))
  with check (institution_id in (select public.my_institution_ids()));

-- applications: student full access to own; staff read+update rows scoped to
-- their institution
create policy "applications student all" on public.applications
  for select to authenticated
  using (student_id = auth.uid() or institution_id in (select public.my_institution_ids()));
create policy "applications student insert" on public.applications
  for insert to authenticated with check (student_id = auth.uid());
create policy "applications update" on public.applications
  for update to authenticated
  using (student_id = auth.uid() or institution_id in (select public.my_institution_ids()))
  with check (student_id = auth.uid() or institution_id in (select public.my_institution_ids()));

-- credential_shares: only the owning student
create policy "shares owner all" on public.credential_shares
  for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- verification_events: any authenticated user may verify and record the result
create policy "verification read" on public.verification_events
  for select to authenticated using (true);
create policy "verification insert" on public.verification_events
  for insert to authenticated with check (true);

-- ============================================================ seed

insert into public.institutions (name, type, domain, initials, country) values
  ('VIT Chennai', 'university', 'vitstudent.ac.in', 'VC', 'India'),
  ('IIT Madras', 'university', 'iitm.ac.in', 'IM', 'India'),
  ('IIIT Hyderabad', 'university', 'iiit.ac.in', 'IH', 'India'),
  ('Carnegie Mellon', 'university', 'cmu.edu', 'CM', 'USA'),
  ('TU Munich', 'university', 'tum.de', 'TM', 'Germany'),
  ('RWTH Aachen', 'university', 'rwth-aachen.de', 'RA', 'Germany'),
  ('University of Edinburgh', 'university', 'ed.ac.uk', 'UE', 'UK'),
  ('NUS Singapore', 'university', 'nus.edu.sg', 'NS', 'Singapore'),
  ('University of Toronto', 'university', 'utoronto.ca', 'UT', 'Canada'),
  ('Anna University', 'university', 'annauniv.edu', 'AU', 'India'),
  ('BITS Pilani', 'university', 'bits-pilani.ac.in', 'BP', 'India'),
  ('Manipal University', 'university', 'manipal.edu', 'MU', 'India'),
  ('NIT Trichy', 'university', 'nitt.edu', 'NT', 'India'),
  ('Sarvam AI', 'company', 'sarvam.ai', 'SA', 'India'),
  ('Zoho', 'company', 'zoho.com', 'ZO', 'India'),
  ('Ati Motors', 'company', 'atimotors.com', 'AM', 'India'),
  ('Fractal Analytics', 'company', 'fractal.ai', 'FA', 'India'),
  ('Razorpay', 'company', 'razorpay.com', 'RP', 'India'),
  ('Ather Energy', 'company', 'atherenergy.com', 'AE', 'India'),
  ('Freshworks', 'company', 'freshworks.com', 'FW', 'India'),
  ('Niramai', 'company', 'niramai.com', 'NI', 'India');

-- Programs and job postings mirror src/lib/seed.ts; representative entries:
insert into public.programs (institution_id, name, degree_level, field, tuition_lakhs, deadline, duration_years, required_exams, intake, description, curriculum, acceptance_tier, qs_rank)
select i.id, p.name, p.level, p.field, p.tuition, p.deadline::date, 2, p.exams, 'Fall 2027', p.name || ' — applied program with coursework year one and thesis year two.', array['Advanced Algorithms', 'Core specialisation', 'Research seminar', 'Thesis'], p.tier, p.qs
from (values
  ('VIT Chennai', 'M.Tech CSE', 'Masters', 'Computer Science', 8::numeric, '2026-12-20', array['GATE'], 'safe', 601),
  ('VIT Chennai', 'M.Tech AI & Robotics', 'Masters', 'Artificial Intelligence', 9, '2027-01-10', array['GATE'], 'safe', 601),
  ('IIT Madras', 'M.Tech CSE', 'Masters', 'Computer Science', 4, '2027-02-28', array['GATE'], 'reach', 227),
  ('IIT Madras', 'MS Data Science', 'Masters', 'Data Science', 5, '2027-02-15', array['GATE'], 'reach', 227),
  ('IIIT Hyderabad', 'M.Tech CSE', 'Masters', 'Computer Science', 6, '2027-01-31', array['GATE'], 'target', 580),
  ('Carnegie Mellon', 'MS Computer Science', 'Masters', 'Computer Science', 62, '2026-12-15', array['GRE', 'TOEFL'], 'reach', 52),
  ('TU Munich', 'MSc Informatics', 'Masters', 'Computer Science', 3, '2027-01-15', array['IELTS'], 'target', 28),
  ('RWTH Aachen', 'MSc Software Systems', 'Masters', 'Software Engineering', 2, '2027-03-01', array['IELTS'], 'safe', 99),
  ('University of Edinburgh', 'MSc Artificial Intelligence', 'Masters', 'Artificial Intelligence', 38, '2026-12-31', array['IELTS'], 'target', 27),
  ('NUS Singapore', 'MComp Computer Science', 'Masters', 'Computer Science', 30, '2026-11-30', array['GRE', 'TOEFL'], 'reach', 8),
  ('University of Toronto', 'MScAC Applied Computing', 'Masters', 'Computer Science', 40, '2026-12-01', array['GRE', 'IELTS'], 'reach', 21)
) as p(inst, name, level, field, tuition, deadline, exams, tier, qs)
join public.institutions i on i.name = p.inst;

insert into public.job_postings (institution_id, title, location, work_mode, employment_type, experience_level, salary_min, salary_max, salary_unit, description, responsibilities, requirements)
select i.id, j.title, j.loc, j.mode, j.etype, j.exp, j.smin, j.smax, 'LPA', 'Own features end to end on a small, fast team.', array['Own features from spec to production', 'Ship in short cycles'], j.reqs
from (values
  ('Sarvam AI', 'ML Engineer', 'Bengaluru', 'Hybrid', 'Full-time', 'Entry level', 18::numeric, 28::numeric, array['Python', 'PyTorch', 'LLMs']),
  ('Sarvam AI', 'Full-stack Engineer', 'Bengaluru', 'Hybrid', 'Full-time', 'Mid', 22, 34, array['React', 'TypeScript', 'Node.js']),
  ('Zoho', 'Software Developer', 'Chennai', 'Onsite', 'Full-time', 'Entry level', 8, 12, array['Java', 'SQL']),
  ('Ati Motors', 'Robotics Software Engineer', 'Bengaluru', 'Onsite', 'Full-time', 'Entry level', 14, 22, array['C++', 'ROS']),
  ('Fractal Analytics', 'Data Scientist', 'Mumbai', 'Hybrid', 'Full-time', 'Entry level', 12, 18, array['Python', 'SQL', 'ML']),
  ('Razorpay', 'Backend Engineer', 'Bengaluru', 'Hybrid', 'Full-time', 'Entry level', 16, 24, array['Go', 'PostgreSQL']),
  ('Ather Energy', 'Embedded Software Engineer', 'Bengaluru', 'Onsite', 'Full-time', 'Entry level', 12, 18, array['C', 'RTOS']),
  ('Freshworks', 'Product Engineer', 'Chennai', 'Hybrid', 'Full-time', 'Entry level', 10, 16, array['Ruby', 'React']),
  ('Niramai', 'ML Engineer — Imaging', 'Bengaluru', 'Onsite', 'Full-time', 'Mid', 18, 26, array['Python', 'Computer Vision'])
) as j(inst, title, loc, mode, etype, exp, smin, smax, reqs)
join public.institutions i on i.name = j.inst;

-- Student profiles reference auth.users rows, which cannot be seeded from a
-- migration on hosted Supabase. The local demo store (src/lib/seed.ts) carries
-- the full 40-student dataset with unevenly distributed applications; against
-- a real project, students appear as they sign up via OTP.
