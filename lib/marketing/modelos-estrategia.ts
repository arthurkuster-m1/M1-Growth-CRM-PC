import type { Bloco } from "@/lib/marketing/blocos";

/**
 * Modelo da página de ESTRATÉGIA DE MARKETING: uma página por estratégia que a empresa vai
 * rodar (tráfego pago, indicação, parcerias, conteúdo…). É onde a agência explica a ideia, o
 * que se espera dela, como encaixa no plano e como as campanhas vão sair dela. Conteúdo
 * editável em português; cada bloco nasce com a orientação do que escrever.
 */
type NovoId = () => string;

const t1 = (id: string, texto: string): Bloco => ({ id, tipo: "titulo", nivel: 1, texto });
const texto = (id: string, conteudo: string): Bloco => ({ id, tipo: "texto", texto: conteudo });
const cards = (id: string, itens: { titulo: string; texto: string }[]): Bloco => ({
  id,
  tipo: "cards",
  itens,
});
const lista = (
  id: string,
  estilo: "marcadores" | "numerada" | "check",
  itens: string[],
): Bloco => ({ id, tipo: "lista", estilo, itens });

export function estrategiaDeMarketing(n: NovoId): Bloco[] {
  return [
    t1(n(), "A ideia da estratégia"),
    {
      id: n(),
      tipo: "destaque",
      tom: "info",
      texto:
        "Em uma frase: o que esta estratégia faz pelo negócio e por que ela faz sentido agora.",
    },
    texto(
      n(),
      "Explique a lógica: qual problema ela resolve, que caminho o cliente percorre e por que acreditamos que vai funcionar para esta empresa.",
    ),
    t1(n(), "O que se espera dela"),
    {
      id: n(),
      tipo: "metricas",
      itens: [
        { rotulo: "Meta principal", valor: "—", detalhe: "O número que diz se deu certo" },
        { rotulo: "Prazo para ver resultado", valor: "—", detalhe: "" },
        { rotulo: "Investimento previsto", valor: "R$ —", detalhe: "" },
        { rotulo: "Retorno esperado", valor: "—", detalhe: "" },
      ],
    },
    t1(n(), "Para quem e com qual oferta"),
    cards(n(), [
      { titulo: "Público", texto: "Qual persona esta estratégia quer alcançar." },
      {
        titulo: "Oferta",
        texto: "Qual produto ou oferta entra em cena (veja Produtos e ofertas).",
      },
      { titulo: "Mensagem", texto: "A promessa e o ângulo que vão aparecer nas campanhas." },
    ]),
    t1(n(), "Como funciona na prática"),
    {
      id: n(),
      tipo: "fluxo",
      itens: [
        { titulo: "Atrair", texto: "Onde e como a pessoa descobre a marca" },
        { titulo: "Converter", texto: "O que ela vê e faz para virar lead" },
        { titulo: "Atender", texto: "Quem responde, em quanto tempo e com qual roteiro" },
        { titulo: "Fechar", texto: "Como a conversa vira venda" },
      ],
    },
    t1(n(), "As campanhas desta estratégia"),
    texto(
      n(),
      "As campanhas que nascem daqui, com o objetivo de cada uma. O acompanhamento do dia a dia fica em Geração de demanda.",
    ),
    lista(n(), "marcadores", ["Campanha 1: …", "Campanha 2: …"]),
    t1(n(), "Como vamos medir"),
    lista(n(), "check", [
      "Indicador 1 e de onde vem o número",
      "Indicador 2 e de onde vem o número",
    ]),
    t1(n(), "Riscos e próximos passos"),
    {
      id: n(),
      tipo: "destaque",
      tom: "atencao",
      texto: "O que pode dar errado, e o que fazemos para evitar.",
    },
    lista(n(), "numerada", ["Primeiro passo", "Segundo passo", "Terceiro passo"]),
  ];
}
