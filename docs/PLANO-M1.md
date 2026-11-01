# PLANO DO M1 GROWTH CRM

Atualizado em 01/11/2026 (a base é de 17/10; as seções de 27/10 a 01/11 e as frentes 16 a 21 são novas; a §3-bis tem as frentes novas e atualizadas). Este é o plano-mãe. O plano detalhado da aba Marketing continua em
`docs/PLANO-MARKETING-M1.md` (histórico). Os itens abaixo não precisam seguir a ordem: vamos
trabalhando em cima, conforme a prioridade do Arthur.

## 1. HISTÓRICO — o que já foi feito

### Tarefas
- Tabela estilo Notion (propriedades, filtros, agrupamento, ordenação, edição em massa), quadro,
  visualizações salvas e compartilhadas, modelos de tarefa e tarefas repetidas, data estilo Notion.
- Ligada ao Início; tela antiga de tarefas do CRM removida.

### Infraestrutura e acesso
- App no ar em https://www.infra-assessoria-m1.cloud (Caddy → Next.js, serviço `m1-app`).
- **Deploy pelo GitHub:** `git push` → build no GitHub (~2 min) → a VPS puxa e ativa (~20 s), com
  volta automática. Workflows e testes herdados do projeto original removidos.
- WhatsApp (WAHA + Redis) preparado em Docker; Google Agenda ligada (OAuth).
- Login com Google ligado; e-mails de acesso em português (modelos do próprio app), enviados pelo
  Brevo com o domínio próprio; confirmação de e-mail religada.
- PWA com ícone próprio.

### Marketing (aba completa)
- Painel (hub) e menu: Início, Tarefas, Marketing, Atendimento.
- Motor de páginas: blocos (título, texto, lista, cartões, números, antes/depois, paleta, links,
  citação, imagem, imagem+texto, pirâmide/funil, fluxo, matriz SWOT, ficha, tabela, calculadora da
  meta, oferta), modo Página e Apresentar, rascunho/publicado, histórico manual, publicação em
  massa, link sem login com navegação, "ver como cliente", abre em "Ver página" quando publicada.
- Diagnóstico: Mapeamento do funil, Posicionamento, Branding.
- Produto e oferta: Estudo de persona (5 subpáginas), Análise de concorrência (modelo enxuto +
  5 concorrentes), Planejamento empresarial (enxuto, com calculadora).
- **Produtos e ofertas = única fonte de produto e preço da IA.** Oferta publicada vira produto no
  catálogo que a IA consulta; imagens/cartão-resumo enviados junto; escada de valor manual +
  automática. Tela antiga de catálogo removida.
- Prompts do método salvos em `docs/metodo-m1-referencia/`.
- **Cronograma do cliente** (frente 2, no ar): metas com tipo (R$, quantidade com unidade, %) e
  barra de progresso; fases em seta com várias ações-chave dentro; gráfico em janela de semanas
  que anda para sempre (setas ou arrastando), com arquivar concluídas; tarefas da semana
  (agência × cliente) vindas da base de Tarefas; histórico com o motivo dos adiamentos; fechar a
  semana; imagem baixável e link sem login nos temas claro e escuro (usa os tokens do app);
  semana começa no domingo; seletor de data em português. Coluna "Cronograma" na tela de
  Tarefas (gestão) e card na galeria pública: feitos.
- **Produtos e serviços em escala:** busca; tabela com o motor das Tarefas (filtros, ordem,
  agrupamento, colunas, abas salvas); filtros também nos cartões; seleção e edição em massa;
  edição direto na linha (vale ao vivo, inclusive para a IA); importação por planilha CSV com
  modelo para baixar e prévia; botão "Novo produto".
- **Páginas legais e Google:** página inicial pública, `/politica-de-privacidade` e
  `/termos-de-uso` abertos sem login, com operador, CNPJ e contato. Falta o Arthur verificar o
  domínio no Search Console (registro TXT no Cloudflare) e reenviar o app.
- **CRM — sessões 1 e 2 (no ar):** lead único (1 contato = 1 lead, MQL, 1ª abordagem, tag do
  funil), funis criados em Geração de demanda com "ao ganhar entra no funil" e a página Clientes
  (Tabela/Kanban, aba "Todos", funil por linha, Primeira compra). Detalhes em
  `docs/PLANO-CRM-M1.md`.
- **Campanhas de demanda — C1 (no ar):** cadastro, Tabela/Cards/Linha do tempo, página da
  campanha com diário de bordo. Detalhes em `docs/PLANO-CAMPANHAS-M1.md`.
- **Redução do Log Ingestion do Supabase** (feito no código): login conferido localmente
  (`getClaims`, sem ir ao Supabase a cada requisição), memória de 20 s para permissões e contexto
  de suporte, polling do Inbox espaçado. Conferir o consumo depois de alguns dias.

### CRM, Vendas e Campanhas (11 a 13/10/2026)
Detalhe sessão a sessão em `docs/PLANO-CRM-M1.md`.
- **Lead único e funis** que pertencem à campanha; página Clientes (tabela e quadro) com Novo lead e
  Importar leads (CSV, planilha, tabela colada).
- **Venda é o card do funil**: produtos do catálogo, parcelas, status, nome, responsável, origem.
- **Ficha do lead** em abas (Visão geral, Cadastro, Atendimento e Tarefas, Vendas, Funis,
  Anotações, Linha do Tempo, LGPD), com registrar ação e aviso de "sair sem salvar".
- **Origem num só modelo** (fonte + campanha → conjunto → anúncio → LP → posicionamento); card e
  venda sempre com a mesma origem; card novo herda a origem do lead.
- **Métricas do CRM** somadas das vendas: faturamento recebido, valor em aberto, LTV atual/previsto,
  em interesse, taxa de conversão; vendas e faturamento por anúncio e LP só com valor já pago.
- **Campanhas**: criativos do Meta com todas as variações de texto e mídia (imagens comprimidas),
  dia a dia automático, seletor de período nas telas.

### Tarefas, Cronograma e Marketing (13 e 14/10/2026)
- **Tarefas**: propriedade **Cliente** (lead do CRM ou "Interno · empresa"), filtro por cliente,
  caixa de texto grande (tipo Notion) para título, descrição e texto, quadro mais fluido e sem
  arrastar ao selecionar texto, seletor de cliente que rola e trava a tela no celular.
- **Ficha do lead**: tarefas do lead com o motor completo (propriedades, ordem, filtros, status,
  prazos) em Atendimento e Tarefas; clicar numa tarefa da Visão geral abre para editar.
- **Cronograma**: lado "cliente" com o nome da empresa; CPL com leitura invertida (menor é
  melhor); incluir tarefa existente na semana escolhendo início e prazo; aba **Adiadas** (quantas
  vezes e por quê, por período, só agência); ações-chave por data (seletor de período, semana
  calculada; fim no domingo conta a semana seguinte); reordenar fases e ações; edição colorida;
  prazo das metas (diário a anual e datas personalizadas, migration 0628) e vendas das metas só
  com algo pago.
- **Marketing**: edição de blocos colorida por tipo, subtítulo em slide próprio na apresentação,
  "Apagar subpágina" em vermelho no topo e modo claro/escuro no link público.

### CRM, Dashboards e Agenda (14 a 16/10/2026)
Detalhe em `MODELO-CRM-M1.md`, `PLANO-OPORTUNIDADE-UNICA-M1.md`, `MODELO-AGENDA-M1.md` e `PLANO-DASHBOARDS-M1.md`.
- **Dashboards D0 a D3 no ar** (Tráfego Pago, Business, Atendimento ao vivo; Prospecção Ativa "Em breve").
  Horário de atendimento da empresa em `organizations.settings.horario_de_atendimento`.
- **Modelo do CRM (migrations 0630 a 0637):** Cliente (pessoa, ciclo de vida calculado) × Oportunidade
  (`crm_leads`) × Pagamento (parcela). Etapas fixas Comprou / Não comprou / Desqualificado; Comprou exige
  pagamento recebido; várias oportunidades por pessoa; `crm_sales` e os espelhos removidos.
- **Página CRM** (Clientes, Oportunidades, Vendas): visualizações com dono e "arquivar para mim"; Oportunidades
  em tabela estilo Notion e quadro; painel único da oportunidade (Próxima ação com confirmação de data);
  linha do tempo completa; atribuição pelo funil da oportunidade (0641); dinheiro recebido não some ao
  cancelar (0642); formas de pagamento com taxas e custo variável no Business (0643).
- **Lixeira de 7 dias** (0639, 0644 a 0646): excluir leva tudo junto, restaurar mescla com o cadastro novo.
- **Ida e volta do pagamento** (0647): desmarcar a parcela devolve a etapa de antes do Comprou.
- **Prospecção, etapas 1 a 4:** resultado rápido da ligação, tentativas, Ligar hoje, Modo prospecção,
  WhatsApp com mensagem pronta, melhor horário, engrenagem de configuração.
- **Campanhas:** Dia a dia com colunas escolhíveis, ordenar, arrastar e total; Resultados; Funil completo
  com Venda e Reunião; MQL e taxa de desqualificação por criativo.
- **Agenda (frente 10):** rotinas passaram a rodar na VPS (`/etc/cron.d/m1-rotinas`; backlog de 85 eventos
  descartado); compromisso ligado à oportunidade; compromissos na oportunidade e na ficha; importação do
  Google (calendário Assessoria M1); análises; anti no-show com resposta do cliente (0648). Google → app
  validado pelo Arthur em 16/10 (agendamento do app apareceu no Google).
- Migrations aplicadas até a **0648**.

### Agenda, página do compromisso e equipe (16 e 17/10/2026)
Detalhe em `MODELO-AGENDA-M1.md` e `PLANO-AGENDA-EQUIPE-M1.md`.
- **Google:** botão "Sincronizar com Google" no topo da Agenda (ida e volta na hora, só da empresa); rotinas do Google a cada 10 minutos; cartão "Conexão com Google" no fim da página.
- **Página única do compromisso** (popup central, a mesma de qualquer entrada): cliente, telefone, e-mail, link da reunião, status, oportunidade com venda e parcelas editáveis, atendimento que muda com o tipo (modelo de vendas com roteiro, anotações e espaço para a IA ao vivo, "em breve"). Botões Confirmado, Resultado (No show / Compareceu e não comprou / Compareceu e comprou) e Excluir; aviso quando a reunião termina (hoje só com a Agenda aberta).
- **"Novo agendamento" em qualquer tela** (Agenda, grade, ficha, oportunidade, Inbox, Início) abre a mesma página, pedindo cliente, oportunidade, tipo, data/horário e responsável. Responsável sugerido: o da oportunidade; sem ele, o do relacionamento com o cliente; trocar na reunião não muda o CRM nem a oportunidade. Reagendar, trocar oportunidade e trocar responsável em qualquer visualização.
- **Seletor só com horários livres** do atendente escolhido (dias sem vaga desligados).
- **Configuração da Agenda no fim da página** (tipos e regras, atendentes e horários, agendas do Google).
- **Visual:** abas com pasta, cantos arredondados, celular sem rolagem lateral. **Início:** a visão Dia/Semana do calendário fica salva neste navegador.
- **Nome do cliente numa regra só** em todo o app (o nome digitado vale primeiro; depois o apelido do WhatsApp).
- **Qualidade:** suíte de testes triada (falhas antigas do espanhol removido seguem fora do escopo); rotinas ignoram empresa suspensa; rotas de gravação sem guarda de suporte corrigidas; popover sem erro em ambiente de teste.
- **Configuração da Agenda reorganizada (17/10):** um bloco grande que abre ao clicar, com 3 páginas: Regras da agenda (Google, presença, clientes pela agenda, colegas e dias fora da rotina, cada uma num bloco que abre), Tipos de atendimento (com a **página de atendimento de cada tipo**: modelo, blocos que aparecem e roteiro editável em `organizations.settings.atendimento_por_tipo`) e Atendentes e horários (matriz pessoas × tipos, **Adicionar atendente** que convida por e-mail, horários). Painel antigo de marcação removido da Agenda.
- **Corrigido (17/10):** a página de Campanhas quebrava depois de um commit de outra sessão (função de cliente chamada no servidor); `comVoltar` foi para `lib/navigation/voltar.ts`.
- **Equipe da Agenda (decisões fechadas em 17/10):** vários atendentes por tipo, cada um com a própria agenda e jornada. Distribuição ao "qualquer atendente" = **menos carregado no dia** (desempate pela prioridade). Uma jornada por pessoa. Padrão ao marcar = responsável da oportunidade, com "qualquer atendente" a um clique. Só gerentes configuram. Atendente sem Google entra, com aviso. **Funciona nos dois sentidos:** escolhendo o responsável, só os horários dele; escolhendo o horário, só os atendentes livres nele. **Google:** cada atendente sincroniza a própria agenda; trocar o responsável tira o evento da agenda do Google do anterior e põe na do novo; sem Google conectado, fica só na agenda do app. **Andamento:** código publicado (rotas, matriz pessoas × tipos, os dois sentidos, distribuição, troca de agenda no Google ao mudar o responsável); migration 0649 **aplicada**; a IA e as integrações oferecem a união dos horários da equipe e marcam pelo menos carregado; o aviso de reunião encerrada vale em qualquer tela.


### Tarefas e Estratégia — ajustes de 17/10/2026
- **Seletores no estilo do software:** os campos que eram o `<select>` do navegador em Tarefas
  (modelos de tarefa, grupo das opções de status, filtros/ordenação/agrupamento) passaram a usar o
  seletor em popup (`SeletorEmPopup`), com as etiquetas coloridas. Os de outras telas seguem como estavam.
- **Roda do mouse nos popups:** a lista de qualquer popup (Popover, menu, Select) rola com a roda
  mesmo aberta por cima de um diálogo (`lib/ui/rolagem-livre.ts`; antes só rolava pela barra lateral).
- **Nova tarefa = pop-up central** (como compromisso/oportunidade): abre com todas as propriedades,
  herda filtros/grupo/dia, e só grava no "Criar tarefa" (o rascunho usa as mesmas células da tabela).
- **Calendário:** arrastar a tarefa para outro dia muda o prazo (com bloco que acompanha o mouse);
  as tarefas **sem prazo** também se arrastam para um dia. **Propriedades dentro da tarefa** (título
  em cima, propriedades editáveis embaixo): escolhe-se em Configurar visualização › Propriedades
  (guardado em `config.calendario.propriedades`, só do calendário).
- **Linha do tempo:** tarefa sem data arrasta-se da faixa "Sem data" para dentro da linha do tempo e
  entra no dia onde foi solta (início e prazo no mesmo dia).
- **Geração de Demanda (Estratégia):** as 6 páginas fixas saíram. A fase tem o botão **Nova
  estratégia**; cada estratégia é uma subpágina do módulo `estrategia-de-marketing` (tipo
  `estrategia`, repetível) com o modelo de estratégia (`lib/marketing/modelos-estrategia.ts`) e
  aparece no link público quando publicada. Páginas antigas dos 5 módulos removidos continuam no
  banco, sem tela.

### Campanhas, datas e seletores — ajustes de 17/10/2026 (2)
- **Nova campanha:** exemplo "[CAMPANHA] Geração de Demanda", Enter cria, canal no seletor do app.
- **Seletores em todo Marketing:** `SelectDoApp` (`components/ui/SelectDoApp.tsx`) troca o `<select>`
  do navegador pelo seletor em popup sem reescrever os formulários — Campanhas, Cronograma, editor
  de páginas e ofertas.
- **Datas:** todo seletor de data aceita escrever a data (dd/mm/aaaa) e o "Hoje" agora **escolhe**
  o dia de hoje (cronograma, Tarefas/Agenda, célula de dia, período). Os `<input type="date">`
  nativos que sobraram (honorários, antiban, contato) ainda não foram trocados.
- **Atalhos com "Voltar":** os atalhos de Campanhas (Clientes, Meta Ads, Resultados) levam
  `?voltar=` e a página de destino mostra "Voltar para …" (`components/shell/BotaoVoltar.tsx`).

### Radar no CRM — 18/10/2026
- **A página `/app/radar` foi excluída** (menu mais curto). O radar agora é a coluna **Radar** da
  aba Oportunidades do CRM (Crítico / Em risco / Em voo / Em dia + tempo sem resposta), com filtro,
  agrupamento e ordenação por urgência. Mesma classificação de antes (`classifyRisk`: janela da
  etapa, follow-up em voo, proteção da agenda), lida de `/api/v1/leads/at-risk?limit=500` pelo hook
  `useRadarDasOportunidades`; negócio aberto que não vem na lista está em dia.
- A coluna antiga "Sem resposta há" foi trocada por ela (o filtro numérico em horas continua).
- A porta de extensão `radar.open` e os avisos da Central agora abrem o CRM.
- **Aba pronta "Radar"** (`lib/clientes/modelos-de-visao.ts`): no "+" das abas das Oportunidades,
  um clique cria a aba com filtro Crítico/Em risco ordenado por urgência (se já existe, abre).
- Fica pendente, se for o caso: reabrir "demandas sem próximo passo" e "propostas vencidas" como
  filtros do CRM.

### Modelos de funil fixos — 18/10/2026
- Três funis prontos no seletor "Usar um modelo de funil" da campanha (`lib/marketing/modelos-de-funil-fixos.ts`,
  id `fixo:<chave>`, sem banco, não editáveis): **Tráfego pago · com reunião**, **Tráfego pago · sem reunião**
  e **Prospecção ativa**. Incluem MQL, Desqualificado, Comprou/Não comprou e a janela do Radar por etapa.
- **Agenda ↔ funil (18/10):** as etapas "Reunião agendada" e "Reunião realizada" dos modelos nascem com os
  slugs `agendado` e `reuniao-realizada`, que a Agenda reconhece: compromisso marcado (pela Agenda ou
  importado do Google) leva a oportunidade para "agendado"; resultado "realizada" leva para "reuniao-realizada"
  (só para a frente). "Comprou" continua abrindo o pagamento. Pendente: perguntar "e agora?" após "não
  comprou" (negociação / desqualificado / não comprou com motivo) e lead que já chega qualificado/agendado pela LP.
- **Feito (18/10):** diálogo "E agora?" após "Compareceu e não comprou" (`DestinoPosReuniao`, rota
  `/api/v1/leads/[id]/destinos-pos-reuniao`); webhook aceita `qualificado`/`qualified`/`mql`/`lead_qualificado` =
  sim → lead nasce na etapa MQL (`lib/webhooks/qualificacao-da-captacao.ts`); "Apagar e recomeçar" no funil da
  campanha (`substituir: true`: webhooks vão para o funil novo; antigo apagado se vazio, arquivado se tiver negócios).
  Apagar de vez as oportunidades de um funil NÃO foi feito (carregam vendas e histórico) — decisão pendente.
- Hoje só aparecem ao criar o funil de uma campanha; levar para "Novo funil" em Configurações › Funis é o próximo passo natural.

### Funis, Novo lead e Importar — 18 a 20/10/2026
- **Modelos de funil prontos (correção):** o erro de etapa duplicada vinha de um gatilho do banco do M1
  (`fn_funil_novo_com_desqualificado`) que cria "Desqualificado" em todo funil novo; a rota agora limpa as
  etapas automáticas antes de aplicar o modelo.
- **Novo lead:** "Etiquetas" virou **Tags**; o funil ganhou **Produto principal** (Configurações › Funis,
  `settings.produto_principal_id`, sem migration) e o Novo lead puxa produto e valor ao escolher o funil;
  popup sem rolagem lateral no celular.
- **Importar leads:** tabela visível no celular; **atualiza em massa quem já existe** (mesmo telefone/e-mail:
  preenche o vazio, soma tags, grava campos); colunas de **links** (Instagram, Site, Google Meu Negócio,
  Facebook, LinkedIn, TikTok, YouTube, Outro) e atalhos para os campos personalizados dos funis.
- **Histórico do lead:** todo lead novo grava como entrou (manual, planilha, formulário/integração, assistente,
  API) e a origem/campanha da importação. O resto (etapa, ciclo de vida, ligações, tarefas, agenda,
  pagamentos…) já era registrado. Registrar ação virou o seletor "Escolher ação".
- **Ficha do lead:** Oportunidades e Vendas viram cartões no celular; "Vendas mais urgentes" abre a oportunidade.
- **Números que cabem** (`NumeroQueCabe`): dashboards, tráfego pago, CRM, ficha e campanhas mostram o número em
  uma linha (fonte encolhe; de 1 milhão para cima abrevia "3,5 mi").

### Prospecção, Campanhas e Meta Ads — 20 a 22/10/2026
- **Modo prospecção:** cabeçalho no celular (título numa linha, setas abaixo); **resultados e atalhos
  editáveis por tipo** (ligação, WhatsApp, Instagram, outro) em "Configurar a prospecção", que ganhou visual novo.
- **Campanhas:** propriedades **Investido, Leads e CPL** separadas (tabela e cartões); a conta passou a somar o
  **período inteiro** da campanha (mês vigente se contínua), inclusive gasto lançado antes do início
  (migration **0650**, já aplicada no Supabase e no baseline). Bloco Investimento com números que cabem.
- **Funil da campanha:** sai "Configurações avançadas das etapas"; **janela de esfriamento** e **aviso na
  Central** viram opções de "Configurar a etapa".
- **Meta Ads** no motor das outras tabelas (filtros, ordem, agrupamento, propriedades, abas salvas); botão
  "Voltar" alinhado.
- **Todas as tabelas:** propriedade desligada vai para o fim da lista; **Ctrl+Z** (`lib/motor/desfazer.ts`)
  desfaz edições em Tarefas, Campanhas (e criativos/abordagens/LPs), Produtos, Clientes e Vendas (status),
  além de **criar/apagar** tarefas e criativos/abordagens/LPs e **criar** campanha; volta na hora (otimista).
- **Build:** import acima de `"use client"` derrubou 3 builds (18/10); corrigido. Regra: rodar `next build`
  antes de mesclar. Teste de Funis quebrado desde 18/10 corrigido.

### Reagendamento, funil, Modo agência e dashboards — 27 a 31/10/2026
- **Agenda:** reagendar muda o MESMO compromisso (volta a "Confirmado", conta `reschedule_count`, nota "Reagendado N vezes"
  na página do compromisso); sem o status "Reagendado"; **cancelado fica travado** (para retomar, cria-se outro).
  Seis status fixos. Migrations 0680 e 0681.
- **Funil da campanha:** **cor de cada etapa** (escolhida ao criar o funil, igual em toda tag e seletor); Motivos, Campos
  e Agente do funil passaram para dentro do funil da campanha, e a tela Configurações › Funis saiu.
- **Dashboards:** Ticket Médio no Tráfego Pago; tabela de produtos do Business com Leads, Tx de Conversão, Ticket Médio,
  Faturamento Total, Recebido e A Receber; faturamento recebido com fechado e a receber na descrição; painel
  **Fechamento do período** (por data de fechamento). **Parcelas vencidas** viram aviso na Central (um por empresa).
- **Modo agência** (plano em `docs/PLANO-MODO-AGENCIA.md`): uma "organização" à parte no seletor, com menu próprio:
  Campanhas (banner único, uma tabela por cliente, campanha em pop-up), Cronograma e semana, Dashboards, Tarefas e Equipe
  e clientes. Seletor de clientes (vários, com ordem), tag colorida por cliente (cor escolhida em Gerenciar organizações),
  acesso = ser membro manager/admin do cliente, delegação por pessoa. Duas empresas de exemplo (Clínica Aurora e
  Casa Bela Móveis) com campanhas, leads e vendas fictícios.
- **Tarefas da agência espelhadas** (migration 0682): ligando o contato do CRM da agência à organização do cliente, a
  tarefa da agência aparece também na empresa do cliente (e as marcadas "da agência" lá aparecem na agência), sincronizadas.

## 1B. PRÓXIMOS PASSOS (atualizado em 22/10/2026)
1. **Ctrl+Z que falta:** criar produto, venda e lead; clientes pela lixeira (já restaura). Apagar campanha,
   oportunidade e venda é apagamento definitivo (sem volta) — decidir se vale ganhar lixeira.
2. **Conferir ao vivo** o que subiu de 18 a 22/10 (cartões do celular, Importar em massa, resultados da
   prospecção, Meta Ads no motor): a build roda no GitHub; falta confirmar na VPS.
3. Pendências oferecidas: apagar de vez oportunidades de um funil (com confirmação forte); levar os modelos
   fixos para "Novo funil" em Configurações › Funis; campo `qualificado` no formulário/n8n; trocar os
   `<input type="date">` restantes (Honorários, Antiban, Editar contato); reabrir "demandas sem próximo passo /
   propostas vencidas" como filtros do CRM; confirmar o cron `risk-watcher` na VPS.
4. Histórico do lead: "respondido no inbox por X" pode não gravar linha — conferir; leads antigos não ganham
   a linha de origem.
5. **Equipe da Agenda:** conferir ao vivo os dois sentidos, o "qualquer atendente" e a troca de agenda no Google.
   **Agenda visual (26/10/2026, feito no código, aguardando teste):** a página abre direto no calendário
   (sem a lista Próximos/Aguardando/Passados/Cancelados); menu de visões Dia / 3 dias / Semana / Mês; horários
   indisponíveis em cinza; no celular, visões parecidas com o Google Agenda. Pontos seguintes que o Arthur
   está levantando ficam registrados em `docs/PLANO-AGENDA-VISUAL-M1.md`.
6. Recomendações da IA ao vivo na reunião de vendas (hoje "em breve").
7. Campo de endereço/local e observação pública no novo compromisso.
8. Inbox (frente 5).
9. Dashboards alinhados ao modelo novo (atribuição por funil, Prospecção Ativa, compromissos da Agenda).
10. Hotmart; depois financeiro e CAC real (D5). D6 metas e alertas; D4 Google Ads.
11. Último passo: finalizar o app, publicar na VPS e só então tornar o repositório privado.
12. **Prospecção — o que ficou para depois (24/10/2026):**
    - **Enriquecimento com CNPJ:** achar o CNPJ pelo site da empresa e trazer porte e sócios de bases
      públicas (depende de uma fonte externa de dados).
    - **Disparos dentro da campanha:** hoje a aba lista só os da campanha e cria dentro dela, mas os
      lotes de leads ainda não se somam (cada disparo escolhe o próprio público).
    - **Duplicidade mais esperta** (mesmo site, nome com endereço): descartada por ora — o lugar e o
      telefone já barram, e site em comum derrubaria filiais da mesma rede.
    - **"Só celular" na triagem** vale só nas campanhas novas; as antigas seguem aceitando fixo.
    - Custo das extrações em reais (com IOF) no registro da campanha (hoje em dólar).
    - Provedor extra (Google Places oficial): só depois de conferir os termos de uso dos dados.
    - Plano de tarefa como "tarefa modelo": hoje o popup pede cliente e datas; pedir mais campos
      (responsável diferente, observação) se fizer falta.
    - **Cadência da Prospecção Ativa, anti no-show e execução do WhatsApp (24 a 26/10/2026):** fases 1 a 8e e
      os ajustes finais **no código e na `main`**; plano e pontos opcionais em `docs/PLANO-CADENCIA.md`.
      **Em pausa até o teste do aplicativo completo** (roteiro em `docs/ROTEIRO-DE-TESTES-CADENCIA.md`);
      depois, uma ou duas rodadas de ajuste.
Rotinas desligadas de propósito (~25): disparam mensagens; ligar por pacote, só a pedido.

## 2. PEQUENOS AJUSTES PENDENTES

| Item | Situação |
|---|---|
| Páginas legais e verificação do Google | **Feito** (domínio verificado no Search Console e app reenviado; falta só acompanhar a resposta do Google) |
| Publicar as ofertas da Assessoria M1 | **Feito** (publicadas e sincronizadas com o catálogo da IA) |
| Nome da fase 02 ("Produto e Oferta") | **Decidido: "Mercado e Oferta"** |
| Religar a confirmação de e-mail no cadastro | **Feito** |
| Pendências antigas do menu | Nome real no lugar de "Dono": **feito** (ao entrar com o Google). Faltam: seletor de empresa e redirecionamento pós-onboarding (junto das frentes 12/14) |
| Página `onboarding` antiga publicada | **Feito** (apagada, com o rascunho e o link) |

## 3. As 15 frentes (sem ordem fixa)

Situação em 13/10/2026: **Feito**, **Em andamento**, **Parcial** (parte pronta) ou **A fazer**.

| # | Frente | Escopo | Situação | O que você pode ir decidindo no planejamento |
| --- | --- | --- | --- | --- |
| 1 | **Dashboards** | Tráfego (Meta/Google), vendas, faturamento e meta × realizado do Planejamento num lugar só | **Parcial (D0 a D3 no ar, ver PLANO-DASHBOARDS).** Antes: Existem `/app/metrics`, `/app/ads/meta`, `/app/faturamento`; o CRM já mostra faturamento recebido, valor em aberto e LTV; campanhas mostram vendas e faturamento por anúncio e LP. Falta a tela única | Quais números mandam na tela inicial? Quais períodos? Quem vê o quê (agência × cliente)? **Atualizado em 01/11: ver §3-bis.** |
| 2 | **Cronograma** | Feito | **Feito** | Só as melhorias futuras abaixo |
| 3 | **IA ajudante** | Rascunho de página a partir do Kick Off e dos prompts do método (precisa de chave de IA) | **A fazer** | Quais páginas geram rascunho primeiro? Que modelo de IA e qual orçamento? |
| 4 | **Geração de demanda** | Campanhas, criativos e textos com status; você já tem uma base | **Em andamento.** Cadastro, tabela, cards e linha do tempo; criativos do Meta com todas as variações; dia a dia automático; origem rastreável. Plano em `docs/PLANO-CAMPANHAS-M1.md` | Mande a base atual. Quais campos e quais status? |
| 5 | **Inbox** | Ajustes visuais e conexões com "outros bancos" | **A fazer** | O que são esses "outros bancos"? Que ajustes visuais incomodam? |
| 6 | **Equipe** | Pessoas, papéis e interface por empresa | **A fazer** (a equipe já aparece como responsável por lead e por venda) | Quais papéis existem de fato na agência e no cliente? **Atualizado em 01/11: ver §3-bis.** |
| 7 | **Prospecção** | Scraping de leads e disparos (API oficial e não oficial) com análise por ação e mensagem | **Parcial, avançado** (prospecção ativa por ligação e WhatsApp, extração de leads, cadência, disparos com IA e continuação da conversa: código pronto, **aguardando teste** — ver PLANO-CADENCIA) (base: `/app/prospecting`) | Quais fontes de leads? Qual volume? Como separar o risco do não oficial? **Atualizado em 01/11: ver §3-bis.** |
| 8 | **CRM** (o maior) | Visualizações, funis, base de leads e de vendas, ligação com dashboards, rastreamento, CAPI e movimentação automática estilo Tintim | **Em andamento, avançado.** Faltam Hotmart, contas a receber, Lead Ads nativo, CAPI/movimentação automática (ver `docs/PLANO-CRM-M1.md`) | Já está no `PLANO-CRM-M1.md` do fork |
| 9 | **Conexões e webhooks** | Formulários e LPs entrando como leads | **Parcial.** Receber lead já tratado (n8n/sistema próprio) e importação feitos; falta Lead Ads nativo e os eventos de CAPI | Quais LPs e formulários? Quais campos chegam? Que eventos viram CAPI? **Atualizado em 01/11: ver §3-bis.** |
| 10 | **Agenda** | Ajustes visuais e de UX | **Em andamento** (Google, oportunidade, análises e anti no-show feitos; falta validar lembretes) | Liste o que incomoda hoje |
| 11 | **Agentes de IA** (plano à parte: `docs/PLANO-AGENTES-M1.md`) | Revisar agentes e a fonte de conhecimento (as ofertas já alimentam) | **Próxima: revisão com o Arthur** | Quais agentes existem? Qual é o papel de cada um? **Atualizado em 01/11: ver §3-bis.** |
| 12 | **Configurações gerais** | Centralizar ajustes | **A fazer** (categorias e cores de tag já têm tela própria em Configurações › Tags) | O que está espalhado hoje? **Atualizado em 01/11: ver §3-bis.** |
| 13 | **Barra de pesquisa** | Evoluir a paleta de comandos | **A fazer** | O que deve ser pesquisável (leads, tarefas, produtos, páginas)? |
| 14 | **Visão multi-tenant (ADM)** | Organizações e visualizações na área `/admin` | **A fazer** | O que você precisa ver de todos os clientes de uma vez? **Atualizado em 01/11: ver §3-bis.** |
| 15 | **Financeiro completo** | Contas, fluxo de caixa, DRE e recorrência | **Parcial.** Vendas, parcelas, faturamento recebido e a receber existem; faltam contas a receber (cobrança), fluxo de caixa, DRE | Hoje existe `/app/faturamento`. Que relatórios importam? **Atualizado em 01/11: ver §3-bis.** |
| 16 | **Central de avisos, alertas e notificações** (plano à parte: `docs/PLANO-AVISOS-M1.md`) | Verificar e revisar TODOS os avisos; tirar a Central de dentro de "Agentes de IA" (hoje é "Alertas" em `/app/ai/inbox`) e dar a ela um lugar próprio; juntar com o sino e as notificações | **A fazer** | Quais avisos importam? Quem recebe cada um? Por onde (sino, push, e-mail)? **Atualizado em 01/11: ver §3-bis.** |
| 17 | **Tarefas: visões padrão** | Visões prontas ao criar uma aba: **Pendentes** (atrasadas + hoje + próximos 1 a 2 dias) e **Minhas tarefas** (designadas a mim), mais as que forem aprovadas (ver abaixo) | **Feito (31/10)** — modelos no "+" das abas; Pendentes = até 2 dias à frente | Ajustes finos conforme o uso |
| 18 | **Go-live** (plano à parte: `docs/PLANO-GO-LIVE-M1.md`) | Colocar para rodar com clientes reais: banco de produção com backup, VPS, rotinas, WhatsApp, piloto | **A fazer** | VPS recomendada: 4 vCPU / 16 GB / 160 GB NVMe em São Paulo; WAHA Plus ou API oficial? |
| 19 | **Automações e Fluxos de Follow Up** (inclui o Método Anti-No-show) | Deixar o painel de Automações com o visual dos fluxos de follow up (canvas) e organizar o Anti-No-show | **Em andamento** (plano em `docs/PLANO-AUTOMACOES-M1.md`; Central por categoria e modelos prontos no ar em 01/11; próximo: follow-ups M1 e editor visual) | Quais automações existem hoje e quais merecem virar fluxo visual? |
| 20 | **App no celular** | Instalação, atualização ao vivo e notificações no celular | **Parcial** (instala como app; faltam atualização ao vivo em todas as telas e revisão das notificações) | Ver §3-bis, item J |
| 21 | **Módulos por nicho** | Versões do app para outros modelos de negócio (clínicas veterinárias, agências de modelo) | **A fazer** | Começar por um "preset de nicho" ou por módulos com tela própria? |

### Detalhes das frentes

**2. Cronograma (melhorias futuras)**
- **Prazo nas metas:** definir o período de cada meta (diário, semanal, mensal, semestral, anual…).
- **Metas que se atualizam sozinhas** dentro do prazo, a partir dos dados reais. Exemplos: meta de
  30 leads por dia → média de leads dos últimos 5 dias; meta de R$ 15 mil no mês → soma das vendas
  realizadas no mês. A mesma lógica vale para os Dashboards (frente 1). Depende do CRM (frente 8):
  leads e vendas precisam existir como dado (**já existem**).
- Ligar as barras das ações às tarefas, resumo semanal para o WhatsApp e motivo visível ao cliente
  por escolha.

**4. Geração de demanda**: inclui a criação das campanhas e dos funis que serão usados no CRM
(cada campanha nasce ligada a um funil e a uma origem rastreável; é a ponte entre esta frente e a
8). Plano detalhado: `docs/PLANO-CAMPANHAS-M1.md`.

**8. CRM**: cuidado, leads alimentam Inbox, automações, follow-up, IA e webhooks.

**16. Central de avisos, alertas e notificações**: hoje a Central mora em Agentes de IA (menu "Alertas", `/app/ai/inbox`) e
guarda ~40 tipos de aviso (`agent_inbox_items`); o sino do topo, as notificações do navegador, os sons e o push do celular
são outra camada (Configurações › Notificações). Revisar todos os avisos (o que ainda faz sentido, texto, gravidade,
quem recebe, o que o botão faz), tirar a Central de dentro de "Agentes de IA" e unir sino + Central + notificações num
só desenho. Plano e perguntas em `docs/PLANO-AVISOS-M1.md`.

**17. Tarefas: visões padrão** (propostas — o Arthur aprova a lista):
- **Pendentes** (padrão da tabela): atrasadas + vencem hoje + vencem nos próximos 1 a 2 dias; ordenada por prazo.
- **Minhas tarefas**: designadas a mim, não concluídas.
- **Atrasadas**: só o que já venceu (a que mais cobra).
- **Esta semana**: de domingo a sábado, agrupada por dia.
- **Sem responsável**: tarefas que ninguém assumiu (evita tarefa órfã).
- **Aguardando o cliente**: tarefas "do cliente" no cronograma (o que depende dele).
- **Da agência**: tarefas da agência dos clientes (a base do Modo agência).
- **Por cliente**: agrupada por cliente, só abertas.
- **Concluídas recentes**: últimos 7 dias (para a revisão da semana).
Mecânica: a visão nasce no "+" das abas (como o "Radar" das Oportunidades em `lib/clientes/modelos-de-visao.ts`): um clique
cria a aba com o filtro pronto; se já existe, abre. "Minhas tarefas" usa o usuário logado.

### 3-bis. Frentes novas e atualizadas (01/11/2026)

Sequência que eu sugiro (a decidir): 1) Configurações › Equipe (convite e criação de conta, bloqueia clientes
reais), 2) Visões da equipe (segurança entre agência, empresário e funcionário), 3) Alertas, Central e
Push, 4) App no celular com atualização ao vivo, 5) Dashboard Comercial, 6) Automações visuais e Anti-No-show,
7) Aba multi-tenant (ADM), 8) Campanha de Prospecção (Disparos), 9) Conexões e Webhooks (limpeza),
10) Agentes de IA, 11) Módulos por nicho, 12) Financeiro completo. O go-live fica no `docs/PLANO-GO-LIVE-M1.md`.

**A. Automações (frente 19)** — *só planejar, sem executar.* Pergunta: dá para o painel de Automações ficar com o visual dos
fluxos de follow up? **Provavelmente sim.** O editor de follow up (`app/app/ai/followups/[id]`) já é um canvas feito com
`@xyflow/react`, com nós de Gatilho, Condição, Espera, Tarefa interna, Coleta, Classificação e Fim; o painel atual
(`app/app/automacoes`) é uma central em lista de regras (lead, tags, tarefas, mensagens, webhooks). Plano:
1. Inventariar as regras atuais (gatilho, condições, ações) e dizer quais cabem nos nós que já existem.
2. Mostrar a regra existente como fluxo (somente leitura) reaproveitando o canvas e os nós; só depois permitir editar.
3. Fazer o **Método Anti-No-show** como modelo pronto de fluxo (confirmação, lembretes, reagendamento e reversão do no-show).
4. Decidir se follow-up e automação viram um lugar só (uma central, dois tipos de fluxo). A migração não pode quebrar regra em produção.

**B. Alertas, Central de Avisos e Notificações Push (frente 16)** — detalhes no `docs/PLANO-AVISOS-M1.md`. Combinado:
alerta e aviso da Central são **a mesma coisa** (uma fonte, vários destinos: Central, sino, push). Entregas, **no chat, antes de
mexer em qualquer coisa**: (1) tabela com todas as configurações e ocasiões que geram alerta/aviso (de onde nasce, para
quem vai, texto, link do clique, o que fazer com ele: manter, mudar, apagar, criar); (2) auditoria das notificações push
(aparência, texto, ícone, link aberto ao clicar). A decisão de manter, criar ou apagar é sua, item por item.

**C. Campanha de Prospecção (Disparos) (frente 7)** — *a descrever.* Já existe prospecção ativa por ligação e WhatsApp,
extração de leads, cadência e disparos com IA. Quando você descrever, vou precisar de: de onde vem a lista, por qual canal
(WAHA, número do cliente ou API oficial), mensagem e variações, janela e ritmo anti-banimento, aquecimento do número,
resposta e opt-out, e a análise por ação e por mensagem.

**D. Visões da equipe (frente 6) — quem vê e edita o quê**
| | Super Adm (Agência M1: você e sua equipe) | Adm (empresário, dono da empresa cliente) | Membro (funcionário do cliente) |
| --- | --- | --- | --- |
| Alcance | Tudo, **incluindo** a visão multi-tenant (todos os clientes) | Só a própria empresa | Só a própria empresa, só as abas liberadas pelo Adm |
| Início | Normal | Normal (vê e cria tarefas e compromissos) | Normal |
| Tarefas | Tudo | Não vê a coluna Cronograma nem as tarefas marcadas para a agência; cria só tarefas e visualizações dele e da empresa | Igual ao Adm |
| Estratégia, Cronograma, Campanhas | Edita | **Só vê** | **Só vê** (se a aba estiver liberada) |
| Dashboards | Tudo | Só vê, muda o período e filtra | Só vê, muda o período e filtra (se liberada) |
Pontos de projeto (decidir antes de construir):
- Os papéis atuais são viewer < agent < manager < admin, mais o super-admin da plataforma. Hoje a sua equipe entra nas
  empresas dos clientes como manager/admin (é assim que o Modo agência funciona), **o que é igual ao Adm do cliente**.
  Precisamos de um marcador que diga "isto é da agência" (por exemplo, um vínculo da pessoa com a organização da agência),
  porque só ele pode editar Estratégia, Cronograma e Campanhas.
- "Não vê as tarefas da agência" tem de ser garantido **no banco** (política de acesso por linha), não só escondido na tela,
  senão qualquer um enxerga pela API.
- A escolha das abas do funcionário já tem base: `Interface` por empresa (`InterfaceEditor`, `lib/navigation/interface.ts`).
  Falta virar escolha por pessoa feita pelo Adm.
- "Só vê" nas telas de Estratégia, Cronograma e Campanhas hoje depende do papel (agent+ edita); vira uma regra própria.

**E. Dashboard › aba Comercial (frente 1).** Métricas pedidas, todas separáveis por **Tráfego Pago × Prospecção Ativa** quando fizer sentido:
1. Funil com todas as etapas de conversão, adaptado por empresa; padrão **Lead → Agendamento → Reunião → Venda**.
2. Média de follow-ups feitos nos leads que chegam e não respondem.
3. Distância média dos agendamentos (quantos dias para frente a reunião é marcada).
4. Taxa de no-show registrada e os motivos.
5. No-shows revertidos pelo follow-up (fez a reunião depois de faltar).
6. Média de contatos necessários até o agendamento e até a venda.
7. Taxa de conversão reunião → venda.
8. Ticket médio negociado.
Já temos a base de vários: status de comparecimento e o contador de reagendamentos (migration 0681), follow-ups e vendas.
Falta definir como contar um "contato" (mensagem enviada, ligação, resposta?) e onde registrar o motivo do no-show.

**F. Dashboard › aba Atendimento** — *a descrever.* Sugestões para você aprovar: tempo da primeira resposta, tempo médio
de resposta, conversas sem resposta, volume por canal e por horário, passagem da IA para o humano, e produtividade por atendente.

**G. Aba multi-tenant (ADM) (frente 14)**
1. Configurações gerais.
2. Equipe: configurações da equipe e das visualizações de cada tipo.
3. Configurações do Modo Agência e visualização de todos os clientes em massa.
4. Definição das visões por papel (Super Adm, Adm, Time), que é o item D acima.

**H. Configurações › Equipe (frente 12) — prioridade alta.** Problemas relatados: o e-mail de convite não é enviado e, ao criar a
conta, o sistema cria uma **empresa nova** em vez de entrar na empresa que convidou. Hipóteses a confirmar (não são
diagnóstico): provedor de e-mail sem chave configurada neste ambiente; o aceite do convite cai no onboarding comum, que cria
organização. Plano: reproduzir o percurso inteiro como cliente novo (convidar, receber, aceitar, entrar na empresa certa com o
papel certo), corrigir na causa e deixar um teste que cubra o percurso. Convite deve também aceitar o aviso por link copiável
quando não houver e-mail configurado.

**I. Conexões e Webhooks (frente 9), Agentes de IA (11).** Organizar, deixar mais bonito e **remover o que não usamos**. Começa
por um inventário (o que existe, o que está ligado em produção, o que ninguém usa) para você aprovar item por item antes de apagar.
Agentes de IA: revisar quais existem e o papel de cada um; o Anti-No-show conversa com o item A.

**J. App no celular (frente 20)** — suas três perguntas:
1. **Como funciona a instalação?** É um **PWA** (aplicativo web progressivo): o "app" é o próprio site instalado pelo Chrome,
   aberto em tela cheia, sem barra do navegador (o `manifest` do app já define `display: standalone` e o ícone). Não passa
   por loja, **não é um app nativo**, e **atualiza sozinho** com o site (não precisa baixar versão). No iPhone o caminho é
   Safari › Compartilhar › Adicionar à Tela de Início.
2. **Atualização ao vivo.** Hoje só algumas telas ouvem o banco em tempo real (alertas, Inbox, ligações, admin). Plano: ligar o
   **Realtime do Supabase** nas tabelas das telas principais (tarefas, leads e vendas, compromissos, campanhas), de modo que
   uma edição apareça sem puxar para atualizar; atualizar também ao voltar para o app (visibilidade/foco) e ao reconectar a
   internet. Para duas pessoas editando ao mesmo tempo: **conferir a versão do registro antes de gravar** e avisar
   "este item foi alterado por outra pessoa" em vez de sobrescrever.
3. **Notificações no celular.** Sim: o PWA recebe **push** (já existe a base: `lib/notifications/web_push.ts`, o service worker
   `notify-sw.js` e a tela em Configurações › Notificações). Funcionam lead chegando, cobrar lead, "lead pagou?" etc. A ideia
   fixa é **uma fonte só**: o mesmo evento vira aviso na Central **e** push no celular (item B). Limites: no iPhone o push só
   funciona com o app **instalado** na tela inicial (iOS 16.4 ou mais novo) e o usuário precisa permitir; no Android funciona
   pelo Chrome. O servidor precisa de chaves próprias de push (VAPID), que fazem parte da instalação na VPS nova.

**K. Módulos por nicho (frente 21).** Versões do app para clínicas veterinárias e agências de modelo. A doutrina do projeto
manda o núcleo continuar útil com zero extensões, e o mecanismo de extensões de hoje não tem tela, tabela nem menu próprios.
Então eu começaria por um **preset de nicho** (vocabulário do funil, funis, campos do lead, tags, agentes e cronograma já
montados para o nicho), que não exige código novo, e só depois, se fizer falta, módulos com tela e dados próprios.

**L. Financeiro completo (frente 15).** Sem mudança de escopo: contas a receber (cobrança), fluxo de caixa e DRE, em cima das
parcelas e vendas que já existem. Compartilha a fonte de venda com o CRM (frente 8) e com os Dashboards (frente 1).

### Ligações entre as frentes
- 4 (geração de demanda) cria as campanhas e os funis que o CRM (8) usa; definir os dois juntos.
- 2 (metas do cronograma) e 1 (dashboards) leem os mesmos números do CRM e do financeiro: uma
  só fonte de verdade, com a regra do período (média de N dias, soma do mês…).
- 8 (CRM) alimenta 1 (dashboards), 7 (prospecção) e 9 (conexões): vale desenhar o modelo de lead e
  de venda antes de mexer em cada um.
- 3 (IA ajudante) melhora depois de 1 (números reais para citar).
- 15 (financeiro) e 8 (base de vendas) compartilham a mesma fonte de venda/receita.

## 4. FECHAMENTO DO PROJETO (depois dos planos)
1. Limpeza total do que veio do projeto original (docs, testes e2e, instalador, imagem Docker,
   pastas e volumes antigos, linhas de cron apontando para pasta inexistente) **e de todas as
   telas que não usamos mais** — entre elas a tela antiga "Novo agendamento" (painel lateral da
   Agenda, `app/app/agenda/_client.tsx`), substituída pelo pop-up "Novo compromisso". Também sai o componente `HistoricoDaAgenda` (e a vitrine da Agenda, que é a única que ainda o usa), junto com as quatro linhas de `JUSTIFICADOS` em `tests/unit/controle-decorativo.test.ts`.
2. Instalador (`instalar-vps.sh`) e roteiro de migração para a VPS nova; testar em VPS limpa;
   migrar com o atual no ar. Antes: cópia segura do `.env.local` (chaves que cifram dados do banco).

### Idioma (11/10/2026): o produto fala só português
- Removidos: seletor de idioma (topo, perfil e configurações da empresa), dicionário de espanhol
  (`lib/i18n/dicionario.ts` virou um arquivo mínimo; `t()` devolve o próprio texto), catálogos
  `en`/`zh-CN`, guardas de tradução e testes que conferiam espanhol. Registro de idiomas: só pt-BR.
- Código novo pode escrever texto direto, com ou sem `t()`.
