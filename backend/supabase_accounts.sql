begin;

create schema if not exists breastcare_private;
revoke all on schema breastcare_private from public, anon, authenticated;

create table if not exists breastcare_private.accounts (
    id uuid primary key,
    email text not null unique check (email = lower(email)),
    full_name text not null,
    password_hash text not null,
    created_at timestamptz not null default now()
);

create table if not exists breastcare_private.sessions (
    token_hash bytea primary key,
    account_id uuid not null references breastcare_private.accounts(id) on delete cascade,
    expires_at timestamptz not null
);
create index if not exists breastcare_sessions_account_idx
    on breastcare_private.sessions (account_id);

create table if not exists breastcare_private.sign_in_codes (
    token_hash bytea primary key,
    account_id uuid not null references breastcare_private.accounts(id) on delete cascade,
    code_challenge bytea not null,
    expires_at timestamptz not null
);
create index if not exists breastcare_sign_in_codes_expiry_idx
    on breastcare_private.sign_in_codes (expires_at);
create index if not exists breastcare_sign_in_codes_account_idx
    on breastcare_private.sign_in_codes (account_id);

create table if not exists breastcare_private.auth_limits (
    scope text not null,
    bucket bytea not null,
    attempts integer not null check (attempts > 0),
    expires_at timestamptz not null,
    primary key (scope, bucket)
);
create index if not exists breastcare_auth_limits_expiry_idx
    on breastcare_private.auth_limits (expires_at);

revoke all on all tables in schema breastcare_private from public, anon, authenticated;

create table if not exists public.bc_analysis_sessions (
    id text primary key,
    user_id text not null,
    user_email text,
    kind text not null check (kind in ('batch', 'single')),
    created_at timestamptz not null default now(),
    filename text,
    sample_count integer not null check (sample_count between 1 and 200),
    kernels text[] not null,
    summary jsonb not null default '[]'::jsonb,
    details jsonb not null default '{}'::jsonb
);
create index if not exists bc_sessions_user_date
    on public.bc_analysis_sessions (user_id, created_at desc);
create index if not exists bc_sessions_created
    on public.bc_analysis_sessions (created_at desc);
alter table public.bc_analysis_sessions enable row level security;
grant select, insert, delete on public.bc_analysis_sessions to service_role;

commit;
