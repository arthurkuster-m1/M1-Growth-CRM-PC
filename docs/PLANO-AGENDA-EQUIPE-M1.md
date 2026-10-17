# Agenda com vários atendentes: tipos, horários e distribuição

Documento de desenho. **Nada aqui foi aplicado.** Escrito em 16/10/2026, a pedido do Arthur. A migration só entra com o "pode aplicar" dele.

## 1. O pedido

Uma equipe de cinco atendentes tem **cinco agendas**: às 10h de segunda há cinco vagas, uma de cada pessoa. Tudo isso deve ser configurado **dentro da Agenda** (no fim da página):

1. quantos atendentes fazem reuniões;
2. **quais tipos de atendimento** cada um faz;
3. **quais horários** cada um atende.

## 2. Como é hoje (medido no banco e no código)

| Peça | Situação |
|---|---|
| `attendant_availability` | **Uma jornada por pessoa** (`schedule.windows`: dia da semana, início, fim; fuso). Vale para tudo que a pessoa atende. Já editável em Equipe › Atendimento e agora dentro da Agenda. |
| `calendar_event_types.default_owner_user_id` | **Um** responsável por tipo. É a única ligação entre pessoa e tipo. |
| Horários livres (`horariosLivresDaOrg`) | Calcula **por responsável**: sem `owner_user_id` usa o responsável do tipo. Sem responsável, recusa (`sem_responsavel`). |
| Marcar | Humano pode marcar fora da grade (sem choque); IA e integrações só em horário publicado. |
| Hoje na empresa | 1 membro, 3 tipos, todos com o mesmo responsável. |

Consequência: com cinco atendentes, só dá para marcar na agenda de **uma** pessoa por tipo, ou escolher a pessoa à mão sem saber se ela faz aquele tipo.

## 3. Modelo proposto

### 3.1 Quem faz o quê (nova tabela)

`calendar_event_type_attendants`

| Coluna | Para quê |
|---|---|
| `organization_id`, `event_type_id`, `user_id` | chave (uma linha por pessoa e tipo) |
| `priority` (int, menor = primeiro) | desempate na distribuição |
| `is_active` | pausar a pessoa num tipo sem apagar |
| `created_at` | |

- RLS: leitura para `agent`+, escrita para `manager`+ (mesma régua dos tipos).
- **Preenchimento inicial:** uma linha para cada tipo que hoje tem `default_owner_user_id`. Nada muda para quem já usa.
- `default_owner_user_id` continua existindo como "responsável preferido" (e fallback).

### 3.2 Horários

**Decisão 2 (abaixo).** Duas formas:

- **A (recomendada para começar):** uma jornada por pessoa (como hoje). Vale para todos os tipos que ela faz. Simples e já editável.
- **B (depois, se precisar):** jornada própria por pessoa **e tipo** (tabela `calendar_attendant_type_hours`), para quem atende "Reunião de vendas" só de manhã e "Consulta" só à tarde.

### 3.3 Escolher o atendente ao marcar

Ao marcar, o responsável pode ser:

1. **Uma pessoa específica** (como hoje). O calendário mostra só os horários livres dela, e só se ela faz aquele tipo.
2. **Qualquer atendente do tipo.** O calendário mostra a **união** dos horários livres de todos os atendentes do tipo (às 10h de segunda: livre se alguém estiver livre) e o sistema escolhe quem atende por uma regra de distribuição.

Regra de distribuição (**decisão 1**):

| Opção | Como escolhe |
|---|---|
| Menos carregado | quem tem menos compromissos naquele dia (desempate pela prioridade) |
| Revezamento | roda entre os atendentes livres, na ordem de prioridade |
| Prioridade | sempre o primeiro livre da lista |

### 3.4 Interação com a oportunidade

O responsável sugerido continua sendo o da oportunidade, depois o do relacionamento. Se essa pessoa **não faz o tipo escolhido**, a tela avisa e oferece "qualquer atendente" ou outra pessoa. Quem marca pode trocar sem mexer no CRM (já funciona assim).

### 3.5 IA e integrações

Hoje a IA recusa se o tipo não tem responsável. Com a tabela, ela passa a oferecer a união dos horários dos atendentes do tipo e marcar pela mesma regra de distribuição.

## 4. Telas (dentro da Agenda, no fim da página)

Aba **Atendentes e horários** da Configuração da Agenda, com:

1. **Tabela pessoas × tipos:** uma linha por atendente, uma coluna por tipo, caixas para marcar "faz este tipo". Ao lado, a prioridade.
2. **Jornada de cada atendente:** o editor de horários que já existe (dias, início, fim), aberto na própria linha.
3. **Regra de distribuição** da empresa (a decisão 1).
4. **Resumo:** "Reunião: 5 atendentes, 40 vagas por semana."

## 5. Mudanças técnicas

| Camada | Mudança |
|---|---|
| Migration 0649 | Tabela `calendar_event_type_attendants` + RLS + preenchimento inicial + `fn_atendentes_do_tipo(org, tipo)`; coluna em `organizations.settings` (regra de distribuição, sem migration). Manifest e ensaio em rollback. |
| `lib/agenda/consulta.ts` | `horariosLivresDaOrg`: sem `owner` e tipo com vários atendentes, une as vagas e devolve, em cada vaga, quem está livre. Com `owner`, confere se a pessoa faz o tipo. |
| `_handler.ts` (marcar) | `owner_user_id` ausente ou "qualquer": escolhe pela regra, dentro da transação, revalidando o horário. |
| `GET /horarios-livres` | Parâmetro `owner_user_id=qualquer`; resposta ganha `livres_por_slot`. |
| Formulário do compromisso | Seletor do responsável ganha "Qualquer atendente do tipo" e avisa quando a pessoa não faz o tipo. |
| Configuração da Agenda | Tabela pessoas × tipos, prioridade e regra de distribuição. |
| Dashboards | Atendimento e Agenda: comparecimento e conversão por atendente (já existe por responsável). |

## 6. Fases

| Fase | Entrega | Migration | Risco |
|---|---|---|---|
| **1** | Tabela, tela pessoas × tipos, filtro: só atendentes do tipo aparecem como responsável | sim (0649) | baixo |
| **2** | "Qualquer atendente": união das vagas + distribuição | não | médio (concorrência: duas pessoas marcando a mesma vaga; resolvido revalidando na transação) |
| **3** | IA e integrações marcando pela regra | não | médio |
| **4** | Jornada por pessoa **e** tipo; folgas e exceções por pessoa | sim | médio |

## 7. Riscos

- **Corrida:** dois atendentes (ou a IA) marcam o mesmo horário para a última pessoa livre. A escolha do atendente e a checagem de choque precisam acontecer juntas, na mesma transação (a checagem atual é "ler e depois gravar").
- **Google:** cada atendente tem a própria conta Google conectada; "qualquer atendente" só deve considerar quem tem a agenda sincronizada, senão o horário pode estar ocupado no Google dela sem o app saber. A tela deve mostrar quem está sem Google conectado.
- **Quem deixa a equipe:** a pessoa revogada sai da lista; compromissos futuros dela precisam ser redistribuídos (já existe a troca de responsável por compromisso).

## 8. Decisões que preciso do Arthur

1. **Distribuição** (3.3): menos carregado, revezamento ou prioridade? *(sugestão: menos carregado)*
2. **Horários** (3.2): uma jornada por pessoa (A) é suficiente para começar, ou já precisa por pessoa e tipo (B)?
3. **Marcar sem escolher pessoa:** o padrão do formulário deve ser "qualquer atendente do tipo" ou o responsável da oportunidade (com opção de trocar)? *(sugestão: o da oportunidade, como hoje, com "qualquer atendente" a um clique)*
4. **Quem configura:** só gerentes e acima (como hoje)?
5. **Atendente sem Google conectado** entra na distribuição? *(sugestão: sim, avisando)*

## 9. Decisões fechadas (17/10/2026)

1. Distribuição ao "qualquer atendente": **menos carregado no dia**; empate pela prioridade.
2. Horários: **uma jornada por pessoa** (a de hoje).
3. Padrão ao marcar: **o responsável da oportunidade**, com "qualquer atendente" a um clique.
4. Quem configura: **só gerentes e acima**.
5. Atendente sem Google conectado **entra** na distribuição, **com aviso**.

### Os dois sentidos (pedido do Arthur)
- **Escolho o responsável:** o calendário mostra só os dias e horários livres dele (já no ar).
- **Escolho o horário:** a tela mostra só os atendentes do tipo que estão livres naquele horário (com a carga do dia e o aviso de Google), e "qualquer atendente" escolhe o menos carregado.

### Google por atendente
- Cada atendente conecta o próprio Google; os compromissos em que ele é o responsável aparecem na agenda pessoal dele.
- **Trocar o responsável** tira o evento da agenda do Google do anterior e cria na do novo. Sem Google conectado, o compromisso fica só na agenda do app.

## 10. Andamento (17/10/2026)

- Migration `0649_atendentes_por_tipo` escrita e **ensaiada em rollback** (3 linhas preenchidas a partir dos responsáveis atuais, RLS e idempotência conferidas). **Não aplicada.** O código funciona sem ela (cai no responsável do tipo).
- **Publicado no código:** biblioteca da equipe (`lib/agenda/equipe.ts`); `GET /agenda/atendentes-livres` (escolhi o horário, quem está livre); `GET /horarios-livres?owner_user_id=qualquer` (união dos horários, cada um com quem está livre); `GET/PUT /agenda/atendentes-do-tipo` (matriz, só gerente grava); marcação com `distribuir` (menos carregado no dia entre os livres); formulário de novo compromisso com os dois sentidos e avisos (não faz o tipo, não está livre, sem Google); página do compromisso com a lista de responsáveis filtrada (atendentes do tipo livres naquele horário); matriz pessoas × tipos na Configuração da Agenda.
- **Google ao trocar o responsável:** apaga o evento da agenda do anterior e cria na do novo; sem Google no novo, só no app; se o Google não deixar remover, avisa para apagar à mão.
- Falta: aplicar a migration 0649 (aguarda o "pode aplicar"); marcação pela IA e por integrações usando a mesma distribuição (fase 3).
