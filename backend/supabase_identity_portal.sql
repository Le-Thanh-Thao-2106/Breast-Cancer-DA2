
create table if not exists breastcare_private.portal_sessions (
    token_hash bytea primary key,
    account_id uuid not null references breastcare_private.accounts(id) on delete cascade,
    expires_at timestamptz not null
);

create index if not exists breastcare_portal_sessions_account_idx
    on breastcare_private.portal_sessions (account_id);

alter table breastcare_private.sessions
    add column if not exists portal_token_hash bytea
        references breastcare_private.portal_sessions(token_hash) on delete cascade;

alter table breastcare_private.sign_in_codes
    add column if not exists portal_token_hash bytea
        references breastcare_private.portal_sessions(token_hash) on delete cascade;

create index if not exists breastcare_sessions_portal_idx
    on breastcare_private.sessions (portal_token_hash);

create index if not exists breastcare_codes_portal_idx
    on breastcare_private.sign_in_codes (portal_token_hash);

create table if not exists breastcare_private.app_permissions (
    account_id uuid not null references breastcare_private.accounts(id) on delete cascade,
    app text not null,
    allowed boolean not null,
    updated_at timestamptz not null default now(),
    primary key (account_id, app)
);

revoke all on breastcare_private.portal_sessions, breastcare_private.app_permissions
    from public, anon, authenticated;
