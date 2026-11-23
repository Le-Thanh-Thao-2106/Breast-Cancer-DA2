do $$
begin
    if exists (
        select 1 from pg_constraint
        where conrelid = 'public.bc_analysis_sessions'::regclass
          and conname = 'bc_analysis_sessions_sample_count_600_check'
    ) then
        return;
    end if;

    perform pg_advisory_xact_lock(671842600);
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.bc_analysis_sessions'::regclass
          and conname = 'bc_analysis_sessions_sample_count_600_check'
    ) then
        alter table public.bc_analysis_sessions
            drop constraint if exists bc_analysis_sessions_sample_count_check,
            add constraint bc_analysis_sessions_sample_count_600_check
                check (sample_count between 1 and 600);
    end if;
end;
$$;
