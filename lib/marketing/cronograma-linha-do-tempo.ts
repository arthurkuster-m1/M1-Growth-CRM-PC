/**
 * A LINHA DO TEMPO do cronograma: as contas do eixo (dia a dia) e do arrasto das barras. Puro.
 *
 * As ações do cronograma são guardadas em SEMANAS (semana 1, 2, 3…, a partir do domingo da data
 * de início). Na linha do tempo cada barra ocupa os dias da(s) semana(s) dela; arrastar uma barra
 * anda de semana em semana (7 dias por passo), então nada precisa mudar no banco.
 */
import { somarDias } from "@/lib/inicio/datas";
import { domingoDe, MAXIMO_DE_SEMANAS } from "@/lib/marketing/cronograma";

/** Quantos pixels vale um dia em cada escala. */
export type EscalaDoCronograma = "dia" | "semana";
export const LARGURA_DO_DIA: Record<EscalaDoCronograma, number> = { dia: 44, semana: 16 };

const DIA_MS = 86_400_000;

export const diferencaEmDias = (de: string, ate: string): number =>
  Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / DIA_MS);

/** O domingo da semana 1: a data de início do cronograma; sem ela, a semana de hoje. */
export function baseDoCronograma(dataInicio: string | null, hoje: string): string {
  return domingoDe(dataInicio ?? hoje);
}

/** Os dias (inclusivos) que uma ação ocupa, da semana de início até a de fim. */
export function periodoDoItem(
  base: string,
  semanaInicio: number,
  semanaFim: number,
): { inicio: string; fim: string } {
  return {
    inicio: somarDias(base, (semanaInicio - 1) * 7),
    fim: somarDias(base, semanaFim * 7 - 1),
  };
}

export type ModoDeArrasto = "mover" | "inicio" | "fim";

/**
 * As semanas de uma ação depois de arrastar a barra `deltaDias` dias: anda de semana em semana
 * (arredonda), nunca sai de 1…520 nem fica com o fim antes do início.
 */
export function semanasDepoisDoArrasto(
  item: { semana_inicio: number; semana_fim: number },
  modo: ModoDeArrasto,
  deltaDias: number,
): { semana_inicio: number; semana_fim: number } {
  const passo = Math.round(deltaDias / 7);
  const preso = (n: number) => Math.min(MAXIMO_DE_SEMANAS, Math.max(1, n));
  if (modo === "mover") {
    const largura = item.semana_fim - item.semana_inicio;
    const ini = Math.min(MAXIMO_DE_SEMANAS - largura, preso(item.semana_inicio + passo));
    return { semana_inicio: ini, semana_fim: ini + largura };
  }
  if (modo === "inicio") {
    return {
      semana_inicio: Math.min(item.semana_fim, preso(item.semana_inicio + passo)),
      semana_fim: item.semana_fim,
    };
  }
  return {
    semana_inicio: item.semana_inicio,
    semana_fim: Math.max(item.semana_inicio, preso(item.semana_fim + passo)),
  };
}

/** Os dias do eixo: `n` dias a partir da origem. */
export const gerarDias = (origem: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => somarDias(origem, i));

/** Os meses do eixo, com quantos dias cada um ocupa (cabeçalho de cima). */
export function mesesDoEixo(origem: string, dias: number): Array<{ chave: string; dias: number }> {
  const saida: Array<{ chave: string; dias: number }> = [];
  for (const d of gerarDias(origem, dias)) {
    const chave = d.slice(0, 7);
    const ultimo = saida[saida.length - 1];
    if (ultimo && ultimo.chave === chave) ultimo.dias += 1;
    else saida.push({ chave, dias: 1 });
  }
  return saida;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
export const nomeDoMes = (chave: string): string =>
  `${MESES[Number(chave.slice(5, 7)) - 1]} ${chave.slice(0, 4)}`;

/** As semanas do cronograma que começam dentro do eixo (domingo, número e data). */
export function semanasDoEixo(
  origem: string,
  dias: number,
  base: string,
): Array<{ domingo: string; numero: number | null }> {
  const primeiroDomingo = domingoDe(origem) < origem ? somarDias(domingoDe(origem), 7) : origem;
  const saida: Array<{ domingo: string; numero: number | null }> = [];
  for (let d = primeiroDomingo; diferencaEmDias(origem, d) < dias; d = somarDias(d, 7)) {
    const n = diferencaEmDias(base, d) / 7 + 1;
    saida.push({ domingo: d, numero: n >= 1 && n <= MAXIMO_DE_SEMANAS ? n : null });
  }
  return saida;
}
