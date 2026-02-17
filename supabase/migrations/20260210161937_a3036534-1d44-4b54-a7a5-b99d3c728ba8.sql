
-- Storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('uploads', 'uploads', true);

CREATE POLICY "Anyone can view uploads" ON storage.objects FOR SELECT USING (bucket_id = 'uploads');
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'uploads' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update uploads" ON storage.objects FOR UPDATE USING (bucket_id = 'uploads' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete uploads" ON storage.objects FOR DELETE USING (bucket_id = 'uploads' AND auth.role() = 'authenticated');

-- ============ SERVIÇOS ============
CREATE TABLE public.servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  preco DECIMAL(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Ativo',
  contratos INTEGER NOT NULL DEFAULT 0,
  tendencia TEXT NOT NULL DEFAULT 'stable',
  descricao TEXT,
  arquivo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read servicos" ON public.servicos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone authenticated can insert servicos" ON public.servicos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anyone authenticated can update servicos" ON public.servicos FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anyone authenticated can delete servicos" ON public.servicos FOR DELETE TO authenticated USING (true);

-- ============ COMERCIAL - METAS ============
CREATE TABLE public.comercial_metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor TEXT NOT NULL,
  meta DECIMAL(10,2) NOT NULL DEFAULT 0,
  realizado DECIMAL(10,2) NOT NULL DEFAULT 0,
  canal TEXT NOT NULL DEFAULT 'Online',
  periodo TEXT NOT NULL DEFAULT 'Mensal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comercial_metas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read comercial_metas" ON public.comercial_metas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert comercial_metas" ON public.comercial_metas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update comercial_metas" ON public.comercial_metas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete comercial_metas" ON public.comercial_metas FOR DELETE TO authenticated USING (true);

-- ============ COMERCIAL - OPORTUNIDADES ============
CREATE TABLE public.comercial_oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL DEFAULT 0,
  etapa TEXT NOT NULL DEFAULT 'Lead',
  responsavel TEXT,
  dias_parado INTEGER NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comercial_oportunidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read comercial_oportunidades" ON public.comercial_oportunidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert comercial_oportunidades" ON public.comercial_oportunidades FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update comercial_oportunidades" ON public.comercial_oportunidades FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete comercial_oportunidades" ON public.comercial_oportunidades FOR DELETE TO authenticated USING (true);

-- ============ MARKETING - CAMPANHAS ============
CREATE TABLE public.marketing_campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Planejamento',
  canal TEXT NOT NULL DEFAULT 'Instagram',
  orcamento DECIMAL(10,2) NOT NULL DEFAULT 0,
  resultado TEXT,
  inicio DATE,
  fim DATE,
  arquivo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_campanhas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read marketing_campanhas" ON public.marketing_campanhas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert marketing_campanhas" ON public.marketing_campanhas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update marketing_campanhas" ON public.marketing_campanhas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete marketing_campanhas" ON public.marketing_campanhas FOR DELETE TO authenticated USING (true);

-- ============ MARKETING - REDES SOCIAIS ============
CREATE TABLE public.marketing_redes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma TEXT NOT NULL,
  seguidores INTEGER NOT NULL DEFAULT 0,
  engajamento DECIMAL(5,2) NOT NULL DEFAULT 0,
  posts_semana INTEGER NOT NULL DEFAULT 0,
  crescimento DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_redes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read marketing_redes" ON public.marketing_redes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert marketing_redes" ON public.marketing_redes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update marketing_redes" ON public.marketing_redes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete marketing_redes" ON public.marketing_redes FOR DELETE TO authenticated USING (true);

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_servicos_updated_at BEFORE UPDATE ON public.servicos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_comercial_metas_updated_at BEFORE UPDATE ON public.comercial_metas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_comercial_oportunidades_updated_at BEFORE UPDATE ON public.comercial_oportunidades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marketing_campanhas_updated_at BEFORE UPDATE ON public.marketing_campanhas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marketing_redes_updated_at BEFORE UPDATE ON public.marketing_redes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
