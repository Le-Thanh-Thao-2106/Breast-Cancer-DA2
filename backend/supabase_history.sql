
create table if not exists public.bc_analysis_sessions (
 id text primary key,
 user_id text not null,
 user_email text,
 kind text not null check(kind in ('batch','single')),
 created_at timestamptz not null default now(),
 filename text,
 sample_count integer not null constraint bc_analysis_sessions_sample_count_600_check check(sample_count between 1 and 600),
 kernels text[] not null,
 summary jsonb not null default '[]'::jsonb,
 details jsonb not null default '{}'::jsonb
);
create index if not exists bc_sessions_user_date on public.bc_analysis_sessions(user_id,created_at desc);
create index if not exists bc_sessions_created on public.bc_analysis_sessions(created_at desc);
alter table public.bc_analysis_sessions enable row level security;

