begin;

create extension if not exists pgcrypto;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.servicos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null,
  preco numeric(10, 2) not null default 0,
  status text not null default 'Ativo',
  contratos integer not null default 0,
  tendencia text not null default 'stable',
  descricao text null,
  arquivo_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comercial_metas (
  id uuid primary key default gen_random_uuid(),
  vendedor text not null,
  meta numeric(10, 2) not null default 0,
  realizado numeric(10, 2) not null default 0,
  canal text not null default 'Online',
  periodo text not null default 'Mensal',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comercial_oportunidades (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  valor numeric(10, 2) not null default 0,
  etapa text not null default 'Lead',
  responsavel text null,
  dias_parado integer not null default 0,
  observacao text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_campanhas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  status text not null default 'Planejamento',
  canal text not null default 'Instagram',
  orcamento numeric(10, 2) not null default 0,
  resultado text null,
  inicio date null,
  fim date null,
  arquivo_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketing_redes (
  id uuid primary key default gen_random_uuid(),
  plataforma text not null,
  seguidores integer not null default 0,
  engajamento numeric(5, 2) not null default 0,
  posts_semana integer not null default 0,
  crescimento numeric(5, 2) not null default 0,
  username text null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cronograma_conteudo (
  id uuid primary key default gen_random_uuid(),
  dia text not null,
  tipo text not null default 'Post',
  descricao text not null default '',
  rede text not null default 'Instagram',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text not null default '',
  endereco text not null default '',
  colaborador_responsavel text not null default '',
  valor_mensal numeric not null default 0,
  dados_pagamento text not null default '',
  email text null default '',
  telefone text null default '',
  whatsapp_phone text null,
  onboarding_status text null,
  onboarding_status_at timestamptz null,
  drive_folder_id text null,
  drive_folder_url text null,
  drive_folder_created_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clientes
  add column if not exists cnpj text not null default '',
  add column if not exists endereco text not null default '',
  add column if not exists colaborador_responsavel text not null default '',
  add column if not exists valor_mensal numeric not null default 0,
  add column if not exists dados_pagamento text not null default '',
  add column if not exists email text null default '',
  add column if not exists telefone text null default '',
  add column if not exists whatsapp_phone text null,
  add column if not exists onboarding_status text null,
  add column if not exists onboarding_status_at timestamptz null,
  add column if not exists drive_folder_id text null,
  add column if not exists drive_folder_url text null,
  add column if not exists drive_folder_created_at timestamptz null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clientes_whatsapp_phone_unique'
  ) then
    alter table public.clientes
      add constraint clientes_whatsapp_phone_unique unique (whatsapp_phone);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clientes_drive_folder_id_unique'
  ) then
    alter table public.clientes
      add constraint clientes_drive_folder_id_unique unique (drive_folder_id);
  end if;
end
$$;

create table if not exists public.cliente_servicos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  servico_id uuid not null references public.servicos(id) on delete cascade,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cliente_servicos_cliente_id_servico_id_key'
  ) then
    alter table public.cliente_servicos
      add constraint cliente_servicos_cliente_id_servico_id_key unique (cliente_id, servico_id);
  end if;
end
$$;

create table if not exists public.onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique,
  tracking_token uuid not null default gen_random_uuid() unique,
  cliente_id uuid null references public.clientes(id) on delete set null,
  current_status text not null default 'new',
  status_updated_at timestamptz not null default now(),
  last_message_at timestamptz null,
  last_provider_message_id text null,
  cliente_snapshot jsonb not null default '{}'::jsonb,
  last_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint onboarding_sessions_status_chk
    check (current_status in ('new', 'started', 'in_progress', 'awaiting_client', 'completed', 'failed'))
);

create table if not exists public.onboarding_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.onboarding_sessions(id) on delete cascade,
  provider_message_id text not null unique,
  direction text not null,
  payload jsonb not null,
  event_timestamp timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint onboarding_messages_direction_chk
    check (direction in ('inbound', 'outbound', 'system'))
);

create table if not exists public.onboarding_status_history (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.onboarding_sessions(id) on delete cascade,
  from_status text null,
  to_status text not null,
  reason text null,
  provider_message_id text null,
  changed_at timestamptz not null default now()
);

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

create index if not exists onboarding_sessions_status_idx
  on public.onboarding_sessions (current_status, status_updated_at desc);

create index if not exists onboarding_messages_session_ts_idx
  on public.onboarding_messages (session_id, event_timestamp desc);

create index if not exists onboarding_status_history_session_ts_idx
  on public.onboarding_status_history (session_id, changed_at desc);

create index if not exists operational_items_tipo_status_idx
  on public.operational_items (tipo, status, updated_at desc);

create index if not exists operational_items_cliente_idx
  on public.operational_items (cliente_id, updated_at desc);

drop trigger if exists update_servicos_updated_at on public.servicos;
create trigger update_servicos_updated_at
before update on public.servicos
for each row execute function public.update_updated_at_column();

drop trigger if exists update_comercial_metas_updated_at on public.comercial_metas;
create trigger update_comercial_metas_updated_at
before update on public.comercial_metas
for each row execute function public.update_updated_at_column();

drop trigger if exists update_comercial_oportunidades_updated_at on public.comercial_oportunidades;
create trigger update_comercial_oportunidades_updated_at
before update on public.comercial_oportunidades
for each row execute function public.update_updated_at_column();

drop trigger if exists update_marketing_campanhas_updated_at on public.marketing_campanhas;
create trigger update_marketing_campanhas_updated_at
before update on public.marketing_campanhas
for each row execute function public.update_updated_at_column();

drop trigger if exists update_marketing_redes_updated_at on public.marketing_redes;
create trigger update_marketing_redes_updated_at
before update on public.marketing_redes
for each row execute function public.update_updated_at_column();

drop trigger if exists update_cronograma_updated_at on public.cronograma_conteudo;
create trigger update_cronograma_updated_at
before update on public.cronograma_conteudo
for each row execute function public.update_updated_at_column();

drop trigger if exists update_clientes_updated_at on public.clientes;
create trigger update_clientes_updated_at
before update on public.clientes
for each row execute function public.update_updated_at_column();

drop trigger if exists update_onboarding_sessions_updated_at on public.onboarding_sessions;
create trigger update_onboarding_sessions_updated_at
before update on public.onboarding_sessions
for each row execute function public.update_updated_at_column();

drop trigger if exists update_operational_items_updated_at on public.operational_items;
create trigger update_operational_items_updated_at
before update on public.operational_items
for each row execute function public.update_updated_at_column();

create or replace function public.normalize_phone_e164(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v_digits text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');

  if v_digits = '' then
    return null;
  end if;

  if length(v_digits) in (10, 11) then
    return '+55' || v_digits;
  end if;

  if left(v_digits, 2) = '55' then
    return '+' || v_digits;
  end if;

  return '+' || v_digits;
end;
$$;

create or replace function public.process_whatsapp_onboarding_event(
  p_phone_e164 text,
  p_provider_message_id text,
  p_direction text,
  p_payload jsonb default '{}'::jsonb,
  p_event_timestamp timestamptz default now(),
  p_status text default null,
  p_cliente_data jsonb default '{}'::jsonb
)
returns table (
  session_id uuid,
  cliente_id uuid,
  tracking_token uuid,
  status text,
  status_updated_at timestamptz,
  message_id uuid,
  duplicate boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_now timestamptz;
  v_status text;
  v_prev_status text;
  v_session_id uuid;
  v_existing_session_id uuid;
  v_tracking_token uuid;
  v_cliente_id uuid;
  v_message_id uuid;
begin
  if p_provider_message_id is null or btrim(p_provider_message_id) = '' then
    raise exception 'p_provider_message_id is required';
  end if;

  if p_direction is null or p_direction not in ('inbound', 'outbound', 'system') then
    raise exception 'Invalid direction: %', p_direction;
  end if;

  v_now := coalesce(p_event_timestamp, now());
  v_phone := public.normalize_phone_e164(p_phone_e164);

  if v_phone is null then
    raise exception 'Invalid phone';
  end if;

  select m.session_id
    into v_existing_session_id
  from public.onboarding_messages m
  where m.provider_message_id = p_provider_message_id
  limit 1;

  if v_existing_session_id is not null then
    return query
    select
      s.id,
      s.cliente_id,
      s.tracking_token,
      s.current_status,
      s.status_updated_at,
      null::uuid,
      true
    from public.onboarding_sessions s
    where s.id = v_existing_session_id;
    return;
  end if;

  v_status := coalesce(
    nullif(p_status, ''),
    case
      when p_direction = 'inbound' then 'in_progress'
      when p_direction = 'outbound' then 'awaiting_client'
      else 'in_progress'
    end
  );

  if v_status not in ('new', 'started', 'in_progress', 'awaiting_client', 'completed', 'failed') then
    raise exception 'Invalid status: %', v_status;
  end if;

  select s.current_status, s.cliente_id
    into v_prev_status, v_cliente_id
  from public.onboarding_sessions s
  where s.phone_e164 = v_phone
  for update;

  if p_cliente_data is not null and p_cliente_data <> '{}'::jsonb then
    insert into public.clientes (
      nome,
      email,
      telefone,
      whatsapp_phone,
      onboarding_status,
      onboarding_status_at
    )
    values (
      coalesce(nullif(p_cliente_data->>'nome', ''), 'Lead ' || v_phone),
      nullif(p_cliente_data->>'email', ''),
      coalesce(nullif(p_cliente_data->>'telefone', ''), v_phone),
      v_phone,
      v_status,
      v_now
    )
    on conflict (whatsapp_phone) do update
      set nome = coalesce(nullif(excluded.nome, ''), public.clientes.nome),
          email = coalesce(excluded.email, public.clientes.email),
          telefone = coalesce(excluded.telefone, public.clientes.telefone),
          onboarding_status = excluded.onboarding_status,
          onboarding_status_at = excluded.onboarding_status_at,
          updated_at = now()
    returning id into v_cliente_id;
  elsif v_cliente_id is not null then
    update public.clientes
       set onboarding_status = v_status,
           onboarding_status_at = v_now,
           updated_at = now()
     where id = v_cliente_id;
  end if;

  insert into public.onboarding_sessions (
    phone_e164,
    cliente_id,
    current_status,
    status_updated_at,
    last_message_at,
    last_provider_message_id,
    cliente_snapshot,
    last_payload
  )
  values (
    v_phone,
    v_cliente_id,
    v_status,
    v_now,
    v_now,
    p_provider_message_id,
    coalesce(p_cliente_data, '{}'::jsonb),
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (phone_e164) do update
    set cliente_id = coalesce(excluded.cliente_id, onboarding_sessions.cliente_id),
        current_status = excluded.current_status,
        status_updated_at = excluded.status_updated_at,
        last_message_at = excluded.last_message_at,
        last_provider_message_id = excluded.last_provider_message_id,
        cliente_snapshot = onboarding_sessions.cliente_snapshot || excluded.cliente_snapshot,
        last_payload = excluded.last_payload,
        updated_at = now()
  returning onboarding_sessions.id,
            onboarding_sessions.tracking_token,
            onboarding_sessions.current_status,
            onboarding_sessions.status_updated_at,
            onboarding_sessions.cliente_id
    into v_session_id, v_tracking_token, v_status, v_now, v_cliente_id;

  insert into public.onboarding_messages (
    session_id,
    provider_message_id,
    direction,
    payload,
    event_timestamp
  )
  values (
    v_session_id,
    p_provider_message_id,
    p_direction,
    coalesce(p_payload, '{}'::jsonb),
    coalesce(p_event_timestamp, now())
  )
  on conflict (provider_message_id) do nothing
  returning id into v_message_id;

  if v_message_id is null then
    return query
    select
      s.id,
      s.cliente_id,
      s.tracking_token,
      s.current_status,
      s.status_updated_at,
      null::uuid,
      true
    from public.onboarding_sessions s
    where s.id = v_session_id;
    return;
  end if;

  if v_prev_status is distinct from v_status then
    insert into public.onboarding_status_history (
      session_id,
      from_status,
      to_status,
      reason,
      provider_message_id,
      changed_at
    )
    values (
      v_session_id,
      v_prev_status,
      v_status,
      'event_received',
      p_provider_message_id,
      coalesce(p_event_timestamp, now())
    );
  end if;

  return query
  select
    s.id,
    s.cliente_id,
    s.tracking_token,
    s.current_status,
    s.status_updated_at,
    v_message_id,
    false
  from public.onboarding_sessions s
  where s.id = v_session_id;
end;
$$;

insert into public.clientes (nome)
select seed.nome
from (
  values
    ('Real Conceito'),
    ('Juliana Meias'),
    ('Capato Odonto'),
    ('Nanda Nates'),
    ('Ana Julia'),
    ('Dra Ludmila'),
    ('Clinica Montans'),
    ('Dentista do povo'),
    ('Nutri Marilia'),
    ('Essencial Fit'),
    ('Katia Duarte'),
    ('Thaisa Medica'),
    ('Corpore - Carolina'),
    ('Alma Restaurante'),
    ('Marfim pratas'),
    ('Larissa Giachero'),
    ('Marcos Coentro'),
    ('DaviAgro'),
    ('Coocaam'),
    ('Lais Psico'),
    ('Uai cafe'),
    ('Dra Viviane'),
    ('Ultrapopular'),
    ('Caixinha de surpresa'),
    ('Juliana corretora'),
    ('Luzie'),
    ('Pecas catalogo fotografia Luzie'),
    ('Pecas catalogo fotografia Marfim'),
    ('Dra Giovana Oliveira'),
    ('Dr Matheus'),
    ('Juliana Carnevale')
) as seed(nome)
where not exists (
  select 1 from public.clientes c where lower(c.nome) = lower(seed.nome)
);

commit;
