
-- Cronograma de conteúdo table
CREATE TABLE public.cronograma_conteudo (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dia text NOT NULL,
  tipo text NOT NULL DEFAULT 'Post',
  descricao text NOT NULL DEFAULT '',
  rede text NOT NULL DEFAULT 'Instagram',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cronograma_conteudo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All can read cronograma" ON public.cronograma_conteudo FOR SELECT USING (true);
CREATE POLICY "All can insert cronograma" ON public.cronograma_conteudo FOR INSERT WITH CHECK (true);
CREATE POLICY "All can update cronograma" ON public.cronograma_conteudo FOR UPDATE USING (true);
CREATE POLICY "All can delete cronograma" ON public.cronograma_conteudo FOR DELETE USING (true);

CREATE TRIGGER update_cronograma_updated_at
BEFORE UPDATE ON public.cronograma_conteudo
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add username column to marketing_redes
ALTER TABLE public.marketing_redes ADD COLUMN username text DEFAULT '';
