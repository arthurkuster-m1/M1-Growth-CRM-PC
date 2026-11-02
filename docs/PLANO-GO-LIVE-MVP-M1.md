# Plano Go-Live MVP do M1 Growth CRM — a trilha principal

Criado em 02/11/2026. **Esta é agora a trilha principal do projeto.** Objetivo: o Arthur passa a usar o aplicativo na **própria
operação da agência** (clientes atuais, campanhas de tráfego e prospecção), sozinho, por **2 a 8 semanas**, com a meta de
**fechar pelo menos 1 cliente novo usando o CRM** e de **achar e corrigir os erros** no uso real. As frentes grandes (IA,
automações avançadas, financeiro completo, multi-tenant avançado, módulos por nicho) **seguem em paralelo, sem bloquear**.

Documentos irmãos: `docs/PLANO-GO-LIVE-M1.md` (infraestrutura e roteiro detalhado da VPS), `docs/PLANO-M1.md` (plano-mãe e frentes),
`docs/PLANO-AUTOMACOES-M1.md`, `docs/PLANO-AGENTES-M1.md`, `docs/MODELO-ANTI-NO-SHOW-M1.md`.
Quem faz: **[A]** Arthur · **[C]** Claude. Cada fase só começa quando a anterior cumpre o **critério de saída**.

## Visão da linha do tempo
| Fase | O quê | Onde acontece | Quem lidera |
| --- | --- | --- | --- |
| 1 | **Revisão**: criar empresas, entender o multi-tenant, cadastrar clientes de teste, achar o que falta | Ambiente atual (teste) | Arthur, com o Claude |
| 2 | **Limpeza e preparação**: tirar o que não usamos, otimizar a entrega, deixar pronto para ARM e para a VPS nova | Código (GitHub) | Claude |
| 3 | **Nova VPS e novo banco**: Supabase na VPS Oracle de São Paulo, ao lado do n8n que não pode cair | VPS nova | Claude, com o Arthur dando o acesso |
| 4 | **Subir a M1**: conteúdo, processos, clientes atuais, Meta Ads, n8n → CRM, WhatsApp | VPS nova | Arthur e Claude |
| 5 | **Operação solo (2 a 8 semanas)**: acompanhar campanhas, prospectar, fechar um cliente, caçar erros | VPS nova | Arthur |
| 6 | **Em paralelo e depois**: IA, automações, financeiro, multi-tenant (ADM), mobile, módulos | Código | Claude |

---

## Fase 1 — Revisão (antes de mexer em qualquer servidor)
Objetivo: **entender e validar o produto como o Arthur vai operá-lo**, e sair com uma lista priorizada de correções.
Roda no ambiente atual (dados de teste). Nada aqui é definitivo.

### 1.1 Criar novas empresas (o processo de ponta a ponta)  — **o mais importante**
Percurso a testar, como se fosse o primeiro cliente real, e anotar cada tropeço (print + o que esperava):
- [ ] **[A]** Criar uma empresa nova (em `/admin` › Organizações/Tenants, ou pelo cadastro) com o nome do cliente.
- [ ] **[A]** Definir o **dono da empresa** e convidá-lo: o e-mail do convite chega? Ao aceitar, ele **entra na empresa certa**
      (e não cria uma empresa nova — bug relatado)? Com o papel certo (Adm)?
- [ ] **[A]** Convidar um **funcionário** do cliente (Membro) e liberar só algumas abas.
- [ ] **[A]** Conferir no **Modo agência**: a empresa aparece no seletor de clientes, com cor, e Tarefas, Campanhas, Cronograma e
      Dashboards mostram os dados dela.
- [ ] **[A]** Entrar **como o cliente** (Adm) e conferir o que ele **não** vê: coluna Cronograma e tarefas da agência; e o que ele
      só vê sem editar (Estratégia, Cronograma, Campanhas).
- [ ] **[C]** **Corrigir** o que quebrar: convite que não envia e-mail, aceite que cria empresa nova, papéis e visões da equipe
      (plano das "Visões da equipe" no `docs/PLANO-M1.md` §3-bis D). Esta correção entra **antes** de tudo.
- **Critério de saída:** criar uma empresa, convidar o dono e o funcionário, e os dois entrarem na empresa certa com o acesso certo,
  **sem ajuda minha**.

**Revisão do processo atual de criação de empresa (feita em 02/11, só leitura do código):**
- **Como cria hoje:** `/admin` › Tenants › Nova empresa (só super-admin) cria a empresa **e** o convite do dono (papel Adm). Se o e-mail do
  dono for o do próprio super-admin, ele já vira dono sem convite. O link do convite aparece na tela com botão "Copiar".
- **Corrigido (PR #252):** convidado sem conta que entrava com **Google** pela tela de login criava uma **empresa nova** em vez de entrar na
  que o convidou; e a tela de convite agora explica por que o e-mail não saiu e permite **copiar o link**.
- **Ainda a decidir:** o convite vale só **24 horas** (`lib/auth/invite-token.ts`). Para cliente real sugiro **7 dias** (e o botão "Reenviar" já
  existe em Equipe). E o e-mail só sai se o provedor estiver configurado em **Admin › E-mail**; sem isso, o link é copiado e mandado por WhatsApp.
- **Suspensos (02/11):** a área de **Agentes de IA** e o **onboarding antigo** (ver `.changes/ia-e-onboarding-antigo-suspensos.md`). O novo
  onboarding precisa cobrir: **aceite dos Termos de uso** e o **nome e fuso da empresa** (hoje feitos no passo "boas-vindas" antigo).

### 1.2 Revisão geral da área multi-tenant (`/admin`) — entender o que existe
O Arthur percorre **cada tela** e responde para cada uma: *uso / não uso / não entendo*. O Claude explica o que for "não entendo" e
registra o que mudar. Telas hoje: Dashboard, **Tenants (empresas)**, Usuários, Platform admins, Marca (white-label), E-mail, Google,
Meta, Inbox, Uso (IA), Auditoria, Incidentes, LGPD, Módulos, Extensões, Destinos internos, Sistema, Configuração, Cadastro.
- [ ] **[A]** Percorrer as telas acima e marcar uso / não uso / não entendo.
- [ ] **[C]** Explicar as dúvidas (em linguagem simples) e escrever "para que serve" de cada tela num guia curto.
- [ ] **[A+C]** Decidir o que **sai** (alimenta a limpeza da fase 2) e o que **muda** (alimenta o plano da aba multi-tenant, frente 14).
- **Critério de saída:** o Arthur sabe operar sozinho o essencial (criar empresa, usuários, marca, e-mail, Google/Meta) e a lista do que
  sai/muda está fechada.

### 1.3 Cadastrar os clientes (ensaio)
- [ ] **[A]** Cadastrar **2 ou 3 clientes reais como empresas de teste** (nome, cor, funil, usuários) para ver o fluxo completo.
- [ ] **[A]** Montar o **funil da própria M1**: Lead → Agendamento → Reunião → Proposta → Venda (ajustar nomes e etapas).
- [ ] **[A]** Conferir **Produtos e ofertas** da M1 (a fonte única de produto e preço) e a **página de proposta**.
- [ ] **[A]** Rodar o dia a dia: Início (Pendentes e Minha agenda), CRM, Agenda com Google, Tarefas.
- **Critério de saída:** o Arthur consegue "fazer de conta" uma venda inteira, do lead à parcela recebida.

### 1.4 Correções que travam o MVP (lista viva, prioridade alta)
- [ ] Convite de equipe e criação de conta (1.1).
- [ ] Verificação do app no Google (a Agenda só aceita e-mails cadastrados como teste até sair).
- [ ] Qualquer erro achado nas etapas 1.1 a 1.3.
- [ ] Decisões pendentes de produto: visões Super Adm / Adm / Membro (`docs/PLANO-M1.md` §3-bis D).

---

## Fase 2 — Limpeza e preparação da entrega (manter o plano de evolução)
Objetivo: **tirar o peso que veio do DeskcommCRM**, mantendo tudo que está no plano de evolução, e deixar o pacote pronto para a VPS
nova. **Regra de ouro: nada é apagado sem o Arthur aprovar a lista.**

### 2.1 Inventário do que sai (o Claude propõe, o Arthur aprova item a item)
- [ ] **[C]** Gerar a lista de candidatos: telas que não estão na navegação nem no plano (por exemplo, vitrines e telas antigas já
      marcadas para sair, como o painel antigo "Novo agendamento" e o `HistoricoDaAgenda`), módulos que o Arthur disser que não usa
      (1.2), integrações não usadas (Evolution, Nuvemshop se não usar), páginas e rotas órfãs, componentes sem uso.
- [ ] **[C]** Listar o que é **do projeto original** e não faz sentido num fork independente: docs e testes e2e herdados, instalador
      antigo, imagens Docker e workflows de CI que não usamos, páginas de marketing do DeskcommCRM.
- [ ] **[A]** Aprovar: **apagar / manter / adiar**, por grupo.
- **Cuidado:** o que alimenta uma frente do plano (IA, automações, financeiro, multi-tenant, mobile) **fica**, mesmo sem uso hoje.

### 2.2 Executar a limpeza
- [ ] **[C]** Remover em lotes pequenos (um PR por grupo), com os testes e o `typecheck` passando a cada lote.
- [ ] **[C]** Ajustar o catálogo de navegação, os guardas de i18n/branding e a documentação.
- [ ] **[C]** Banco: **não apagar tabelas** que existam no baseline sem avaliar (apagar é irreversível e o baseline é o que instala o
      banco novo). Se uma tabela sai, sai por migration versionada e entra no baseline.

### 2.3 Otimizar a entrega
- [ ] **[C]** Reduzir o tamanho da imagem e o tempo de build; conferir o carregamento das telas mais usadas.
- [ ] **[C]** Preparar a versão **ARM64** (a VPS é Ampere): imagens do app, do worker, do agendador e do WhatsApp (WAHA `noweb-arm`).
- [ ] **[C]** Montar e testar o **pacote de instalação** (baseline + `bootstrap-owner` + modo single-server com o nginx) numa máquina
      limpa de teste, **antes** de tocar na VPS real.
- **Critério de saída:** o app sobe do zero numa máquina ARM de teste, com banco limpo, e o roteiro de instalação está escrito e
  ensaiado. Cópia de segurança do repositório inteiro feita fora do GitHub.

---

## Fase 3 — VPS nova e banco novo (a sessão com acesso)
Roteiro técnico completo: `docs/PLANO-GO-LIVE-M1.md` (itens A a I). Resumo e critérios do MVP:
- [ ] **[A]** Migrar a conta Oracle para **Pay As You Go**; dar o acesso à VPS numa sessão.
- [ ] **[C]** **Só leitura primeiro**: mapear o que roda hoje (n8n e nginx) sem alterar nada.
- [ ] **[C]** **Backups antes de mexer**: disco de boot, workflows do n8n, volume e **chave de cifra do n8n** (`N8N_ENCRYPTION_KEY`).
- [ ] **[C]** Subir em projeto Docker **separado** do n8n: app, worker, agendador, Supabase self-hosted, Redis e WAHA, com limites de
      memória; `nginx` só **acrescenta** os hosts novos (`nginx -t` e `reload`, nunca `restart`).
- [ ] **[C]** Banco novo: aplicar o `baseline.sql`, criar o dono (`bootstrap-owner`), **chaves novas**, conferir o isolamento entre empresas.
- [ ] **[C]** **Backup diário** (`pg_dump` + mídia + chaves) para **fora** da VPS, com **um teste de restauração**.
- [ ] **[C]** Monitor externo de queda (CRM e webhook do n8n) e e-mail transacional funcionando.
- **Critério de saída:** o CRM abre no endereço novo, o n8n **continua intacto** (lead de teste chega no Excel), o backup roda e foi
  restaurado uma vez com sucesso.

---

## Fase 4 — Subir a M1 (dados, clientes e conexões)
- [ ] **[A+C]** **Conteúdo e processos da M1:** recarregar as páginas de estratégia, ofertas e imagens (o conteúdo real da M1 que está no
      ambiente de teste). Antes de apagar o banco de teste, **exportar só o que vale**.
- [ ] **[A]** Criar as **empresas dos clientes atuais** (processo da fase 1.1), com dono, equipe e cor; **cronograma e metas** de cada um.
- [ ] **[A+C]** **Meta Ads:** conectar as contas de anúncio de cada cliente; conferir investimento e leads nos dashboards.
- [ ] **[A+C]** **Google Agenda:** conectar (com o app verificado ou com os usuários de teste).
- [ ] **[C]** **n8n → CRM:** acrescentar, no fluxo que já recebe os leads, **um ramo em paralelo** (HTTP Request com "continuar em caso de
      erro") para o CRM. Primeiro numa empresa de teste, depois **um cliente por vez**. O Excel nunca para.
- [ ] **[A+C]** **WhatsApp:** conectar o número da M1 (e o de cada cliente que for usar); testar receber e enviar.
- [ ] **[A]** **Modelos prontos** de automação ligados em modo simples (tarefas e tags): primeiro contato, lead sem resposta, follow-up de
      quem compareceu, reativar perdido, **Anti-No-show** (rascunho aprovado em `docs/MODELO-ANTI-NO-SHOW-M1.md`).
- **Critério de saída:** lead novo de uma campanha real aparece no CRM **e** no Excel, o investimento do Meta aparece no dashboard e
  uma mensagem de WhatsApp vai e volta.

---

## Fase 5 — Operação solo (2 a 8 semanas)
**Meta: fechar 1 cliente usando o CRM** e deixar o produto à prova de uso real.
- **Rotina diária do Arthur:** abrir o Início (Pendentes, Minha agenda); tratar os leads novos; ligar/mandar mensagem; marcar reuniões;
  registrar o resultado; conferir o painel.
- **Rotina semanal:** revisar campanhas e a Visão geral de cada uma; preencher a **autoavaliação** da semana; ver o histórico.
- **Diário de problemas** (um lugar só, com print e "o que esperava"): o Claude corrige **na causa**, no mesmo dia quando possível.
- **Revisão a cada 2 semanas** (30 min): o que travou, o que ninguém usou, o que faltou. Decide o que entra nas próximas frentes.
- **Critérios de sucesso do MVP:**
  1. **1 cliente novo fechado** com o funil e a agenda do CRM;
  2. **nenhum lead perdido** (tudo que chegou pelo n8n está no CRM e no Excel);
  3. **nenhuma queda sem aviso** e **backup restaurado com sucesso** pelo menos uma vez;
  4. **lista de erros zerada** (ou só com itens de baixa gravidade).
- **Só depois disso** se abre para outros clientes, com o piloto do `docs/PLANO-GO-LIVE-M1.md` (fase 4 desse plano).

---

## Fase 6 — Em paralelo (não bloqueia o MVP)
Ordem sugerida, ajustável a cada revisão de 2 semanas. Cada uma tem plano próprio no `docs/PLANO-M1.md`:
1. **Visões da equipe** (Super Adm, Adm e Membro) e **aba multi-tenant (ADM)** — pré-requisito para abrir para outros clientes.
2. **Dashboard Comercial** (funil, follow-ups, no-show, conversão reunião → venda, ticket médio).
3. **Central de avisos e notificações** (inclui o push no celular).
4. **App no celular** com atualização ao vivo.
5. **Automações** (proteções, editor visual) → **Agentes de IA** (revisão, treino assistido) → **IA nas automações**.
6. **Financeiro completo**, **módulos por nicho**, **Conexões e Webhooks** (limpeza).

---

## Riscos e como evitar
| Risco | Como evitamos |
| --- | --- |
| **O n8n cair** e os leads pararem | Intocável até o fim; instalação em projeto separado; backups; monitor do webhook; teste de lead depois de cada passo |
| **Perder dados reais** | Banco novo com backup diário **para fora** da VPS e restauração testada; chaves guardadas fora; cópia do repositório |
| **Apagar algo que fazia falta** | Limpeza só com lista aprovada, em lotes pequenos, com testes e backup do código (o GitHub guarda o histórico) |
| **Banco de teste com chaves expostas em chat** | Banco novo com chaves novas; o de teste é descartado |
| **Conta Oracle gratuita recolhida por ociosidade** | Pay As You Go (continua gratuito dentro do limite) |
| **WhatsApp banido** | Números novos aquecidos, volume baixo no começo, janela de envio e opt-out (já existem), sem disparo em massa no MVP |
| **Querer fazer tudo ao mesmo tempo** | O MVP é só: empresas, CRM, campanhas, agenda e n8n. O resto fica na fase 6 |

## O que o Claude faz já, sem esperar (próximas ações)
1. Corrigir o **convite de equipe e a criação de conta** (1.1/1.4).
2. Escrever o **guia curto de cada tela do `/admin`** para o Arthur revisar (1.2).
3. Gerar o **inventário do que pode sair** (2.1), para aprovação.
