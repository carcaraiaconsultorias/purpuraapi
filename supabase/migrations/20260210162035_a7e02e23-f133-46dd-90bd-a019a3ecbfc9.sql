
-- Drop existing policies and recreate for anon+authenticated access (demo app with fake auth)
DROP POLICY IF EXISTS "Anyone authenticated can read servicos" ON public.servicos;
DROP POLICY IF EXISTS "Anyone authenticated can insert servicos" ON public.servicos;
DROP POLICY IF EXISTS "Anyone authenticated can update servicos" ON public.servicos;
DROP POLICY IF EXISTS "Anyone authenticated can delete servicos" ON public.servicos;

CREATE POLICY "All can read servicos" ON public.servicos FOR SELECT USING (true);
CREATE POLICY "All can insert servicos" ON public.servicos FOR INSERT WITH CHECK (true);
CREATE POLICY "All can update servicos" ON public.servicos FOR UPDATE USING (true);
CREATE POLICY "All can delete servicos" ON public.servicos FOR DELETE USING (true);

DROP POLICY IF EXISTS "Auth read comercial_metas" ON public.comercial_metas;
DROP POLICY IF EXISTS "Auth insert comercial_metas" ON public.comercial_metas;
DROP POLICY IF EXISTS "Auth update comercial_metas" ON public.comercial_metas;
DROP POLICY IF EXISTS "Auth delete comercial_metas" ON public.comercial_metas;

CREATE POLICY "All can read comercial_metas" ON public.comercial_metas FOR SELECT USING (true);
CREATE POLICY "All can insert comercial_metas" ON public.comercial_metas FOR INSERT WITH CHECK (true);
CREATE POLICY "All can update comercial_metas" ON public.comercial_metas FOR UPDATE USING (true);
CREATE POLICY "All can delete comercial_metas" ON public.comercial_metas FOR DELETE USING (true);

DROP POLICY IF EXISTS "Auth read comercial_oportunidades" ON public.comercial_oportunidades;
DROP POLICY IF EXISTS "Auth insert comercial_oportunidades" ON public.comercial_oportunidades;
DROP POLICY IF EXISTS "Auth update comercial_oportunidades" ON public.comercial_oportunidades;
DROP POLICY IF EXISTS "Auth delete comercial_oportunidades" ON public.comercial_oportunidades;

CREATE POLICY "All can read comercial_oportunidades" ON public.comercial_oportunidades FOR SELECT USING (true);
CREATE POLICY "All can insert comercial_oportunidades" ON public.comercial_oportunidades FOR INSERT WITH CHECK (true);
CREATE POLICY "All can update comercial_oportunidades" ON public.comercial_oportunidades FOR UPDATE USING (true);
CREATE POLICY "All can delete comercial_oportunidades" ON public.comercial_oportunidades FOR DELETE USING (true);

DROP POLICY IF EXISTS "Auth read marketing_campanhas" ON public.marketing_campanhas;
DROP POLICY IF EXISTS "Auth insert marketing_campanhas" ON public.marketing_campanhas;
DROP POLICY IF EXISTS "Auth update marketing_campanhas" ON public.marketing_campanhas;
DROP POLICY IF EXISTS "Auth delete marketing_campanhas" ON public.marketing_campanhas;

CREATE POLICY "All can read marketing_campanhas" ON public.marketing_campanhas FOR SELECT USING (true);
CREATE POLICY "All can insert marketing_campanhas" ON public.marketing_campanhas FOR INSERT WITH CHECK (true);
CREATE POLICY "All can update marketing_campanhas" ON public.marketing_campanhas FOR UPDATE USING (true);
CREATE POLICY "All can delete marketing_campanhas" ON public.marketing_campanhas FOR DELETE USING (true);

DROP POLICY IF EXISTS "Auth read marketing_redes" ON public.marketing_redes;
DROP POLICY IF EXISTS "Auth insert marketing_redes" ON public.marketing_redes;
DROP POLICY IF EXISTS "Auth update marketing_redes" ON public.marketing_redes;
DROP POLICY IF EXISTS "Auth delete marketing_redes" ON public.marketing_redes;

CREATE POLICY "All can read marketing_redes" ON public.marketing_redes FOR SELECT USING (true);
CREATE POLICY "All can insert marketing_redes" ON public.marketing_redes FOR INSERT WITH CHECK (true);
CREATE POLICY "All can update marketing_redes" ON public.marketing_redes FOR UPDATE USING (true);
CREATE POLICY "All can delete marketing_redes" ON public.marketing_redes FOR DELETE USING (true);

-- Also fix storage for anon access
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update uploads" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete uploads" ON storage.objects;

CREATE POLICY "All can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'uploads');
CREATE POLICY "All can update uploads" ON storage.objects FOR UPDATE USING (bucket_id = 'uploads');
CREATE POLICY "All can delete uploads" ON storage.objects FOR DELETE USING (bucket_id = 'uploads');
