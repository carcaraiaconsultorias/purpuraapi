

# Carcará – Agente de Negócios

Um webapp SaaS completo para o empresário brasileiro, focado em vendas e marketing (online e presencial), com agente de IA integrado.

---

## Identidade Visual

- **Cores principais**: Preto (backgrounds), Verde (botões e destaques), Cinza (fundos secundários)
- **Logo completo (imagologo)**: No header/navbar
- **Ícone do Carcará**: Favicon e botão do agente flutuante
- **Tema**: Toggle entre modo claro e escuro

---

## Estrutura do App

### 1. Tela de Login
- Campos de e-mail e senha
- Usuários de teste exibidos na tela:
  - `fernanda@carcara.ai` / `TesT123!`
  - `caue@carcara.ai` / `Teste123!`
- Link "Esqueci minha senha" (apenas visual)
- Após login, redireciona para a Aba Resumo

### 2. Layout Principal
- **Sidebar esquerda** com as 7 abas navegáveis
- **Header superior** com:
  - Logo Carcará (imagologo)
  - Nome da empresa e usuário logado
  - Botão "Cadastrar Informação" para upload de PDF/texto
- **Botão flutuante do Agente** (canto inferior direito, visível em todas as telas)

---

## Funcionalidade Global: Agente de Negócios Flutuante

- Botão circular verde com ícone do Carcará
- Abre painel de chat lateral com:
  - Histórico de mensagens
  - Campo de texto para perguntas
  - Sugestões de perguntas contextuais
- Respostas simuladas que "entendem" os dados da tela atual
- Estilo: fundo azul escuro, balões do usuário em verde, balões do agente em cinza

---

## Funcionalidade Global: Upload de Informações

- Modal com opção de upload de PDF ou texto livre
- Após envio, exibe confirmação e simula que o conteúdo alimenta o dashboard
- Card na aba Resumo mostrando "Novo material cadastrado: [nome do arquivo]"

---

## As 7 Abas

### Aba 1 – Resumo
- KPIs principais: Faturamento x Meta, Negócios fechados, Conversão, Ticket médio
- Destaques do dia com insights automáticos
- Ações sugeridas para hoje (bullets práticos)
- Texto explicativo sobre análises diárias/semanais/mensais

### Aba 2 – Agente de Negócios
- Interface de chat expandida (principal)
- Painel lateral com KPIs-chave
- Mensagens de exemplo simulando consultoria de IA

### Aba 3 – Comercial
- Metas por vendedor, produto e canal (online/presencial)
- Funil de vendas visual (Lead → Qualificado → Proposta → Fechado)
- Lista de oportunidades estagnadas
- **Ícone "Educação/Playbook"** que abre modal com manual e playbook de vendas

### Aba 4 – Marketing
- **Redes Sociais**: Cards de TikTok, Instagram, Facebook, YouTube com seguidores e engajamento
- Ao clicar, modal com posts principais de cada rede
- Segmentos de clientes (inativos, top 20%, etc.)
- Campanhas com status e canais
- Cronograma de conteúdo em calendário (semana/mês)

### Aba 5 – Produtos
- Tabela de produtos (nome, categoria, preço, status, vendas)
- Seções "Em alta" e "Em queda" com tags coloridas
- Filtro por categoria

### Aba 6 – Painel do Cliente
- Dados da empresa (nome, segmento, tamanho)
- Checklist de onboarding
- Histórico de sessões de consultoria/suporte
- **Bloco informativo sobre Cauê Magnani** (parceiro de marketing, experiência em Kings, Braé, Cacau Show, Chilli Beans)

### Aba 7 – Marketplace de Agentes

**3 produtos com fluxo de compra:**

1. **Secretaria 24h** (Setup R$ 1.800 / Mensal R$ 1.800)
   - Wizard de 4 passos: dados da empresa, tipo de atendimento, canais, tom de voz
   - Botão final abre WhatsApp (13998086401)

2. **Agente Personalizado** (Sob consulta)
   - Formulário: dados básicos, objetivo, sistemas usados, tipo de fluxo
   - Botão "Solicitar proposta no WhatsApp"

3. **Agente Criador de Conteúdo** (Setup R$ 1.200 / Mensal R$ 1.200)
   - Formulário: redes sociais, frequência, tipo de conteúdo, público-alvo
   - Botão final abre WhatsApp

---

## Dados e UX

- Todos os dados serão fictícios e realistas
- Linguagem 100% em português brasileiro
- Tom direto, amigável e focado em ação
- App navegável com cara de produto pronto

