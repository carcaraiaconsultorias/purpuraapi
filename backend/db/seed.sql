begin;

insert into public.servicos (nome, categoria, preco, status, contratos, tendencia, descricao, arquivo_url)
select seed.nome, seed.categoria, seed.preco, seed.status, seed.contratos, seed.tendencia, seed.descricao, seed.arquivo_url
from (
  values
    ('Social Media Mensal', 'Social Media', 2500::numeric, 'Ativo', 18, 'up', null::text, null::text),
    ('Social Media + Audiovisual', 'Social Media', 4500::numeric, 'Ativo', 12, 'up', null::text, null::text),
    ('Consultoria de Marketing', 'Consultoria', 3000::numeric, 'Ativo', 9, 'up', null::text, null::text),
    ('Gestao de Trafego Pago', 'Trafego', 1800::numeric, 'Ativo', 15, 'up', null::text, null::text),
    ('Producao Audiovisual Avulsa', 'Audiovisual', 3500::numeric, 'Ativo', 7, 'stable', null::text, null::text),
    ('Branding Completo', 'Consultoria', 8000::numeric, 'Ativo', 4, 'stable', null::text, null::text)
) as seed(nome, categoria, preco, status, contratos, tendencia, descricao, arquivo_url)
where not exists (
  select 1 from public.servicos s where lower(s.nome) = lower(seed.nome)
);

insert into public.comercial_metas (vendedor, meta, realizado, canal, periodo)
select seed.vendedor, seed.meta, seed.realizado, seed.canal, seed.periodo
from (
  values
    ('Ana Paula', 50000::numeric, 42500::numeric, 'Online', 'Mensal'),
    ('Carlos Silva', 45000::numeric, 38700::numeric, 'Presencial', 'Mensal'),
    ('Mariana Costa', 35000::numeric, 28000::numeric, 'Online', 'Mensal'),
    ('Joao Pedro', 30000::numeric, 31200::numeric, 'Presencial', 'Mensal')
) as seed(vendedor, meta, realizado, canal, periodo)
where not exists (
  select 1
  from public.comercial_metas m
  where lower(m.vendedor) = lower(seed.vendedor)
    and lower(m.canal) = lower(seed.canal)
    and lower(m.periodo) = lower(seed.periodo)
);

insert into public.comercial_oportunidades (cliente, valor, etapa, responsavel, dias_parado, observacao)
select seed.cliente, seed.valor, seed.etapa, seed.responsavel, seed.dias_parado, seed.observacao
from (
  values
    ('Tech Solutions Ltda', 15000::numeric, 'Proposta', 'Ana Paula', 22, null::text),
    ('Varejo Express', 8500::numeric, 'Qualificado', 'Carlos Silva', 18, null::text),
    ('Industria ABC', 25000::numeric, 'Proposta', 'Mariana Costa', 15, null::text)
) as seed(cliente, valor, etapa, responsavel, dias_parado, observacao)
where not exists (
  select 1
  from public.comercial_oportunidades o
  where lower(o.cliente) = lower(seed.cliente)
    and lower(o.etapa) = lower(seed.etapa)
);

insert into public.marketing_redes (plataforma, seguidores, engajamento, posts_semana, crescimento, username)
select seed.plataforma, seed.seguidores, seed.engajamento, seed.posts_semana, seed.crescimento, seed.username
from (
  values
    ('TikTok', 45200, 8.4::numeric, 5, 12.5::numeric, ''),
    ('Instagram', 32800, 4.2::numeric, 7, 8.3::numeric, ''),
    ('Facebook', 18500, 2.1::numeric, 3, 1.2::numeric, ''),
    ('YouTube', 8900, 6.8::numeric, 2, 15.1::numeric, '')
) as seed(plataforma, seguidores, engajamento, posts_semana, crescimento, username)
where not exists (
  select 1
  from public.marketing_redes r
  where lower(r.plataforma) = lower(seed.plataforma)
    and coalesce(lower(r.username), '') = coalesce(lower(seed.username), '')
);

insert into public.cronograma_conteudo (dia, tipo, descricao, rede)
select seed.dia, seed.tipo, seed.descricao, seed.rede
from (
  values
    ('Seg 03', 'Story', 'Produto em destaque', 'Instagram'),
    ('Ter 04', 'Post', 'Depoimento cliente', 'Facebook'),
    ('Qua 05', 'Video', 'Bastidores producao', 'TikTok'),
    ('Qui 06', 'Live', 'Q&A com especialista', 'Instagram'),
    ('Sex 07', 'Reels', 'Dica de estilo', 'Instagram'),
    ('Sab 08', 'Story', 'Promo fim de semana', 'Instagram'),
    ('Dom 09', 'Post', 'Inspiracao domingo', 'TikTok')
) as seed(dia, tipo, descricao, rede)
where not exists (
  select 1
  from public.cronograma_conteudo c
  where lower(c.dia) = lower(seed.dia)
    and lower(c.tipo) = lower(seed.tipo)
    and lower(c.descricao) = lower(seed.descricao)
    and lower(c.rede) = lower(seed.rede)
);

commit;
