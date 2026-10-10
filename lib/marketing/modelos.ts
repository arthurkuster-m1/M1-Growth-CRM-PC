import { blocoEmBranco, type Bloco } from "@/lib/marketing/blocos";
import {
  arquiteturaDePremissas,
  arvoreDeSituacoes,
  persona,
  pesquisaDeMercado,
  porques,
} from "@/lib/marketing/modelos-persona";
import { lerChaveDePagina } from "@/lib/marketing/modulos";

/**
 * Os MODELOS de página: o ponto de partida que a agência recebe ao clicar em "Começar com um
 * modelo" num módulo em branco. É conteúdo EDITÁVEL da agência (já em português, como o resto
 * do que ela escreve), não texto de interface: cada bloco nasce com a orientação do que
 * escrever, e a agência troca pelo conteúdo do cliente. Imagens nascem vazias (o bloco só
 * aparece para o cliente quando a agência enviar o arquivo).
 */
type NovoId = () => string;

const t1 = (id: string, texto: string): Bloco => ({ id, tipo: "titulo", nivel: 1, texto });
const t2 = (id: string, texto: string): Bloco => ({ id, tipo: "titulo", nivel: 2, texto });
const texto = (id: string, conteudo: string): Bloco => ({ id, tipo: "texto", texto: conteudo });
const lista = (
  id: string,
  estilo: "marcadores" | "numerada" | "check",
  itens: string[],
): Bloco => ({ id, tipo: "lista", estilo, itens });
const cards = (id: string, itens: { titulo: string; texto: string }[]): Bloco => ({
  id,
  tipo: "cards",
  itens,
});
const metricas = (
  id: string,
  itens: { rotulo: string; valor: string; detalhe: string }[],
): Bloco => ({
  id,
  tipo: "metricas",
  itens,
});

const imagem = (
  id: string,
  legenda: string,
  largura: "pequena" | "media" | "grande" | "total" = "grande",
): Bloco => ({ id, tipo: "imagem", arquivo: "", legenda, largura, alinhamento: "centro" });
const imagemTexto = (
  id: string,
  titulo: string,
  conteudo: string,
  lado: "esquerda" | "direita" = "esquerda",
): Bloco => ({ id, tipo: "imagem-texto", arquivo: "", titulo, texto: conteudo, lado });

function mapeamentoDoFunil(n: NovoId): Bloco[] {
  return [
    t1(n(), "Onde estamos hoje"),
    texto(
      n(),
      "Resumo breve da empresa: o que faz, para quem, há quanto tempo, e o momento financeiro atual (estagnada, crescendo ou em declínio).",
    ),
    metricas(n(), [
      { rotulo: "Faturamento dos últimos 12 meses", valor: "R$ —", detalhe: "" },
      { rotulo: "Ticket médio", valor: "R$ —", detalhe: "" },
      { rotulo: "Conversão de lead em venda", valor: "—%", detalhe: "" },
      { rotulo: "Custo por lead", valor: "R$ —", detalhe: "" },
    ]),
    t1(n(), "O funil atual"),
    texto(n(), "Como o cliente chega, compra e é atendido hoje, etapa por etapa."),
    imagem(n(), "Desenho do funil atual"),
    cards(n(), [
      { titulo: "Advertising", texto: "De onde vêm os contatos hoje e o que é investido." },
      { titulo: "Oferta e branding", texto: "O que é oferecido e como a marca se apresenta." },
      { titulo: "Posicionamento", texto: "Como a empresa é vista e encontrada." },
      { titulo: "Vendas", texto: "Quem atende, em quanto tempo e como fecha." },
      { titulo: "Customer success", texto: "O que acontece depois da compra." },
    ]),
    t1(n(), "Processo de vendas atual"),
    lista(n(), "numerada", [
      "O contato chega por…",
      "Quem responde e em quanto tempo…",
      "Como a proposta é apresentada…",
      "Como o fechamento acontece…",
      "O que é feito com quem não comprou…",
    ]),
    t1(n(), "Forças, fraquezas, oportunidades e ameaças"),
    cards(n(), [
      { titulo: "Forças", texto: "O que a empresa faz bem e o que a diferencia." },
      { titulo: "Fraquezas", texto: "O que está abaixo do esperado e pode melhorar." },
      { titulo: "Oportunidades", texto: "Lacunas de mercado e recursos ainda não usados." },
      {
        titulo: "Ameaças",
        texto: "Mudanças de mercado e pontos em que a concorrência vai melhor.",
      },
    ]),
    t1(n(), "As oportunidades que vamos trabalhar"),
    { id: n(), tipo: "destaque", tom: "atencao", texto: "O maior gargalo hoje: …" },
    lista(n(), "check", ["Oportunidade 1", "Oportunidade 2", "Oportunidade 3"]),
    t1(n(), "Nosso alvo"),
    metricas(n(), [
      { rotulo: "Meta de faturamento", valor: "R$ —", detalhe: "" },
      { rotulo: "Vendas necessárias", valor: "—", detalhe: "" },
      { rotulo: "Leads necessários", valor: "—", detalhe: "" },
      { rotulo: "Investimento necessário", valor: "R$ —", detalhe: "por mês" },
    ]),
  ];
}

function branding(n: NovoId): Bloco[] {
  return [
    t1(n(), "Fundamentos da marca"),
    cards(n(), [
      { titulo: "Nome e significado", texto: "O nome da marca e o que ele representa." },
      { titulo: "Slogan", texto: "A frase que resume a marca." },
      { titulo: "Visão", texto: "Onde a marca quer chegar e como enxerga o mercado." },
      { titulo: "Personalidade", texto: "O arquétipo: como a marca age e se comporta." },
    ]),
    t2(n(), "Propósito, processos e produto"),
    cards(n(), [
      { titulo: "Por quê (propósito)", texto: "A causa que move a marca." },
      { titulo: "Como (cultura)", texto: "Os valores e o jeito de trabalhar." },
      { titulo: "O quê (produto)", texto: "O que a marca vende." },
    ]),
    {
      id: n(),
      tipo: "destaque",
      tom: "info",
      texto: "Inimigo comum: contra quem ou o quê a marca luta?",
    },
    {
      id: n(),
      tipo: "citacao",
      texto: "A grande promessa: a frase que resume o benefício único que só esta marca entrega.",
      autor: "",
      alinhamento: "centro",
    },
    t1(n(), "Logo"),
    imagem(n(), "Logo principal", "media"),
    imagem(n(), "Versões e aplicações do logo"),
    t1(n(), "Cores"),
    texto(
      n(),
      "A paleta foi pensada para passar autoridade, modernidade e contraste. Cada cor tem um papel.",
    ),
    {
      id: n(),
      tipo: "paleta",
      cores: [
        { nome: "Principal (marca)", hex: "#366D6F" },
        { nome: "Apoio / brilho", hex: "#52A3A6" },
        { nome: "Fundo escuro", hex: "#0D1117" },
        { nome: "Superfície escura", hex: "#161B22" },
        { nome: "Texto principal", hex: "#F0F6FC" },
        { nome: "Acento de conversão", hex: "#FF7A1A" },
      ],
    },
    lista(n(), "marcadores", [
      "Principal: ícones de destaque, botões primários e detalhes do logo.",
      "Apoio: estados de hover, gradientes sutis e dados positivos.",
      "Acento: urgência e chamadas de ação críticas.",
    ]),
    t1(n(), "Tipografia"),
    cards(n(), [
      { titulo: "Títulos", texto: "Fonte e peso. Passa força e estabilidade." },
      { titulo: "Corpo de texto", texto: "Fonte e peso. Alta legibilidade." },
      { titulo: "Destaques e dados", texto: "Fonte usada em números e códigos." },
    ]),
    t1(n(), "Elementos visuais e estilo de imagem"),
    imagemTexto(n(), "Grafismos", "Linhas, texturas e brilhos que reforçam a identidade."),
    imagemTexto(
      n(),
      "Estilo fotográfico",
      "Contraste, filtros e ambientes que representam a marca.",
      "direita",
    ),
    t1(n(), "Tom de voz"),
    lista(n(), "check", [
      "Como a marca fala (ex.: direto, analítico, confiante)…",
      "Como a marca nunca fala…",
    ]),
    t1(n(), "Identidade visual: hoje e proposta"),
    {
      id: n(),
      tipo: "antes-depois",
      antes: { titulo: "Hoje", texto: "Como a identidade aparece atualmente.", imagem: "" },
      depois: { titulo: "Proposta", texto: "O que vamos ajustar e por quê.", imagem: "" },
    },
    t2(n(), "Manual completo e materiais"),
    {
      id: n(),
      tipo: "links",
      itens: [
        { rotulo: "Manual de identidade visual", url: "" },
        { rotulo: "Pasta de materiais", url: "" },
      ],
    },
  ];
}

function posicionamento(n: NovoId): Bloco[] {
  return [
    t1(n(), "Onde a marca aparece hoje"),
    texto(
      n(),
      "Um retrato de todos os lugares onde o cliente é encontrado online, com o link e a imagem de cada um.",
    ),
    imagemTexto(n(), "Site", "O que comunica, como é o caminho até o contato."),
    imagemTexto(n(), "Instagram", "Bio, destaques, frequência e tipo de conteúdo.", "direita"),
    imagemTexto(n(), "Google Meu Negócio", "Avaliações, fotos e informações."),
    t2(n(), "Todos os links"),
    {
      id: n(),
      tipo: "links",
      itens: [
        { rotulo: "Site", url: "" },
        { rotulo: "Instagram", url: "" },
        { rotulo: "Google Meu Negócio", url: "" },
      ],
    },
    t1(n(), "O que observamos"),
    {
      id: n(),
      tipo: "destaque",
      tom: "info",
      texto: "Principal ponto de atenção no posicionamento atual: …",
    },
    {
      id: n(),
      tipo: "antes-depois",
      antes: { titulo: "Como é visto hoje", texto: "", imagem: "" },
      depois: { titulo: "Como queremos ser vistos", texto: "", imagem: "" },
    },
  ];
}

function generico(n: NovoId): Bloco[] {
  return [
    blocoEmBranco("titulo", n()),
    blocoEmBranco("texto", n()),
    { ...blocoEmBranco("titulo", n()), texto: "Próximos passos" } as Bloco,
    blocoEmBranco("lista", n()),
  ];
}

/** O modelo do módulo; os que ainda não têm modelo próprio recebem um esqueleto simples. */
export function modeloDoModulo(chave: string, novoId: NovoId): Bloco[] {
  switch (lerChaveDePagina(chave)?.tipo) {
    case "persona":
      return persona(novoId);
    case "pesquisa-de-mercado":
      return pesquisaDeMercado(novoId);
    case "arvore-de-situacoes":
      return arvoreDeSituacoes(novoId);
    case "arquitetura-de-premissas":
      return arquiteturaDePremissas(novoId);
    case "porques":
      return porques(novoId);
  }
  switch (chave) {
    case "mapeamento-do-funil":
      return mapeamentoDoFunil(novoId);
    case "identidade-da-marca":
      return branding(novoId);
    case "posicionamento-zmot":
      return posicionamento(novoId);
    default:
      return generico(novoId);
  }
}
