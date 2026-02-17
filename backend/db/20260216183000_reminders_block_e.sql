begin;

create table if not exists public.relevo_dates (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid null references public.clientes(id) on delete set null,
  phone_e164 text not null,
  relevo_date date not null,
  tipo text not null,
  timezone text not null default 'America/Belem',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists relevo_dates_phone_date_tipo_unique
  on public.relevo_dates (phone_e164, relevo_date, tipo);

create index if not exists relevo_dates_lookup_idx
  on public.relevo_dates (relevo_date, ativo, phone_e164);

drop trigger if exists update_relevo_dates_updated_at on public.relevo_dates;
create trigger update_relevo_dates_updated_at
before update on public.relevo_dates
for each row execute function public.update_updated_at_column();

create table if not exists public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid null references public.clientes(id) on delete set null,
  phone_e164 text not null,
  relevo_date date not null,
  tipo text not null,
  status text not null,
  provider_message_id text null,
  sent_at timestamptz null,
  error_summary text null,
  payload jsonb null,
  created_at timestamptz not null default now(),
  constraint reminder_logs_status_chk check (status in ('sent', 'failed', 'skipped_duplicate', 'dry_run'))
);

create index if not exists reminder_logs_phone_date_tipo_idx
  on public.reminder_logs (phone_e164, relevo_date, tipo);

create unique index if not exists reminder_logs_dedupe_daily_unique
  on public.reminder_logs (phone_e164, relevo_date, tipo)
  where status in ('sent', 'dry_run');

alter table public.relevo_dates enable row level security;
alter table public.relevo_dates force row level security;
alter table public.reminder_logs enable row level security;
alter table public.reminder_logs force row level security;

do $$
declare
  v_role text := current_user;
begin
  execute 'drop policy if exists p_backend_all on public.relevo_dates';
  execute format(
    'create policy p_backend_all on public.relevo_dates for all to %I using (true) with check (true)',
    v_role
  );

  execute 'drop policy if exists p_backend_all on public.reminder_logs';
  execute format(
    'create policy p_backend_all on public.reminder_logs for all to %I using (true) with check (true)',
    v_role
  );
end
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.relevo_dates from anon';
    execute 'revoke all on public.reminder_logs from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.relevo_dates from authenticated';
    execute 'revoke all on public.reminder_logs from authenticated';
  end if;
end
$$;

commit;
