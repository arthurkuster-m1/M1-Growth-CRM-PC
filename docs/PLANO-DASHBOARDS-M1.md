# PLANO DOS DASHBOARDS (frente 1)

Atualizado em 14/10/2026 (decisões fechadas e D0 publicado). Três dashboards, uma só base de dados (a do sistema) e um só jeito de
escolher o período. Este documento é o desenho; a execução vem em fases (seção 8).

## 1. O que o HTML "ONE" já faz bem (e o que muda ao trazer para o software)

**Mantemos a ideia e o conteúdo:**
- Cabeçalho com marca do cliente + selo "sincronizado às HH:MM".
- Filtros no topo (campanha, ação, período) — vira o **Seletor de Período** do app + filtros por
  campanha, canal e conta.
- 4 KPIs grandes (Investido, Leads, CPL, Conversão LP) com subtexto de apoio.
- "Funil completo" em grade (Impressões → Cliques → LP → Leads, mais CPC, CP Visita LP, CPL, CPM,
  CTR, Connect Rate, Conversão LP).
- Gráfico de linhas com duas métricas escolhidas (eixo duplo) — o melhor recurso para a conversa
  com o cliente; vira o **gráfico comparativo** de todos os dashboards.
- Funil em SVG animado com CTR / Connect Rate / Conversão ao lado.
- Tabela diária ordenável com total/média no rodapé.

**Muda:**
| No HTML | No software |
|---|---|
| Fonte: planilha do Google publicada (TSV) | Base do sistema: Meta/Google já sincronizados + CRM + vendas. Sem planilha, sem colar link |
| Tema escuro fixo, laranja | Tokens do app (claro/escuro do usuário, cor da marca da empresa) |
| Fontes próprias (Space Grotesk/Inter/JetBrains) | Fonte do app (Montserrat) + números tabulares |
| Chart.js por CDN | Mesmo gráfico, empacotado (sem CDN), cores pelos tokens |
| Um dashboard só (tráfego) | Três, com o mesmo cabeçalho/filtros: **Campanhas · Faturamento · Atendimento** |
| Leads = "resultados" do Meta | Leads **do CRM** (pessoas únicas) — o número que fecha com vendas |
| Sem ligação com venda | Cada campanha/anúncio/LP mostra **vendas e faturamento pago** (origem da venda) |

## 2. Regras comuns (valem nos três)
1. **Um período** para a tela toda (Seletor de Período + "comparar com o período anterior").
2. **Uma definição por número**, escrita no rodapé de cada bloco (como já fazemos em Resultados).
3. **Lead = pessoa única** do CRM. **Venda = venda com algo pago** (mesmo um sinal).
   **Faturamento = parcelas recebidas no período.** **A receber = parcelas previstas.**
4. Clicar num número abre a lista que o compõe (como no Clientes).
5. Cada bloco tem **prazo e meta** (a mesma lógica das metas do cronograma: diário a anual, datas
   livres, atualização automática) — "meta × realizado" aparece como barra no próprio KPI.
6. Visão da agência × visão do cliente: o cliente vê campanhas e faturamento; **custos reais,
   adiamentos e margem** só a agência (e quem a empresa autorizar).

## 3. Dashboard 1 — CAMPANHAS (Meta Ads + Google Ads)

**KPIs do topo (o do HTML + o que fecha com venda):** Investido · Leads (CRM) · CPL · Vendas ·
CAC · Faturamento recebido · ROAS · Lucro (recebido − investido).

**Funil de mídia (igual ao HTML, por canal):** Impressões → Alcance → Cliques no link → Visitas
à LP → Leads → Qualificados (MQL) → Vendas. Taxas entre cada passo (CTR, Connect Rate,
Conversão LP, Lead→MQL, Lead→Venda).

**Métricas diretas das plataformas** (cada uma com origem Meta ou Google):
| Grupo | Meta Ads | Google Ads |
|---|---|---|
| Entrega | Impressões, alcance, **frequência**, CPM | Impressões, **parcela de impressões** (IS), CPM |
| Clique | Cliques no link, CTR do link, CPC | Cliques, CTR, CPC médio |
| Pós-clique | Visitas à LP, Connect Rate, CP visita LP | Taxa de rejeição / sessões (se GA4 ligado) |
| Resultado | Leads (formulário), CPL | Conversões, custo por conversão |
| Qualidade | Classificação de relevância/qualidade (quando a API entrega) | Índice de qualidade das palavras |
| Vídeo | ThruPlay, Hook rate (3s ÷ impressões), Hold rate | — |
| Orçamento | Gasto × orçamento, **pacing** (ritmo do mês) | idem |

**Visões (abas dentro do dashboard):**
1. **Visão geral** — KPIs, gráfico comparativo (2 métricas), funil, tabela diária.
2. **Por campanha** — a tabela de Resultados que já existe, com Canal, Lucro e LTV/CAC.
3. **Por conjunto / anúncio (criativo)** — ranking com miniatura, CTR, CPL, vendas, faturamento.
4. **Por landing page** — visitas, conversão, leads, vendas, faturamento.
5. **Por canal/origem** — Meta × Google × extração × indicação × base (a "fonte" do lead).

**O que mais vale ter (recomendação):**
- **Comparação com o período anterior** em todo KPI (▲▼ %).
- **Alertas visuais**: CPL acima da meta, frequência > 3, pacing fora do ritmo, anúncio sem
  entrega, campanha sem lead há N dias.
- **Qualidade do lead, não só volume**: % MQL, % que respondeu, % que virou venda, **CPL por
  qualificado** e **custo por venda por criativo**.
- **Atraso de atribuição**: leads sem anúncio identificado (já existe o aviso na campanha).
- **Janela de maturação**: vendas de leads de hoje demoram a aparecer — mostrar "vendas dos
  leads deste período (coorte)" além de "vendas no período".

## 4. Dashboard 2 — FATURAMENTO & EMPRESA

**Bloco A — Dinheiro (o que você listou, com a definição que proponho):**
| Pedido | Definição |
|---|---|
| Quando entrou | Faturamento **recebido** por dia/semana/mês (parcelas pagas), por produto, campanha, canal |
| Quando saiu | **Custos** pagos no período (mídia + os custos cadastrados na gestão financeira) |
| Saldo / lucro | Entrou − saiu; **margem** = lucro ÷ faturamento |
| CAC | (Mídia + custos de aquisição) ÷ **clientes novos** no período |
| LTV médio | Receita total (paga + prevista) ÷ clientes com ao menos 1 compra paga |
| **LTV/CAC** | LTV médio ÷ CAC — primeiro com **só mídia** (já dá), depois **CAC real** (com equipe/estrutura, quando houver custos) |
| Ticket médio | Faturamento ÷ vendas pagas |
| Vendas por cliente | Vendas pagas ÷ clientes que compraram |
| Payback do CAC | Meses até o cliente devolver o que custou trazê-lo |
| A receber / previsão | Parcelas previstas (assinaturas incluídas) por mês, próximos N meses |
| Inadimplência | Parcelas vencidas e não confirmadas (valor e %) |
| Recorrência | MRR, churn (assinaturas encerradas), receita recorrente × avulsa |

**Bloco B — Base de clientes:**
| Pedido | Definição |
|---|---|
| Quantos clientes tem | Pessoas com ao menos 1 venda **paga** |
| Ativos na base | Contatos com atividade (mensagem, tarefa, compra) nos últimos **N dias** (N configurável; sugestão 90) |
| Clientes com compras ativos | Clientes com compra paga ou **parcela/assinatura ativa** nos últimos N dias |
| Tempo lead → 1ª compra | Mediana e média dos dias entre a entrada do lead e a 1ª parcela recebida (já existe `primeira compra`) |
| Tempo médio de resposta | O mesmo do dashboard 3 (primeira resposta), aqui como indicador de funil |
| Entrada × saída da base | Leads novos × clientes novos × perdidos/inativos (movimento da base) |

**Bloco C — Dados gerais da empresa:** leads por funil/etapa, taxa de conversão por etapa,
tempo em cada etapa, motivos de perda, ranking de produtos (vendas e faturamento), sazonalidade
(mês a mês, ano a ano), concentração (% do faturamento nos 10 maiores clientes).

**Gestão financeira (fase seguinte):** o cliente cadastra **todos os custos** (equipe, locação,
eventos, ferramentas, impostos, comissões), com categoria, recorrência e centro de custo
(aquisição × operação). Isso alimenta o **CAC real**, o **LTV/CAC real**, a **margem** e o
**ponto de equilíbrio**. Até lá, o dashboard nasce **visual**, com os campos de custo
marcados "depende da gestão financeira" (decisão sua, abaixo).

## 5. Dashboard 3 — ATENDIMENTO

**KPIs do topo:** Conversas iniciadas · Conversas respondidas (% de resposta) · Tempo médio de
primeira resposta · Tempo médio de resposta (ao longo da conversa) · Leads > 24 h sem resposta ·
Leads > 7 dias sem resposta.

| Pedido | Definição |
|---|---|
| Tempo geral | Tempo médio da conversa (abertura → resolução) e tempo até a 1ª resposta |
| Tempo médio de resposta dos atendentes | Por atendente: média e mediana (já existe `avg_first_response_seconds`) |
| Conversas iniciadas | Conversas novas no período (por canal, por dono) |
| Conversas respondidas | Conversas com ao menos 1 resposta humana (ou IA) — e % do total |
| > 7 dias sem resposta | Leads **abertos** cuja última mensagem do lead não foi respondida há +7 dias |
| > 24 horas sem resposta | Idem, +24 h (lista acionável, com botão para abrir o lead) |

**O que mais vale ter:**
- **SLA**: % de primeiras respostas em até 5 min / 1 h / 24 h; **horário de pico** × cobertura da
  equipe (mapa de calor dia × hora) e respostas **fora do horário comercial**.
- **Por atendente**: conversas, resposta, tempo, **conversão** (leads → vendas), tarefas
  feitas/atrasadas, follow-ups cumpridos.
- **IA × humano**: % resolvido pela IA, handoffs, tempo até o humano assumir.
- **Fila**: leads sem dono, sem tarefa, sem próxima ação; **follow-ups vencidos**.
- **Qualidade da abordagem**: primeira abordagem (já temos a data), nº de tentativas até a
  resposta, motivo de perda por atendente.
- **Satisfação** (futuro): nota pós-atendimento.

## 6. Disponibilidade dos dados HOJE
Legenda: ✅ já existe · 🟡 existe em parte / precisa de ligação · ❌ falta dado.

| Bloco | Situação |
|---|---|
| Tráfego Meta (impressões, alcance, cliques, LP, gasto) por dia/campanha/anúncio | ✅ (sincronizado — hoje **bloqueado** até resolver o app no Meta) |
| Frequência, ThruPlay, hook rate, qualidade | 🟡 a Meta devolve; falta gravar |
| Google Ads (gasto, cliques, conversões) | 🟡 conexão existe; falta o sync diário por campanha |
| Leads, MQL, vendas, faturamento por origem | ✅ |
| Lucro, LTV/CAC (só mídia), ROAS, CAC | ✅ (Resultados já tem) |
| LTV médio, ticket, vendas por cliente, clientes ativos | ✅ derivável do que já temos |
| Tempo lead → 1ª compra | ✅ (data de entrada e 1ª compra paga) |
| Previsão / a receber / recorrência | ✅ |
| Inadimplência | 🟡 parcelas vencidas existem; falta o corte "vencida e não confirmada" |
| **Custos da empresa** (equipe, locação, eventos…) | ❌ depende da gestão financeira |
| Tempo de resposta por atendente | ✅ (`fn_attendant_metrics`) |
| Conversas iniciadas/respondidas, > 24 h / > 7 d sem resposta | 🟡 deriváveis das mensagens; falta a consulta pronta |
| SLA, mapa de calor, IA × humano | 🟡 deriváveis; trabalho de consulta |

## 7. Decisões que preciso de você
1. **"Cliente ativo"**: janela de **90 dias**? Conta atividade (mensagem/tarefa) ou só compra?
2. **"Quando entrou / quando saiu"**: saída = só custos cadastrados na gestão financeira
   (o dashboard fica "visual" até lá) — ou já mostramos "saída = investimento em mídia"?
3. **LTV/CAC**: LTV = recebido + previsto (proposto) ou só recebido? CAC = só mídia por ora?
4. **Atendimento**: o relógio de resposta conta só horário comercial? Qual o horário da empresa?
5. **Quem vê o quê**: cliente final vê Campanhas e Faturamento? Atendimento só a agência?
6. **Google Ads**: já está conectado numa conta de teste? Vamos priorizar Meta primeiro e o
   Google na sequência?
7. **Identidade**: manter o laranja do ONE como cor de destaque do **seu** dashboard (marca da
   agência) ou sempre a cor da marca da empresa-cliente?

## 8. Fases
| Fase | Entrega | Depende de |
|---|---|---|
| **D0 — Protótipo visual** | Os 3 dashboards navegáveis, layout final, identidade do software, dados **de exemplo** claramente marcados; tela de configuração de blocos e metas | nada |
| **D1 — Campanhas ao vivo** | Dashboard 1 com Meta + CRM + vendas (dados reais), comparação com período anterior, abas por campanha/anúncio/LP | resolver o bloqueio do app no Meta |
| **D2 — Faturamento ao vivo (sem custos)** | Dashboard 2: entrada, previsão, ticket, LTV, clientes, tempos, LTV/CAC só-mídia | decisões 1–3 |
| **D3 — Atendimento ao vivo** | Dashboard 3 com consultas de resposta, SLA, > 24 h / > 7 d | decisão 4 |
| **D4 — Google Ads** | Sync diário por campanha + visão unificada Meta × Google | conta conectada |
| **D5 — Gestão financeira + CAC real** | Cadastro de custos, margem, LTV/CAC real, ponto de equilíbrio | frente 15 (financeiro) |
| **D6 — Metas e alertas** | Meta × realizado em cada KPI, alertas e resumo semanal (WhatsApp) | D1–D3 |

**Recomendação:** começar pela **D0** (protótipo visual com os três dashboards) — é o que você
descreveu como "projeto inicial só visual" — e, em paralelo, destravar o Meta para a D1.

## 9. Decisões fechadas (14/10/2026) e estado
1. **Cliente ativo** = comprou nos últimos **X meses**; o cliente define X (depende do modelo de negócio). No protótipo: seletor 3/6/12/24 meses.
2. **"Saiu"** = por ora, o **investimento em mídia**; custos reais entram com a gestão financeira.
3. **LTV/CAC** = LTV só **recebido** ÷ CAC só **mídia**, por ora; real depois, no painel financeiro.
4. **Atendimento**: o cliente define o **horário de atendimento**; resposta no prazo = até **1 h após o início do horário comercial**.
5. **Cliente final vê tudo** — o dashboard é para ele.
6. **Meta primeiro**; Google Ads depois (nenhum cliente roda Google hoje). O Meta já foi destravado.
7. **Cor de destaque = a da marca de cada empresa** (token `primary`).
8. **Nomes**: Tráfego Pago · Prospecção Ativa · Business · Atendimento. Começam 3 (Tráfego Pago, Business, Atendimento); Prospecção Ativa fica "Em breve" até o módulo existir.
9. **Business** inclui **MRR e churn** para quem vende por recorrência.

**D0 publicado:** `/app/marketing/dashboards` — os painéis navegáveis com dados de **exemplo**
(marcados na tela). Código em `components/dashboards/`. Próximo: D1 (Tráfego Pago ao vivo).

**D1 publicado (14/10/2026):** Tráfego Pago ao vivo — `GET /api/v1/dashboards/trafego`
(Meta + leads do CRM + vendas e faturamento pagos pela origem da venda; período anterior para as
variações ▲▼; por campanha, anúncio e landing page). Seletor de campanhas (uma, várias ou todas).
Business e Atendimento seguem com dados de exemplo (D2 e D3).

**D2 publicado (14/10/2026):** Business ao vivo — `GET /api/v1/dashboards/business`: entrou
(parcelas recebidas), saiu (mídia), lucro/margem, a receber 60 dias, CAC (mídia ÷ clientes novos),
LTV médio (recebido), LTV/CAC, ticket, vendas por cliente, clientes e ativos (compra nos últimos
X meses), tempo lead → 1ª compra, MRR/churn/recorrente × avulso, inadimplência, concentração,
por produto (rateio por item). O tempo de resposta fica no Atendimento (D3). Churn usa a data da
última alteração como data de encerramento (não há campo próprio ainda).

**D3 publicado (14/10/2026):** Atendimento ao vivo — `GET/PUT /api/v1/dashboards/atendimento`.
Horário de atendimento da empresa em `organizations.settings.horario_de_atendimento`
(início, fim, dias; padrão 09:00–18:00 seg–sex; edita manager+). Relógio: mensagem fora do horário
conta a partir da abertura; prazo = 1 h (`lib/dashboards/atendimento.ts`). Números: conversas
iniciadas/respondidas, 1ª resposta (média e mediana), SLA, > 24 h e > 7 dias sem resposta (lista
nominal para agent+), por atendente (IA em linha própria), mapa dia × hora, tempo geral.
