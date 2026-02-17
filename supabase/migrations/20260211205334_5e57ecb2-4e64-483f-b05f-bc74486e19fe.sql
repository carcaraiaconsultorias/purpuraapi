
-- Tabela de clientes
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All can read clientes" ON public.clientes FOR SELECT USING (true);
CREATE POLICY "All can insert clientes" ON public.clientes FOR INSERT WITH CHECK (true);
CREATE POLICY "All can update clientes" ON public.clientes FOR UPDATE USING (true);
CREATE POLICY "All can delete clientes" ON public.clientes FOR DELETE USING (true);

-- Tabela de vínculo cliente <-> serviço
CREATE TABLE public.cliente_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  servico_id uuid NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, servico_id)
);

ALTER TABLE public.cliente_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All can read cliente_servicos" ON public.cliente_servicos FOR SELECT USING (true);
CREATE POLICY "All can insert cliente_servicos" ON public.cliente_servicos FOR INSERT WITH CHECK (true);
CREATE POLICY "All can update cliente_servicos" ON public.cliente_servicos FOR UPDATE USING (true);
CREATE POLICY "All can delete cliente_servicos" ON public.cliente_servicos FOR DELETE USING (true);

-- Trigger de updated_at para clientes
CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed dos clientes
INSERT INTO public.clientes (nome) VALUES
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
  ('Uai café'),
  ('Dra Viviane'),
  ('Ultrapopular'),
  ('Caixinha de surpresa'),
  ('Juliana corretora'),
  ('Luzie'),
  ('Peças catalogo fotografia Luzie'),
  ('Peças catalogo fotografia Marfim'),
  ('Dra Giovana Oliveira'),
  ('Dr Matheus'),
  ('Juliana Carnevale');
