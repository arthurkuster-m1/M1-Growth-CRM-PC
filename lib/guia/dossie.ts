/**
 * O DOSSIÊ — o documento que uma IA lê para conhecer o projeto de marketing de uma empresa.
 * Função PURA: dados já coletados → texto em Markdown. Sem banco, sem IA, sem relógio global.
 *
 * Todo número do dossiê é CALCULADO por código; a IA só interpreta. Só entram dados agregados e de
 * estratégia (páginas, ofertas, campanhas, criativos): NUNCA nome, telefone ou e-mail de lead.
 * Quando um dado não pôde ser lido, a seção diz isso em vez de omitir em silêncio — e o fim do
 * documento lista o que ele não inclui, para a IA não preencher a lacuna com invenção.
 */
import type { Diagnostico, Leitura, PerfilGravado } from "./tipos";
import { FASES } from "./tipos";

export type TamanhoDoDossie = "completo" | "resumido";

export interface PaginaParaDossie {
  chave: string;
  titulo: string;
  /** A página já convertida em texto (`textoDaPagina`). */
  texto: string;
  publicadaEm: string;
}

export interface CampanhaParaDossie {
  nome: string;
  canal: string;
  status: string;
  inicio: string | null;
  fim: string | null;
  /** Meta de leads, custo por lead (R$), vendas e receita (R$) planejados. */
  metaLeads: number | null;
  metaCpl: number | null;
  metaVendas: number | null;
  metaReceita: number | null;
  /** Realizado, somado dos dias lançados e das vendas ligadas à campanha. */
  gasto: number;
  leads: number;
  impressoes: number;
  cliques: number;
  vendas: number;
  receita: number;
}

export interface CriativoParaDossie {
  campanha: string;
  nome: string;
  formato: string;
  status: string;
  gasto: number;
  impressoes: number;
  cliques: number;
}

export interface DadosDoDossie {
  empresa: string;
  perfil: PerfilGravado | null;
  diagnostico: Diagnostico;
  paginas: Leitura<PaginaParaDossie[]>;
  campanhas: Leitura<CampanhaParaDossie[]>;
  criativos: Leitura<CriativoParaDossie[]>;
  geradoEm: Date;
}

export interface Dossie {
  markdown: string;
  caracteres: number;
  /** Estimativa grosseira (português ≈ 4 caracteres por token); serve para saber se cabe na IA. */
  tokensAproximados: number;
}

const LIMITES: Record<
  TamanhoDoDossie,
  { textoPorPagina: number; campanhas: number; criativos: number }
> = {
  completo: { textoPorPagina: 4000, campanhas: 15, criativos: 12 },
  resumido: { textoPorPagina: 700, campanhas: 5, criativos: 5 },
};

export const MAXIMO_DA_PERGUNTA = 500;

const PREFIXO_DE_OFERTA = "produtos-e-ofertas--oferta-";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const num = (n: number) => n.toLocaleString("pt-BR");
const dia = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");
const pct = (a: number, b: number) =>
  b > 0 ? `${((a / b) * 100).toFixed(2).replace(".", ",")}%` : "—";
const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

/** Corta o texto num limite e AVISA quanto ficou de fora (nunca corta calado). */
function cortar(texto: string, limite: number): string {
  const limpo = texto.trim();
  if (limpo.length <= limite) return limpo;
  return `${limpo.slice(0, limite).trimEnd()}\n\n_(texto cortado: faltam ${num(limpo.length - limite)} caracteres)_`;
}

/** Célula de tabela Markdown: sem `|` nem quebra de linha. */
const celula = (s: string) => s.replace(/\|/g, "/").replace(/\r?\n/g, " ").trim();

function tabela(cabecalho: string[], linhas: string[][]): string {
  return [
    `| ${cabecalho.join(" | ")} |`,
    `| ${cabecalho.map(() => "---").join(" | ")} |`,
    ...linhas.map((l) => `| ${l.map(celula).join(" | ")} |`),
  ].join("\n");
}

function secaoDeLeitura<T>(l: Leitura<T>, quandoOk: (v: T) => string): string {
  return l.ok
    ? quandoOk(l.valor)
    : `_Não consegui ler esta parte agora (${l.motivo}). Não use esta seção para concluir nada._`;
}

function instrucoes(): string {
  return [
    "Você é um consultor sênior de marketing e vendas que acompanha este projeto. Este dossiê é tudo que se sabe dele agora.",
    "",
    "- Use **só** os dados deste dossiê. Os números foram calculados pelo sistema: não invente, não arredonde para parecer melhor.",
    '- Se um dado não consta, escreva **"não consta no dossiê"** e diga qual informação faltou para decidir.',
    "- Separe **fato** (está no dossiê, cite a seção) de **leitura** (sua interpretação, começando com →).",
    "- Priorize pelo que mais muda o resultado. Cada recomendação diz o **porquê**, o **passo concreto** e **como saber se funcionou**.",
    "- Responda em português simples, sem jargão. Não repita o dossiê de volta.",
  ].join("\n");
}

function perfil(p: PerfilGravado | null): string {
  if (!p) return "_O perfil do negócio ainda não foi preenchido._";
  const l: string[] = [`- Nicho: ${p.nicho}`];
  l.push(`- Como vende: ${p.modelos.length ? p.modelos.join(", ") : "não informado"}`);
  l.push(`- Já tem oferta pronta: ${p.jaTemOferta ? "sim" : "não"}`);
  if (p.objetivo) l.push(`- Objetivo principal: ${p.objetivo}`);
  if (p.ticketMedioCents !== null) l.push(`- Ticket médio: ${brl(p.ticketMedioCents / 100)}`);
  if (p.metaLeadsMes !== null) l.push(`- Meta de leads por mês: ${num(p.metaLeadsMes)}`);
  if (p.siteUrl) l.push(`- Site: ${p.siteUrl}`);
  if (p.instagramUrl) l.push(`- Instagram: ${p.instagramUrl}`);
  if (p.googleNegocioUrl) l.push(`- Google Meu Negócio: ${p.googleNegocioUrl}`);
  return l.join("\n");
}

function estadoDoGuia(d: Diagnostico): string {
  const geral = d.prontidao.geral;
  const linhas: string[] = [
    geral === null
      ? "Prontidão geral: ainda não calculada (falta o perfil)."
      : `Prontidão geral do marketing: **${geral}%**.`,
  ];
  const fases = FASES.filter((f) => d.prontidao.porFase[f].pct !== null).map((f) => {
    const x = d.prontidao.porFase[f];
    return `- ${f}: ${x.pct}% (${x.feitos}/${x.total} feitos)`;
  });
  if (fases.length) linhas.push("", "Por fase:", ...fases);

  const pendentes = d.passos.filter(
    (p) =>
      p.classificacao === "E" &&
      ["falta", "em_andamento", "bloqueado", "desatualizado"].includes(p.estado),
  );
  if (pendentes.length) {
    linhas.push("", "Passos essenciais pendentes:");
    for (const p of pendentes) {
      linhas.push(`- ${p.id} ${p.titulo} — ${p.estado.replace("_", " ")}. ${p.evidencia}`);
    }
  }
  const dispensados = d.passos.filter((p) => p.estado === "dispensado");
  if (dispensados.length) {
    linhas.push("", "Passos dispensados de propósito:");
    for (const p of dispensados) linhas.push(`- ${p.id} ${p.titulo} — ${p.evidencia}`);
  }
  if (d.naoVerificados.length) {
    linhas.push("", `Não foi possível verificar: ${d.naoVerificados.join(", ")}.`);
  }
  return linhas.join("\n");
}

function paginas(lista: PaginaParaDossie[], limite: number, soOfertas: boolean): string {
  const selecionadas = lista.filter((p) => p.chave.startsWith(PREFIXO_DE_OFERTA) === soOfertas);
  if (selecionadas.length === 0) {
    return soOfertas
      ? "_Nenhuma oferta publicada ainda._"
      : "_Nenhuma página de estratégia publicada ainda._";
  }
  return selecionadas
    .map(
      (p) =>
        `### ${p.titulo || p.chave}\n_(${p.chave}, publicada em ${dia(p.publicadaEm)})_\n\n${cortar(p.texto, limite)}`,
    )
    .join("\n\n");
}

function campanhas(lista: CampanhaParaDossie[], max: number): string {
  if (lista.length === 0) return "_Nenhuma campanha cadastrada._";
  const mostradas = lista.slice(0, max);
  const linhas = mostradas.map((c) => [
    c.nome,
    `${c.canal} · ${c.status}`,
    `${dia(c.inicio)} a ${dia(c.fim)}`,
    brl(c.gasto),
    num(c.leads),
    c.leads > 0 ? brl(c.gasto / c.leads) : "—",
    c.metaCpl !== null ? brl(c.metaCpl) : "—",
    pct(c.cliques, c.impressoes),
    num(c.vendas),
    brl(c.receita),
    c.gasto > 0 ? `${(c.receita / c.gasto).toFixed(2).replace(".", ",")}x` : "—",
  ]);
  const resto = lista.length - mostradas.length;
  return [
    tabela(
      [
        "Campanha",
        "Canal · status",
        "Período",
        "Gasto",
        "Leads",
        "CPL",
        "Meta de CPL",
        "CTR",
        "Vendas",
        "Receita",
        "Retorno",
      ],
      linhas,
    ),
    resto > 0
      ? `\n_(+${plural(resto, "campanha omitida", "campanhas omitidas")} neste tamanho de dossiê.)_`
      : "",
    "\nCPL = gasto ÷ leads. CTR = cliques no link ÷ impressões. Retorno = receita ÷ gasto.",
  ]
    .filter(Boolean)
    .join("\n");
}

function criativos(lista: CriativoParaDossie[], max: number): string {
  if (lista.length === 0) return "_Nenhum criativo cadastrado._";
  const ordenados = [...lista].sort((a, b) => b.gasto - a.gasto).slice(0, max);
  return [
    "Os de maior investimento (o que mais recebeu verba):",
    "",
    tabela(
      ["Criativo", "Campanha", "Formato · status", "Gasto", "Impressões", "CTR"],
      ordenados.map((c) => [
        c.nome,
        c.campanha,
        `${c.formato} · ${c.status}`,
        brl(c.gasto),
        num(c.impressoes),
        pct(c.cliques, c.impressoes),
      ]),
    ),
  ].join("\n");
}

function plano(d: Diagnostico): string {
  const comTarefa = d.passos.filter((p) => p.tarefaId);
  if (comTarefa.length === 0) return "_Nenhuma tarefa criada a partir do Guia ainda._";
  return comTarefa
    .map(
      (p) =>
        `- ${p.id} ${p.titulo} (tarefa criada; situação do passo: ${p.estado.replace("_", " ")})`,
    )
    .join("\n");
}

export function montarDossie(
  d: DadosDoDossie,
  opts: { tamanho: TamanhoDoDossie; pergunta?: string },
): Dossie {
  const lim = LIMITES[opts.tamanho];
  const pergunta = (opts.pergunta ?? "").trim().slice(0, MAXIMO_DA_PERGUNTA);

  const markdown = [
    `# Dossiê do projeto — ${d.empresa}`,
    `Gerado em ${dia(d.geradoEm.toISOString())} pelo Guia M1 (versão ${opts.tamanho}). Só dados agregados: nenhum dado pessoal de lead.`,
    "## 1. Instruções para a IA",
    instrucoes(),
    "## 2. Perfil do negócio",
    perfil(d.perfil),
    "## 3. Estado do Guia (o que já está pronto e o que falta)",
    estadoDoGuia(d.diagnostico),
    "## 4. Estratégia (páginas publicadas)",
    secaoDeLeitura(d.paginas, (l) => paginas(l, lim.textoPorPagina, false)),
    "## 5. Ofertas",
    secaoDeLeitura(d.paginas, (l) => paginas(l, lim.textoPorPagina, true)),
    "## 6. Campanhas",
    secaoDeLeitura(d.campanhas, (l) => campanhas(l, lim.campanhas)),
    "## 7. Criativos",
    secaoDeLeitura(d.criativos, (l) => criativos(l, lim.criativos)),
    "## 8. Plano em andamento",
    plano(d.diagnostico),
    "## 9. O que este dossiê NÃO inclui",
    [
      "- Funil do CRM por etapa, tempo de resposta ao lead e taxa de no-show: ainda não fazem parte do dossiê.",
      "- O que funcionou e o que não funcionou em campanhas passadas: ainda não é registrado no sistema; se a pessoa contar, trate como informação dela, não do dossiê.",
      "- Dados individuais de leads (nome, telefone, e-mail, conversas): nunca entram, por privacidade.",
    ].join("\n"),
    "## 10. Pergunta atual",
    pergunta ||
      "_(sem pergunta específica: indique os 3 próximos passos de maior impacto e por quê.)_",
  ].join("\n\n");

  return {
    markdown,
    caracteres: markdown.length,
    tokensAproximados: Math.ceil(markdown.length / 4),
  };
}
