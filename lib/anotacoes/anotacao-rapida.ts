import { dobrar } from "@/lib/anotacoes/busca";
import { caminhoDaNota, type ResumoDaNota } from "@/lib/anotacoes/paginas";
import type { Bloco } from "@/lib/marketing/blocos";

/**
 * A ANOTAÇÃO RÁPIDA (o lápis da barra do topo): escolhe-se a página das Anotações, escreve-se, e o
 * texto entra no TOPO dela — a mais recente primeiro —, com a data e a hora em negrito, uma linha
 * por parágrafo e uma divisória. Sem escolher, vai para a Caixa de entrada. É o mesmo desenho do
 * aplicativo Família Kuster.
 */
export const MAXIMO_DA_ANOTACAO_RAPIDA = 20000;

const dois = (n: number) => String(n).padStart(2, "0");

/** "16/11/2026 · 14:32" no fuso informado. */
export function carimboDaAnotacao(agora: Date, fuso: string): string {
  const p = new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(agora);
  const v = (tipo: string) => p.find((x) => x.type === tipo)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} · ${dois(Number(v("hour")) % 24)}:${v("minute")}`;
}

/** Os blocos da anotação: carimbo em negrito, uma linha por parágrafo, divisória. Texto vazio não gera nada. */
export function blocosDaAnotacaoRapida(
  texto: string,
  agora: Date,
  fuso: string,
  novoId: () => string,
): Bloco[] {
  const linhas = texto
    .replace(/\r\n?/g, "\n")
    .replace(/^\n+|\s+$/g, "")
    .slice(0, MAXIMO_DA_ANOTACAO_RAPIDA)
    .split("\n");
  if (linhas.every((l) => !l.trim())) return [];
  return [
    { id: novoId(), tipo: "texto", texto: `**${carimboDaAnotacao(agora, fuso)}**` },
    ...linhas.map((l): Bloco => ({ id: novoId(), tipo: "texto", texto: l.slice(0, 5000) })),
    { id: novoId(), tipo: "separador" },
  ];
}

/** A anotação nova entra no TOPO da página. */
export const inserirNoTopo = (documento: readonly Bloco[], novos: readonly Bloco[]): Bloco[] =>
  novos.length === 0 ? [...documento] : [...novos, ...documento];

/** Uma página que pode receber a anotação rápida. */
export interface OpcaoDeDestino {
  id: string;
  titulo: string;
  icone: string | null;
  /** "Mãe › Filha": onde ela está na árvore (vazio na raiz). */
  caminho: string;
  inbox: boolean;
}

/**
 * As páginas vivas para escolher o destino. A Caixa de entrada vem primeiro; depois as mexidas por
 * último. `busca` filtra pelo título, sem acento e sem maiúsculas.
 */
export function opcoesDeDestino(
  paginas: readonly ResumoDaNota[],
  busca = "",
  limite = 40,
): OpcaoDeDestino[] {
  const vivas = paginas.filter((p) => !p.deleted_at);
  const q = busca.trim() ? dobrar(busca.trim()) : "";
  const tituloDe = (p: ResumoDaNota) =>
    p.kind === "inbox" ? "Caixa de entrada" : p.title || "Sem título";
  return vivas
    .filter((p) => !q || dobrar(tituloDe(p)).includes(q))
    .sort(
      (a, b) =>
        (a.kind === "inbox" ? -1 : 0) - (b.kind === "inbox" ? -1 : 0) ||
        b.updated_at.localeCompare(a.updated_at),
    )
    .slice(0, limite)
    .map((p) => ({
      id: p.id,
      titulo: tituloDe(p),
      icone: p.icon,
      caminho: caminhoDaNota(vivas, p.id)
        .slice(0, -1)
        .map((n) => n.title || "Sem título")
        .join(" › "),
      inbox: p.kind === "inbox",
    }));
}
