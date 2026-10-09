# Plano — aba MARKETING do M1 (rascunho de 09/10/2026, aguardando decisões do Arthur)

## O que é
Um grupo do menu esquerdo (toggle "Marketing", como Atendimento/CRM) + um **painelzão** (`/app/marketing`) que mostra, de forma bonita, todo o trabalho de marketing que a agência faz para CADA cliente. É conteúdo ESTÁTICO e apresentável: a agência (Arthur e equipe) cria e edita; o cliente (papel `viewer` na empresa dele) só vê, publicado, num visual de "apresentação chique".

## Menu
Marketing ▾
- Visão geral (o painelzão)
- Estratégia ▾ — Diagnóstico · Produto e Oferta (as duas fases do método; ver "A decidir" #1)
- Produtos e ofertas
- Cronograma (tarefas da semana: agência e cliente)
- Geração de demanda — Campanhas, Criativos
- Dashboards — Tráfego, Vendas, Faturamento
(Outbound Marketing / prospecção ativa = aba separada, depois.)

## Referência visual (Notion do Arthur, "Profile do Cliente")
Galeria agrupada por fase, cartões com CAPA grande, ícone, título e etiqueta da fase:
- 01 Diagnóstico: Onboarding · Mapeamento do Funil Atual (Kick Off) · Posicionamento ZMOT · Análise Oculta de Vendas · Identidades da Marca
- 02 Produto e Oferta: Estudo de Persona · Análise de Concorrência · Planejamento Empresarial · Produtos e Ofertas · Lead Magnets
- 03 Geração de Demanda: Estratégia de Marketing · Tráfego Pago · Outbound Marketing · Programas de Indicação · Social Media · Parcerias e Influenciadores
O painelzão do M1 segue essa ideia (galeria por fase), com a cor/logo do CLIENTE (white-label já existe).

## Modelo técnico (uma ideia só, dois visuais)
Cada página de estratégia = lista ordenada de BLOCOS tipados (título, texto, lista de cards, imagem/print, links, antes×depois, tabela, paleta de cores da marca, citação, métricas). Um único conteúdo, dois jeitos de mostrar:
- **Página** (rolagem, como um site) e
- **Apresentar** (tela cheia, slide a slide, setas do teclado/dedo).
Estados: Rascunho → Publicado (o cliente só vê o publicado). Versões e "modelo padrão" copiado para cada cliente novo.
Tabelas novas (todas por organização, com RLS): `marketing_pages` (módulo, título, capa, ícone, status, blocos jsonb, versão), `marketing_assets` (prints/imagens no Storage). Leitura: membros da empresa; escrita: só a agência (platform admin em modo suporte + `manager` da empresa); cliente = `viewer`.

## Fases
0. **Casca (primeiro, ~1 sessão)**: grupo Marketing no menu + submenus + painelzão com cartões bonitos (capas, ícones, "em construção"), páginas de cada item já existentes porém vazias/"em breve". Só front + catálogo de navegação; sem banco.
1. **Motor de páginas**: tabelas, editor de blocos (agência), renderizador Página + Apresentar, publicar/rascunho, modelo padrão por cliente, tema com a marca do cliente. Primeira página real: Diagnóstico › Onboarding.
2. **Estratégia — Diagnóstico**: Onboarding, Mapeamento do funil (kick-off), Posicionamento ZMOT, Análise oculta de vendas, Identidade da marca (com paleta/fontes/logos). Com "antes × depois" (prints do estado atual guardados para comparar depois).
3. **Estratégia — Produto e Oferta**: Persona, Concorrência, Planejamento empresarial, Produtos e ofertas (reaproveita `/app/products`), Lead magnets.
4. **IA como ajudante da agência**: ficha do kick-off (formulário/transcrição) + os prompts do Arthur por módulo → rascunho em blocos → Arthur revisa/edita → publica. Precisa de chave de IA e dos prompts.
5. **Dashboards**: Tráfego (Meta/Google Ads — já há base de plataformas de anúncio e CAPI via n8n), Vendas (CRM/leads), Faturamento (compras/LTV; já existe `/app/faturamento`).
6. **Cronograma** (reaproveita o motor de Tarefas: visão semanal/linha do tempo, dono = agência ou cliente) e **Geração de demanda** (registro de campanhas/criativos/textos com status ativo/pausado, links e resultados).

## A decidir com o Arthur
1. Submenu de Estratégia: seguir o Notion (Diagnóstico + Produto e Oferta) ou a lista "Público-alvo / Estudo de mercado / Análise da concorrência"? (Proposta: o Notion como estrutura e esses três como atalhos: Público-alvo = Persona; Estudo de mercado = ZMOT + análise oculta; Concorrência = Análise de Concorrência.)
2. O cliente também recebe um LINK público (sem login) da apresentação, ou só vê logado?
3. IA: qual provedor/chave e quais prompts (entregar por módulo).
4. Quem é "agência" no banco: platform admin (modo suporte) + manager da empresa — confirmar.
5. PDF/exportar a apresentação? (depois)
