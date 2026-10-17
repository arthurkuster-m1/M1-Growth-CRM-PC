# Mapeamento da Agenda (M1) — o que existe, o que falta, e o plano

Documento de planejamento. **Nada aqui foi aplicado.** Escrito em 15/10/2026, a partir da leitura do código, do banco de produção (somente leitura) e do servidor. Pedido de origem: as 8 necessidades do Arthur para a Agenda.

## 1. Resumo em 10 linhas

1. O **motor de agendamentos já é grande e maduro**: horários livres, tipos, jornada, exceções, Google Agenda nos dois sentidos, Meet, lembretes, confirmação de presença e recuperação de falta. Não é para reescrever.
2. **Mas quase nada disso roda hoje neste servidor.** Os "crons" (rotinas) da Agenda, do Google, dos lembretes, do follow-up e do `event_log` **não têm agendador** na VPS: só existem timers para vendas recorrentes, tarefas repetidas, campanhas Meta e o deploy. Ver seção 3 (achado crítico).
3. A conexão com o Google está "saudável", mas **nunca sincronizou** (`last_sync_at` vazio em todos os 5 calendários). Os 2 compromissos que existem estão cancelados e nunca foram para o Google.
4. O compromisso é ligado ao **contato**, não à **oportunidade**. Hoje o sistema escolhe sozinho "o negócio ativo do contato"; com várias oportunidades por pessoa isso passa a ser ambíguo (e a atividade simplesmente não nasce).
5. Evento criado no Google **por fora do app** vira só **bloco de ocupado** (impede marcar), não vira compromisso no app, sem lead, sem métrica.
6. **Não existe** fluxo de confirmação **antes** do compromisso (anti no-show) com tratamento da resposta do lead. Existe lembrete de mão única (desligado nos 3 tipos) e a presença **depois** do compromisso.
7. **Não existe** subpágina de análises da Agenda (comparecimento, conversão, por atendente).
8. Compromissos aparecem na Agenda e no Início; **não** aparecem na ficha do lead, no painel da oportunidade nem em Atendimento/Tarefas.
9. O CRM e as campanhas já leem eventos de agenda (agendamento, reunião feita); consertar a Agenda conserta esses números.
10. Recomendação: começar pelo **passo 0 (fazer os crons rodarem)**, que destrava Google, lembretes, follow-ups e Meta CAPI — e que precisa da sua decisão antes, por causa do backlog (seção 3).

## 2. Inventário do que existe

### Banco (tabelas da Agenda)

| Tabela | Papel | Linhas hoje |
|---|---|---|
| `calendar_appointments` | o compromisso (status, dono, contato, conversa, Google, Meet, desfecho, revisão) | 2 (ambos cancelados) |
| `calendar_event_types` | tipos de agendamento (duração, buffers, aviso mínimo, lembretes, preço) | 3 (Atendimento, Consulta, Reunião) |
| `attendant_availability` + `calendar_availability_exceptions` | jornada e exceções do atendente | 1 / 0 |
| `calendar_connections` + `calendar_connection_calendars` | conta Google e os calendários (fontes que contam como conflito, destino) | 1 / 5 |
| `calendar_external_events` + `calendar_selected_external_events` | cache dos eventos do Google (só o suficiente para saber "ocupado") | 0 / 0 |
| `calendar_locations` | endereços reutilizáveis | 0 |
| `appointment_recovery_receipts` | recibo da recuperação de falta | 0 |
| `crm_lead_links` (`target_kind` do agendamento) | liga compromisso ↔ negócio (muitos para muitos) | — |

Status do compromisso: `pending`, `confirmed`, `cancelled`, `completed`, `no_show`. Reagendar mantém `confirmed` com outro horário (a transição `rescheduled` existe só para a linha do tempo).

### Código

- **API** `app/api/v1/agenda/*`: `agendamentos` (+ `[id]`, `google/retry|resolver|meet`), `horarios-livres`, `tipos`, `pessoas`, `excecoes`, `enderecos`, `configuracao`, `google/connect|callback|calendarios|desconectar`.
- **Rotinas** `app/api/v1/cron/*`: `agenda-google-sync`, `agenda-google-push`, `agenda-google-refresh`, `agenda-reminder`, `agenda-expira-pendentes`, `followup-flow-worker`, `event-log-drain` (e mais 30).
- **Biblioteca** `lib/agenda/*` (~9,5 mil linhas): disponibilidade (`horarios-livres`, `ocupados`, `ocupacao-externa`), laço de retorno (`laco`: o que vira linha do tempo), lembretes, proteção do follow-up, Google (`lib/agenda/google/*`: OAuth, executor de sync em três vias, conflitos, claims/CAS, Meet).
- **Telas**: `/app/agenda` (grade, painel de marcação, detalhe do compromisso, histórico, sincronização, Meet), Configurações › Agenda (tipos, jornada, prazos de presença, agendas conectadas).
- **Ponte com o CRM**: `lib/leads/appointment-stage-move.ts` move o card para a etapa de slug `agendamento-solicitado` / `agendado` (só se o funil tiver a etapa); a atividade `appointment_scheduled|rescheduled|cancelled|completed|no_show` entra na linha do tempo do lead.
- **Gatilhos de automação** emitidos: `appointment.confirmed|cancelled|completed|no_show|rescheduled` (regras, webhooks e follow-ups consomem).
- **Presença**: declaração **humana** depois do compromisso (`PrazosDePresenca`: pedir confirmação X min após o fim; nunca presume falta). Falta confirmada dispara a **recuperação** (follow-up `appointment_no_show`).

### Onde o compromisso aparece hoje

| Lugar | Aparece? |
|---|---|
| Agenda (grade/lista) | sim |
| Início (calendário da semana) | sim (agenda + prazos de tarefas) |
| Ficha do lead › Visão geral | **não** |
| Ficha do lead › Atendimento e Tarefas | **não** (só tarefas) |
| Painel da oportunidade | **não** |
| Linha do tempo do lead | sim (como atividade) |
| Dashboards / campanhas | só contagem de atividades (agendamento, reunião feita) |

## 3. Achado crítico: as rotinas não rodam

Evidências medidas hoje:

- Timers da VPS: `m1-vendas-recorrentes`, `m1-tarefas-repetidas`, `m1-campanhas-meta`, `m1-puxar-build`. **Nenhum** para a Agenda, Google, lembretes, follow-up nem `event-log-drain`.
- O `crontab` do root chama `event-log-drain` a cada minuto e um `agent.sh`, mas aponta para `/root/Deskcomm/DeskcommCRM`, **pasta que não existe**. Ou seja, o dreno do `event_log` não roda.
- `event_log` tem **85 eventos pendentes desde 09/10** (23 pagamentos recebidos, 13 mudanças de etapa, 12 "ganhou", 10 reabertos, 5 despachos de agente, 5 tags, 4 perdidos, 4 leads criados…).
- Google Agenda: `status=healthy`, mas `last_sync_at` nulo na conexão e nos 5 calendários; 2 compromissos com `needs_google_push=true`, sem `google_event_id`.

O que isso significa na prática (hoje, não na teoria):

| Capacidade | Estado |
|---|---|
| Compromisso do app aparecer no Google | **não acontece** (push nunca roda) |
| Evento do Google bloquear horário no app | **não acontece** (cache vazio) |
| Lembrete de compromisso | não roda (e os 3 tipos estão com lembrete desligado) |
| Follow-ups e régua de recuperação | não rodam |
| Regras de automação e webhooks por evento | ficam na fila |
| Meta CAPI de pagamento/mensalidade | fica na fila (provavelmente nunca enviou) |

**Risco de ligar:** ao ligar o dreno, os 85 eventos antigos são processados de uma vez (regras, webhooks, CAPI, possivelmente mensagens). Antes de ligar, é preciso decidir: **descartar o backlog de teste** ou **processar**. Eu recomendo descartar o backlog (são testes) e então ligar.

## 4. Requisito a requisito

Legenda: ✅ existe · 🟡 existe em parte · ❌ falta.

| # | Necessidade | Situação | Evidência e o que falta |
|---|---|---|---|
| 1 | Sincronizar com o Google e não deixar marcar em horário ocupado | 🟡 | Código completo: a marcação recusa horário que cruza com outro compromisso **ou com evento do Google** (`handler` ~l.921) e a grade desenha a ocupação. **Não funciona hoje** porque a sync nunca rodou (seção 3). Falta: agendador + backfill + teste ponta a ponta com o Google real. |
| 2 | Campo de compromissos no painel da oportunidade (ver agendados + criar) | ❌ | O painel não lê agenda. Falta: lista de compromissos da oportunidade (próximo/atrasado) + "Novo compromisso" pré-preenchido com cliente e oportunidade. |
| 3 | Google → app e app → Google | 🟡 | App → Google: ✅ (push, três vias, conflito). Google → app: **só como bloco de ocupado**; o evento criado no Google não vira compromisso (sem contato, sem desfecho, sem métrica). Falta: importar eventos (opcional por calendário) como compromisso "externo". |
| 4 | Fluxo anti no-show (confirmação antes) | 🟡 | Existe lembrete de mão única (templates por tipo, múltiplos degraus, janela de envio) e presença **depois**. **Não existe** gatilho "X horas antes do compromisso" no motor de follow-up (os gatilhos são: caso aberto, fim de conversa, silêncio, lead criado, mudança de etapa, webhook, manual, falta confirmada) e nada que trate a **resposta** do lead (confirmo / remarcar / cancelar). Falta: gatilho relativo ao horário + nós de resposta + efeito no compromisso (confirmar/remarcar/cancelar) + escalonamento para humano. |
| 5 | Todo compromisso atrelado a uma oportunidade → campanha → métricas | 🟡 | O vínculo é com o **contato**; o negócio é inferido (`leadAtivoDoContato`) e, com várias oportunidades, vira `ambiguous_open_leads` (a atividade não nasce). Existe `crm_lead_links` para o muitos-para-muitos. Falta: oportunidade **explícita** no compromisso (campo `lead_id` e escolha no painel), regra de desambiguação e leitura das métricas por essa chave. |
| 6 | Taxa de comparecimento + subpágina de análises na Agenda | ❌ | Há `completed`/`no_show` e eventos, mas nenhum cálculo nem tela. Falta: consulta agregada (agendados, compareceram, faltaram, remarcados, cancelados; por tipo, atendente, campanha, período; conversão compromisso → venda) e a subpágina. |
| 7 | Compromissos em: agenda, início, visão geral do lead, painel da oportunidade, Atendimento/Tarefas | 🟡 | Agenda e Início ✅. Faltam: ficha › Visão geral, ficha › Atendimento e Tarefas (ver e **agendar**), painel da oportunidade. Reaproveitar o painel de marcação (`PainelDeMarcacao`) e a lista (`consulta.ts`). |
| 8 | Vincular por `lead_id`, senão por e-mail ou telefone (inclusive evento criado no Google) | 🟡 | Hoje: só por `contact_id` informado na marcação. Há `guest_email` espelhado no evento publicado. Falta: resolução de contato **no import do Google** (convidados → e-mail; telefone na descrição/título; regra de desempate e fila "sem lead" para revisão). |

## 5. Modelo-alvo (proposta)

**Compromisso = fato da agenda, ligado a uma oportunidade (e, por ela, ao cliente, campanha e métricas).**

- `calendar_appointments.lead_id` (oportunidade, opcional) e `contact_id` (cliente). Regra de preenchimento, em ordem: (1) `lead_id` informado; (2) contato informado → oportunidade aberta **única**; com mais de uma, o painel **pergunta**; (3) evento do Google → e-mail do convidado → telefone → "sem lead" para revisão.
- Origem do compromisso: `ui`, `ia`, `google` (novo), `link público`.
- **Desfecho** continua humano (`completed`/`no_show`), com o carimbo de quem declarou.
- **Métricas** saem de uma única consulta (`agendados`, `confirmados`, `compareceram`, `faltaram`, `remarcados`, `cancelados`, tempo até o compromisso) filtrável por tipo, atendente, campanha, período — a mesma que alimenta Funil completo, Dia a dia e a subpágina de análises.

## 6. Plano em passos (cada migration ensaiada em rollback; só aplico com o seu "pode aplicar")

| Passo | Entrega | Migration | Risco |
|---|---|---|---|
| **0** | Fazer as rotinas rodarem (timers de agenda/Google/lembrete/follow-up/event-log) + decisão sobre o backlog de 85 eventos | não | **alto** se ligar sem descartar o backlog; baixo depois |
| **1** | Google funcionando de ponta a ponta (sync, ocupado, push) e validado com a sua conta | não | médio (depende do Google real) |
| **2** | Compromisso ↔ oportunidade explícita (`lead_id`, regra de desambiguação, painel pergunta qual) e backfill dos 2 existentes | sim | médio |
| **3** | Compromissos nos lugares: painel da oportunidade, ficha (Visão geral, Atendimento e Tarefas), com "Novo compromisso" | não | baixo |
| **4** | Importar eventos do Google como compromissos + resolução por lead/e-mail/telefone + fila "sem lead" | sim | médio-alto |
| **5** | Métricas: consulta única + subpágina de análises (comparecimento, conversão, por atendente/tipo/campanha) e ligação com os dashboards | não (ou índice) | baixo |
| **6** | Fluxo anti no-show: gatilho relativo ao horário no motor de follow-up, resposta do lead (confirmo/remarcar/cancelar), escalonamento humano, modelo de fluxo pronto | sim | médio |

Ordem recomendada: 0 → 1 → 2 → 3 → 5 → 4 → 6. Os passos 3 e 5 dão valor visível rápido; o 4 e o 6 são os mais delicados e vêm depois de a base estar medida.

## 7. Decisões que preciso de você

1. **Passo 0:** descarto os 85 eventos antigos (testes) e ligo as rotinas? Ou prefere revisar o que está na fila antes?
2. **Importar eventos do Google (passo 4):** todos os calendários marcados como "conta para conflito", ou só o calendário destino (Assessoria M1)? E eventos "sem convidado" entram como compromisso ou só ocupam o horário?
3. **Lembretes e confirmação de presença:** os 3 tipos hoje estão com lembrete desligado. Quais tipos devem ter o fluxo anti no-show, e com que degraus (por exemplo 24h e 2h antes)?
4. **Quem confirma a falta:** continua sendo sempre humano (como está), ou a falta pode ser presumida depois de um prazo?
5. **Compromisso sem oportunidade:** para um cliente sem nenhuma oportunidade, o compromisso cria uma oportunidade nova ou fica só no contato?

## 8. Estado em 17/10/2026

Passos 0 a 6 entregues (rotinas, Google, compromisso ↔ oportunidade, importação, análises, anti no-show). Depois: página única do compromisso, "Novo agendamento" unificado, seletor só de horários livres, Confirmado/Resultado/Excluir, aviso de reunião encerrada, configuração dentro da Agenda e botão de sincronizar com o Google. Em andamento: vários atendentes por tipo (`PLANO-AGENDA-EQUIPE-M1.md`).
