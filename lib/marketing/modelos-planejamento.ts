import type { Bloco } from "@/lib/marketing/blocos";

/**
 * Modelo do PLANEJAMENTO EMPRESARIAL, enxuto e com foco em números: onde estamos, a meta e a
 * matemática dela, o modelo de negócio (CAC, LTV), o orçamento, o plano de ação e o que
 * acompanhar. Mercado, concorrência, SWOT e persona ficam nos módulos próprios (sem repetir).
 */
type NovoId = () => string;

const t1 = (id: string, texto: string): Bloco => ({ id, tipo: "titulo", nivel: 1, texto });
const t2 = (id: string, texto: string): Bloco => ({ id, tipo: "titulo", nivel: 2, texto });
const texto = (id: string, conteudo: string): Bloco => ({ id, tipo: "texto", texto: conteudo });
const cards = (id: string, itens: { titulo: string; texto: string }[]): Bloco => ({
  id,
  tipo: "cards",
  itens,
});
const tabela = (id: string, colunas: string[], linhas: string[][]): Bloco => ({
  id,
  tipo: "tabela",
  colunas,
  linhas,
});

export function planejamentoEmpresarial(n: NovoId): Bloco[] {
  return [
    t1(n(), "Onde estamos e aonde queremos chegar"),
    tabela(
      n(),
      ["Indicador", "Hoje", "Meta (90 dias)", "Variação"],
      [
        ["Faturamento mensal", "R$ —", "R$ —", "—"],
        ["Vendas por mês", "—", "—", "—"],
        ["Ticket médio", "R$ —", "R$ —", "—"],
        ["Investimento em marketing", "R$ —", "R$ —", "—"],
        ["Lucro", "R$ —", "R$ —", "—"],
      ],
    ),
    t1(n(), "A matemática da meta"),
    texto(
      n(),
      "Da meta de faturamento ao que ela exige: quantas vendas, quantos leads e quanto investir. Preencha os números reais e o resto é calculado.",
    ),
    {
      id: n(),
      tipo: "calculadora",
      meta: "",
      ticket: "",
      conversao: "",
      cpl: "",
      margem: "",
      retencao: "",
    },
    t1(n(), "Modelo de negócio"),
    cards(n(), [
      { titulo: "Como a receita entra", texto: "Recorrente, pontual ou mista; forma de cobrança." },
      { titulo: "Ciclo de venda", texto: "Do primeiro contato ao fechamento, em dias." },
      {
        titulo: "CAC máximo aceitável",
        texto: "Quanto pode custar um cliente novo sem perder dinheiro.",
      },
      {
        titulo: "Prazo de retorno",
        texto: "Em quantos meses o cliente paga o que custou para conquistá-lo.",
      },
    ]),
    t1(n(), "Orçamento mensal"),
    tabela(
      n(),
      ["Item", "Valor mensal", "Observação"],
      [
        ["Mídia paga", "R$ —", ""],
        ["Ferramentas", "R$ —", ""],
        ["Equipe e terceiros", "R$ —", ""],
        ["Total", "R$ —", ""],
      ],
    ),
    t1(n(), "Plano de ação"),
    {
      id: n(),
      tipo: "destaque",
      tom: "atencao",
      texto: "Prioridade máxima: o que precisa acontecer primeiro e por quê.",
    },
    tabela(
      n(),
      ["Ação", "Responsável", "Prazo", "Resultado esperado"],
      [
        ["", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
      ],
    ),
    t1(n(), "O que vamos acompanhar"),
    {
      id: n(),
      tipo: "lista",
      estilo: "check",
      itens: [
        "Faturamento",
        "Custo por lead",
        "Conversão de lead em venda",
        "CAC",
        "Retorno sobre o investimento",
        "Lucro",
      ],
    },
    t1(n(), "Premissas e riscos"),
    cards(n(), [
      { titulo: "Premissas", texto: "O que assumimos como verdade para o plano funcionar." },
      { titulo: "Riscos", texto: "O que pode dar errado e o impacto." },
      { titulo: "Plano B", texto: "O que fazemos se a meta não vier no prazo." },
    ]),
    t2(n(), "Próxima revisão"),
    texto(n(), "Data da próxima revisão do planejamento: __/__/____."),
  ];
}
