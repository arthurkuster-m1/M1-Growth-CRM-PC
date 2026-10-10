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

## Decisões já tomadas (Arthur, 09/10/2026)
- Seguir exatamente este plano e a ordem das fases (começando pela Fase 0, a casca).
- **O cliente pode receber um LINK sem login.** Desenho (Fase 1): tabela `marketing_share_links` (token aleatório longo, empresa, escopo = o painel inteiro ou uma página, validade opcional, revogado); rota pública `/p/<token>` mostrando só o conteúdo PUBLICADO, somente leitura, com `noindex`, limite de acessos por IP e a marca/cores do cliente; a agência gera, copia, regenera e revoga o link na própria página. Sem edição, sem menu do sistema, sem dados de outras áreas. (Depois, se quiser: senha opcional e validade padrão.)
- Submenu de Estratégia: segue o Notion (Diagnóstico + Produto e Oferta); "Público-alvo / Estudo de mercado / Análise da concorrência" viram atalhos.

## A decidir com o Arthur (o que ainda falta)
1. Submenu de Estratégia: seguir o Notion (Diagnóstico + Produto e Oferta) ou a lista "Público-alvo / Estudo de mercado / Análise da concorrência"? (Proposta: o Notion como estrutura e esses três como atalhos: Público-alvo = Persona; Estudo de mercado = ZMOT + análise oculta; Concorrência = Análise de Concorrência.)
2. (resolvido) link público sem login — ver acima.
3. IA: qual provedor/chave e quais prompts (entregar por módulo).
4. Quem é "agência" no banco: platform admin (modo suporte) + manager da empresa — confirmar.
5. PDF/exportar a apresentação? (depois)


## Atualização 10/10/2026 — Fase 2 (Diagnóstico) e imagens

- **Imagens** (migration 0588, bucket privado `marketing-images`): blocos "Imagem" e "Imagem com texto", imagem nos dois lados do "Antes e depois", alinhamento em título/texto/citação. Link público serve a imagem por `/p/<token>/img/<arquivo>`.
- **Decisão do Arthur:** o **Onboarding** (passos internos da agência) e a **Análise oculta de vendas** (virá da análise do Inbox) saem do sistema. O Diagnóstico passa a ter **3 páginas**: **Mapeamento do Funil Atual** (kick-off + resumo do funil, processo de vendas atual, SWOT, oportunidades, alvo), **Posicionamento** (links e imagens de todos os canais online) e **Branding** (fundamentos, logo, cores, tipografia, elementos visuais, tom de voz, framework Why/How/What — modelo baseado no manual de identidade M1).
- Modelos de página por módulo em `lib/marketing/modelos.ts` ("Começar com um modelo"). Próximo: Fase 3 (Produto e Oferta), módulo a módulo, com os exports do Notion do Arthur.
- Ideia futura: tema escuro/"futurista" opcional para a apresentação.
