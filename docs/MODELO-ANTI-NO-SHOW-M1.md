# Anti-No-show da M1 — RASCUNHO para revisão (sem agente de IA)

Criado em 01/11/2026. **É um rascunho:** nada foi ligado em nenhuma organização. O Arthur revisa, ajusta e aprova; depois
aplicamos (primeiro numa organização de teste). Tudo aqui é **editável por cliente**: o modelo é o ponto de partida.

## O que descobri ao montar (importante)
O Anti-No-show **já existe no app, em três camadas**, e nenhuma delas exige agente de IA. O rascunho abaixo é, portanto, uma
**configuração** dessas camadas, e não um fluxo novo a programar:

| Camada | Onde fica | O que faz | Precisa de agente? |
| --- | --- | --- | --- |
| **A. Lembretes ao lead** | Configurações › Agenda › cada tipo de compromisso | Manda mensagens N minutos antes da reunião, com texto próprio por degrau, e entende a resposta ("1/sim", "2/remarcar", "3/cancelar") | **Não** |
| **B. Fluxo da equipe** | Configurações › Agenda › Anti no-show (por tipo) | Se o lead não confirmou perto da hora, cria a tarefa de **ligar**; marca a tag ao confirmar ou faltar; se faltar, devolve a oportunidade à fila para **remarcar**, em até N tentativas | **Não** |
| **C. Automações** | Automações › modelo "Anti-No-show: recuperar quem faltou" | Ao faltar: tag "faltou" + tarefa de ligar e remarcar hoje | **Não** |

**Limite a conhecer:** o follow-up automático que dispara quando alguém falta (`appointment_no_show`, usado no modelo de clínica
"Falta · remarcar quem não veio") **só roda com um agente de IA publicado armando o fluxo**, mesmo quando o texto é fixo (a
condição está no banco). Por isso a mensagem automática **pós-falta** fica para depois da revisão dos agentes; até lá a
recuperação de quem faltou é por **tarefa para a equipe** (camadas B e C).

## O rascunho

### A. Lembretes ao lead (um tipo de compromisso: "Reunião")
Três degraus. As variáveis que o sistema preenche: `{{primeiro_nome}}`, `{{nome}}`, `{{titulo}}`, `{{tipo}}`, `{{dia}}`, `{{hora}}`,
`{{quando}}`, `{{endereco}}`, `{{link}}`.

| # | Quando | Texto proposto |
| --- | --- | --- |
| 1 | **1 dia antes** (1440 min) | Oi, {{primeiro_nome}}! Passando para lembrar da nossa reunião {{quando}}. Responda *1* para confirmar, *2* para remarcar ou *3* para cancelar. Link: {{link}} |
| 2 | **3 horas antes** (180 min) | {{primeiro_nome}}, a nossa reunião é hoje às {{hora}}. Ainda consegue? Responda *1* para confirmar ou *2* para remarcar. Link: {{link}} |
| 3 | **30 minutos antes** (30 min) | {{primeiro_nome}}, começamos em 30 minutos, às {{hora}}. Estamos te esperando! Link: {{link}} |

Regras do sistema que valem aqui (já existem): a resposta só conta se for **curta e começar** com a intenção (errar para o lado
de não agir é mais seguro que cancelar a reunião de alguém por engano); "2" ou "remarcar" marca o pedido de remarcação para
a equipe; "3" ou "cancelar" cancela. Piso de 15 min por degrau.

### B. Fluxo da equipe ("Anti-No-show M1", ligado ao tipo "Reunião")
| Campo | Valor proposto | Por quê |
| --- | --- | --- |
| Ligar se não confirmou | **2 horas antes** | Depois do lembrete de 3 h e antes do de 30 min, dá tempo de ligar |
| Tag ao confirmar | **Confirmou** | Padrão do sistema |
| Tag ao faltar | **No Show** | Padrão do sistema |
| Remarcar: primeira tentativa | **1 dia útil** depois da falta | Padrão do sistema |
| Tentativas de remarcar | **3** | Padrão do sistema |
| Intervalo entre tentativas | **2 dias úteis** | Padrão do sistema |

Cada tentativa vira uma tarefa na oportunidade: "Remarcar a reunião (faltou) — tentativa 2 de 3".

### C. Automação de apoio (já disponível em Automações › Modelos prontos)
"**Anti-No-show: recuperar quem faltou**": ao faltar, marca a tag "faltou" no contato e cria a tarefa **"Ligar e remarcar a reunião"
para hoje**, para o dono do lead. Se preferir só uma das duas (B ou C) para não duplicar tarefa, é só ligar uma e deixar a outra
pausada: **eu sugiro ficar com a B** (tem as tentativas) e usar a C só em clientes que não usam o fluxo da Agenda.

## O que o Arthur precisa decidir (rápido, só marcar)
1. Os **3 horários** (1 dia, 3 h, 30 min) estão bons? Quer um 4º (por exemplo, "agora", logo ao agendar)?
2. Os **textos** estão no tom da M1? Quer mais formal ou mais direto? Mantemos o "1/2/3" para responder?
3. Ligar **2 h antes** se não confirmou: ok? Quem recebe a tarefa (o dono do lead)?
4. Remarcar: **3 tentativas** a cada **2 dias úteis** são suficientes?
5. Aplicamos primeiro numa **organização de teste** (recomendado) antes do primeiro cliente real?

## Como aplicar depois da aprovação
- **Hoje, à mão:** Configurações › Agenda › tipo "Reunião" › Lembretes (adicionar os 3 degraus e os textos) e Anti no-show (criar o
  fluxo e ligar ao tipo). Leva uns minutos e já é editável.
- **Melhor, em um clique (a construir se aprovado):** um botão **"Aplicar o modelo Anti-No-show da M1"** nesses dois lugares,
  que preenche tudo isto para o tipo escolhido, sem ligar nada sozinho e sem mensagem para ninguém até a pessoa salvar.

## Depois (fase 7, com IA)
Mensagem automática pós-falta (follow-up), entender em texto livre "pode ser semana que vem?", e remarcação conversada. Entram
quando os agentes estiverem revisados (`docs/PLANO-AGENTES-M1.md`).
