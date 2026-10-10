import type { Bloco } from "@/lib/marketing/blocos";

/**
 * Modelos das SUBPÁGINAS do Estudo de persona, na estrutura que a agência já usa (dossiê do
 * avatar, árvore de situações incômodas, arquitetura de premissa…). Conteúdo editável em
 * português: cada bloco traz a orientação do que escrever.
 */
type NovoId = () => string;

const t1 = (id: string, texto: string): Bloco => ({ id, tipo: "titulo", nivel: 1, texto });
const t2 = (id: string, texto: string): Bloco => ({ id, tipo: "titulo", nivel: 2, texto });
const texto = (id: string, conteudo: string): Bloco => ({ id, tipo: "texto", texto: conteudo });
const lista = (
  id: string,
  estilo: "marcadores" | "numerada" | "check",
  itens: string[],
): Bloco => ({
  id,
  tipo: "lista",
  estilo,
  itens,
});
const cards = (id: string, itens: { titulo: string; texto: string }[]): Bloco => ({
  id,
  tipo: "cards",
  itens,
});
const destaque = (id: string, tom: "info" | "sucesso" | "atencao", conteudo: string): Bloco => ({
  id,
  tipo: "destaque",
  tom,
  texto: conteudo,
});
const metricas = (
  id: string,
  itens: { rotulo: string; valor: string; detalhe: string }[],
): Bloco => ({
  id,
  tipo: "metricas",
  itens,
});

export function persona(n: NovoId): Bloco[] {
  return [
    t1(n(), "Perfil do cliente ideal"),
    texto(n(), "Quem é, em uma frase: ex.: mulheres de 35 a 55 anos, alta renda, que buscam…"),
    cards(n(), [
      { titulo: "Idade e gênero", texto: "Idade média e se é mais homem, mulher ou equilibrado." },
      { titulo: "Onde mora", texto: "Região ou cidades que mais concentram clientes." },
      { titulo: "Renda e escolaridade", texto: "Faixa de renda e nível de formação." },
      { titulo: "Família", texto: "Solteiro, casado, filhos, animais de estimação…" },
    ]),
    t1(n(), "Dores e desejos"),
    t2(n(), "Dores conscientes"),
    lista(n(), "marcadores", ["O que ele admite em voz alta, para amigos ou no Google…"]),
    t2(n(), "Dores latentes (o que ele não admite a ninguém)"),
    lista(n(), "marcadores", ["Vergonhas, medos profundos e frustrações que guiam as decisões…"]),
    cards(n(), [
      { titulo: "Desejos externos", texto: "Resultados materiais que ele quer atingir." },
      { titulo: "Desejos internos", texto: "O que ele quer sentir, e não fala publicamente." },
    ]),
    t1(n(), "Os 5 níveis de consciência"),
    cards(n(), [
      { titulo: "1. Inconsciente", texto: "O que acredita sobre o problema e a solução." },
      {
        titulo: "2. Consciente do problema",
        texto: "O que acredita sobre o problema e a solução.",
      },
      { titulo: "3. Consciente da solução", texto: "O que acredita sobre o problema e a solução." },
      { titulo: "4. Consciente do produto", texto: "O que acredita sobre o problema e a solução." },
      { titulo: "5. Totalmente consciente", texto: "O que acredita sobre o problema e a solução." },
    ]),
    t1(n(), "Histórico, frustrações e rotina"),
    cards(n(), [
      { titulo: "O que já tentou", texto: "Cada solução tentada e o problema que enfrentou." },
      { titulo: "Frustrações", texto: "O que o frustra por ainda não ter atingido o desejo." },
      { titulo: "Rotina", texto: "O que faz no dia a dia que se relaciona com o problema." },
    ]),
    t1(n(), "A fortaleza de objeções"),
    cards(n(), [
      { titulo: "Preço e valor", texto: "Acha caro ou não vê o retorno?" },
      { titulo: "Confiança", texto: "Por que teria medo ou ceticismo de comprar?" },
      { titulo: "Tempo e logística", texto: "“Não tenho tempo”, “é difícil de implementar”." },
      { titulo: "Merecimento", texto: "“Funciona para os outros, mas não para mim”." },
    ]),
    t1(n(), "O trabalho a ser feito"),
    cards(n(), [
      { titulo: "Transformação funcional", texto: "O que o produto faz na prática." },
      { titulo: "Transformação emocional", texto: "Como ele se sente depois." },
      { titulo: "Transformação social", texto: "Como os outros passam a enxergá-lo." },
    ]),
    t1(n(), "Ganchos de comunicação"),
    lista(n(), "numerada", ["Título 1", "Título 2", "Título 3"]),
  ];
}

export function pesquisaDeMercado(n: NovoId): Bloco[] {
  return [
    t1(n(), "Visão geral do setor"),
    texto(n(), "Descrição do mercado, como se divide e as principais mudanças de comportamento."),
    metricas(n(), [
      { rotulo: "Empresas no setor", valor: "—", detalhe: "" },
      { rotulo: "Faturamento médio mensal", valor: "R$ —", detalhe: "" },
      { rotulo: "Margem líquida média", valor: "—%", detalhe: "" },
      { rotulo: "Investimento em marketing", valor: "—%", detalhe: "do faturamento" },
    ]),
    cards(n(), [
      { titulo: "Modelo de negócios", texto: "Como o setor ganha dinheiro: receitas e margens." },
      { titulo: "Perspectivas de crescimento", texto: "Para onde o mercado caminha." },
    ]),
    t1(n(), "Processo comercial do setor"),
    cards(n(), [
      { titulo: "Estratégias de venda e aquisição", texto: "Como o setor atrai clientes." },
      { titulo: "Retenção e valor do cliente", texto: "Como mantém e reativa a base." },
    ]),
    t1(n(), "Principais desafios"),
    lista(n(), "marcadores", ["Desafio 1", "Desafio 2", "Desafio 3"]),
  ];
}

export function arvoreDeSituacoes(n: NovoId): Bloco[] {
  return [
    t1(n(), "A jornada convencional até o resultado"),
    texto(
      n(),
      "Todas as etapas que o cliente ideal percorre hoje, com as soluções convencionais, em detalhe.",
    ),
    lista(n(), "numerada", ["Etapa 1", "Etapa 2", "Etapa 3", "Etapa 4"]),
    t1(n(), "A linha de ouro"),
    destaque(
      n(),
      "atencao",
      "Abaixo da linha: quem ainda não tem a base para investir (desqualificados).",
    ),
    destaque(n(), "sucesso", "Acima da linha: o cliente ideal, que já tem… mas sofre com…"),
    texto(n(), "Os tópicos acima da linha de ouro (ramificações) que vamos trabalhar:"),
    lista(n(), "marcadores", ["Ramificação 1", "Ramificação 2", "Ramificação 3", "Ramificação 4"]),
    t1(n(), "Situações incômodas"),
    texto(
      n(),
      "Dor é diferente de situação incômoda: a dor é “baixa conversão”; a situação incômoda é cotidiana, específica e fácil de reconhecer. De 3 a 5 por ramificação.",
    ),
    t2(n(), "Ramificação 1"),
    lista(n(), "marcadores", ["Situação incômoda 1", "Situação incômoda 2", "Situação incômoda 3"]),
    t2(n(), "Ramificação 2"),
    lista(n(), "marcadores", ["Situação incômoda 1", "Situação incômoda 2", "Situação incômoda 3"]),
    t2(n(), "Ramificação 3"),
    lista(n(), "marcadores", ["Situação incômoda 1", "Situação incômoda 2", "Situação incômoda 3"]),
  ];
}

const DESCONSTRUCAO = (nome: string): { titulo: string; texto: string }[] => [
  { titulo: `${nome} — a) Crença`, texto: "O que o lead acredita hoje?" },
  { titulo: "b) Está errado", texto: "Por que isso é perigoso?" },
  { titulo: "c) Por que está errado", texto: "A explicação lógica do erro." },
  { titulo: "d) Visão do especialista", texto: "A leitura baseada em comportamento humano." },
  { titulo: "e) O certo é", texto: "O novo caminho proposto pelo mecanismo único." },
];

export function arquiteturaDePremissas(n: NovoId): Bloco[] {
  return [
    t1(n(), "Dados de calibração estratégica"),
    cards(n(), [
      { titulo: "Marca / especialista", texto: "" },
      { titulo: "Produto ou serviço", texto: "" },
      { titulo: "Cliente ideal", texto: "" },
      { titulo: "Inimigo comum", texto: "O que o mercado faz que não funciona?" },
      { titulo: "Mecanismo único", texto: "O nome do método e o que ele faz de diferente." },
    ]),
    t1(n(), "A premissa persuasiva"),
    {
      id: n(),
      tipo: "citacao",
      texto:
        "Mecanismo único + transformação desejada + diferencial frente ao mercado + prazo ou eficiência.",
      autor: "",
      alinhamento: "centro",
    },
    t1(n(), "A crença central"),
    cards(n(), DESCONSTRUCAO("Crença central")),
    t1(n(), "Crenças secundárias"),
    t2(n(), "Dinheiro"),
    cards(n(), DESCONSTRUCAO("Dinheiro")),
    t2(n(), "Tempo"),
    cards(n(), DESCONSTRUCAO("Tempo")),
    t2(n(), "Terceiros"),
    cards(n(), DESCONSTRUCAO("Terceiros")),
    t2(n(), "Tentativas anteriores"),
    cards(n(), DESCONSTRUCAO("Tentativas anteriores")),
  ];
}

export function porques(n: NovoId): Bloco[] {
  return [
    t1(n(), "Os porquês de comprar"),
    texto(
      n(),
      "Quais objetivos, motivações e momentos levariam alguém a comprar? Qual a emoção por trás de cada porquê, e qual o desejo real?",
    ),
    cards(n(), [
      { titulo: "Porquê 1", texto: "Emoção e desejo real." },
      { titulo: "Porquê 2", texto: "Emoção e desejo real." },
      { titulo: "Porquê 3", texto: "Emoção e desejo real." },
    ]),
    t2(n(), "Palavras, frases e imagens que filtram o público ideal"),
    lista(n(), "marcadores", [
      "O que chama a atenção deles…",
      "O que eles não podem ouvir sem prestar atenção…",
    ]),
  ];
}
