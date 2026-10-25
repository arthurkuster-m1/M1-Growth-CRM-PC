# Plano — Agenda: visual estilo Google Agenda (frente 10)

Registro do que o Arthur pediu em 26/10/2026 e do que foi feito. As pendências seguintes da Agenda
entram aqui, com a mesma estrutura.

## 1. Pedidos de 26/10/2026

1. **Tirar a lista** "Próximos / Aguardando confirmação / Passados / Cancelados" e começar direto
   na agenda (o Início já cumpre essa função).
2. **Visualização parecida com a do Google Agenda**; **menu de visões** (botão que abre as opções)
   com **Dia, 3 dias, Semana e Mês**, em vez da barra.
3. **Horários indisponíveis em cinza**; livres em branco (como hoje); preenchidos com a aba do
   compromisso.
4. **Celular:** visões de dia, 3 dias, semana e mês parecidas com o Google Agenda (5 prints de
   referência).

## 2. Feito (no código, aguardando teste na tela)

| Pedido | Como ficou                                                                                                                                                                                                                                                                                                |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | `HistoricoDaAgenda` e o painel de cancelar saíram de `app/app/agenda/_client.tsx`; a página abre na grade. Remarcar/cancelar/resultado seguem na página do compromisso.                                                                                                                                   |
| 2      | Botão com a visão atual ("Semana ▾") abre Dia, 3 dias, Semana, Mês — no celular e no computador. A visão "3 dias" começa no dia escolhido; as setas andam 3 dias.                                                                                                                                         |
| 3      | Células de horário que não estão na disponibilidade do tipo escolhido (fora da jornada, ocupadas, passadas) ficam cinza; as livres ficam brancas e clicáveis. Nada fica cinza enquanto os horários ainda carregam. **Só aparece para quem pode marcar** (a grade de quem só lê não consulta os horários). |
| 4      | Dia, 3 dias e semana mostram TODAS as colunas no celular (antes a semana mostrava um dia só); cabeçalho do dia empilha sigla e número; o mês mostra até 3 faixas coloridas por dia.                                                                                                                       |

### Ajuste do celular (26/10/2026, 2º pedido)

- O topo do celular fica só com **Novo agendamento**, **Hoje** (setas e período) e o botão da **visão**;
  sem título nem subtítulo; o calendário começa logo abaixo.
- O botão **Sincronizar com Google** passa, no celular, para o cartão "Agenda conectada" no **fim da
  página**, embaixo de "Configurar suas agendas" e "Desconectar". No computador continua no topo.
- O **filtro de pessoas** (decisão revista no mesmo dia: **fica**) aparece no celular numa linha própria, logo abaixo do Hoje/visão e antes da agenda.

### Visão Mês no computador (26/10/2026, 3º pedido)

- A **ocupação vinda do Google fora de 07h–18h** (rotina pessoal: acordar, treino…) **não aparece** no mês. Compromissos nossos aparecem a qualquer hora.
- Tudo em **ordem cronológica** (antes o das 9h aparecia antes do das 5h).
- **Clicar numa faixa abre o compromisso** (a ocupação do Google não abre).
- **Duplo clique num dia** (de hoje em diante) abre o novo compromisso naquele dia, às 9h (a pessoa ajusta na janela). Duplo clique numa faixa não cria nada.
- A janela de 07h–18h vale só para o **mês**; semana/dia já desenham de 07h a 21h.

## 3. Decisões e limites

- A lista saiu da página, mas o componente `HistoricoDaAgenda` fica (vitrine e testes) até o
  **Fechamento do projeto** (PLANO-M1 §4), quando sai junto com as 4 entradas de `JUSTIFICADOS` em
  `tests/unit/controle-decorativo.test.ts`.
- A spec `agenda-remarcar-e-cancelar` foi reduzida: ela provava cancelar/remarcar **pela lista**.
  Cancelar/remarcar pela página do compromisso não tem spec e está no roteiro manual.
- Não provado na tela (sem navegador neste ambiente); o roteiro de testes tem os itens da Agenda.

## 3b. Fora do pedido, a decidir

- Abrir no celular direto no **Dia** (hoje) ou na **Semana**? Hoje: Dia.
- Arrastar para remarcar no celular (toque e segura) — já existe no computador.
- Mostrar a grade cinza também para quem só lê.
- Duplo clique no celular (no mês) — o gesto de dois toques costuma dar zoom; avaliar um toque longo.

## 4. Pendências novas (Arthur vai passando)

_(vazio)_
