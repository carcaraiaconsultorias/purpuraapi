
ALTER TABLE public.clientes
ADD COLUMN cnpj text DEFAULT '',
ADD COLUMN endereco text DEFAULT '',
ADD COLUMN colaborador_responsavel text DEFAULT '',
ADD COLUMN valor_mensal numeric DEFAULT 0,
ADD COLUMN dados_pagamento text DEFAULT '',
ADD COLUMN email text DEFAULT '',
ADD COLUMN telefone text DEFAULT '';
