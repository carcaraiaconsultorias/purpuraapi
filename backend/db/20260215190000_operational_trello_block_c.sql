begin;

create table if not exists public.operational_items (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text null,
  tipo text not null,
  titulo text not null,
  descricao text not null default '',
  cliente_id uuid null references public.clientes(id) on delete set null,
  responsavel text not null default '',
  prioridade text not null default 'medium',
  status text not null default 'open',
  prazo_at timestamptz null,
  detalhes jsonb not null default '{}'::jsonb,
  trello_card_id text null,
  trello_card_url text null,
  trello_list_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_items_tipo_chk check (tipo in ('task', 'briefing', 'follow_up')),
  constraint operational_items_prioridade_chk check (prioridade in ('low', 'medium', 'high', 'urgent')),
  constraint operational_items_status_chk check (status in ('open', 'in_progress', 'done', 'blocked'))
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operational_items_idempotency_key_unique'
  ) then
    alter table public.operational_items
      add constraint operational_items_idempotency_key_unique unique (idempotency_key);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'operational_items_trello_card_id_unique'
  ) then
    alter table public.operational_items
      add constraint operational_items_trello_card_id_unique unique (trello_card_id);
  end if;
end
$$;

create index if not exists operational_items_tipo_status_idx
  on public.operational_items (tipo, status, updated_at desc);

create index if not exists operational_items_cliente_idx
  on public.operational_items (cliente_id, updated_at desc);

drop trigger if exists update_operational_items_updated_at on public.operational_items;
create trigger update_operational_items_updated_at
before update on public.operational_items
for each row execute function public.update_updated_at_column();

commit;
