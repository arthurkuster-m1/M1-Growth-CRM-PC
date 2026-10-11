import { lerNumero } from "@/lib/marketing/calculadora";
import type { CanalDaCampanha } from "@/lib/marketing/campanhas";
import {
  MAXIMO_DE_DIAS_POR_ENVIO,
  METRICAS_DO_CANAL,
  colunasDoDiaAdia,
  type DiaDaCampanha,
} from "@/lib/marketing/campanhas-resumo";
import { campos, semAcento } from "@/lib/marketing/produtos-csv";

/**
 * A PLANILHA DO DIA A DIA (CSV): quem já tem os números numa planilha cola aqui em vez de digitar
 * dia por dia. Aceita `;` `,` ou tabulação, datas `31/12/2026` ou `2026-12-31`, e números como
 * "R$ 1.234,56". Os nomes das colunas vêm sem acento e em qualquer caixa.
 */

const APELIDOS: Record<string, string> = {
  data: "dia",
  dia: "dia",
  impressoes: "impressoes",
  impressao: "impressoes",
  alcance: "alcance",
  cliques: "cliques",
  cliques_no_link: "cliques",
  cliques_link: "cliques",
  visitas: "visitas_a_lp",
  visitas_a_lp: "visitas_a_lp",
  visitas_na_lp: "visitas_a_lp",
  visualizacoes_da_pagina: "visitas_a_lp",
  investido: "investido",
  investimento: "investido",
  gasto: "investido",
  valor_investido: "investido",
  valor_gasto: "investido",
};

const chave = (c: string) =>
  semAcento(c)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/** `31/12/2026`, `31-12-26` ou `2026-12-31` → `2026-12-31`; ilegível → null. */
export function dataDoTexto(texto: string): string | null {
  const s = texto.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  let a: number, mes: number, d: number;
  if (m) {
    [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})/.exec(s);
    if (!m) return null;
    [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (a < 100) a += 2000;
  }
  const data = new Date(Date.UTC(a, mes - 1, d));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== d) {
    return null;
  }
  return data.toISOString().slice(0, 10);
}

export interface DiasLidos {
  dias: Array<Omit<DiaDaCampanha, "id" | "source">>;
  problemas: Array<{ linha: number; erro: "dia_invalido" | "numero_invalido" }>;
  ignoradas: string[];
  erro: "vazia" | "sem_dia" | "muitas_linhas" | null;
}

export function lerDias(texto: string, canal: CanalDaCampanha): DiasLidos {
  const vazio = (erro: DiasLidos["erro"]): DiasLidos => ({
    dias: [],
    problemas: [],
    ignoradas: [],
    erro,
  });
  const tabela = campos(texto);
  if (tabela.length === 0) return vazio("vazia");
  const proprias = new Set(
    canal === "trafego_pago" ? [] : METRICAS_DO_CANAL[canal].map((m) => m.chave),
  );
  const mapa = tabela[0]!.map((c) => {
    const k = chave(c);
    return APELIDOS[k] ?? (proprias.has(k) ? k : null);
  });
  if (!mapa.includes("dia")) return vazio("sem_dia");
  if (tabela.length - 1 > MAXIMO_DE_DIAS_POR_ENVIO) return vazio("muitas_linhas");

  const ignoradas = tabela[0]!.filter((c, i) => !mapa[i] && c.trim() !== "");
  const problemas: DiasLidos["problemas"] = [];
  const dias: DiasLidos["dias"] = [];
  tabela.slice(1).forEach((l, i) => {
    const linha = i + 2;
    const celula = (k: string) => l[mapa.indexOf(k)] ?? "";
    const dia = dataDoTexto(celula("dia"));
    if (!dia) return void problemas.push({ linha, erro: "dia_invalido" });
    const numero = (k: string): number | null => {
      const bruto = celula(k).trim();
      if (bruto === "") return 0;
      const n = lerNumero(bruto);
      return n === null || n < 0 ? null : n;
    };
    const inteiro = (k: string) => {
      const n = numero(k);
      return n === null ? null : Math.round(n);
    };
    const impressions = inteiro("impressoes");
    const reach = inteiro("alcance");
    const link_clicks = inteiro("cliques");
    const lp_views = inteiro("visitas_a_lp");
    const spend = numero("investido");
    const extras: Record<string, number> = {};
    let falhou = [impressions, reach, link_clicks, lp_views, spend].includes(null);
    for (const k of proprias) {
      if (!mapa.includes(k)) continue;
      const n = numero(k);
      if (n === null) falhou = true;
      else extras[k] = n;
    }
    if (falhou) return void problemas.push({ linha, erro: "numero_invalido" });
    dias.push({
      day: dia,
      impressions: impressions!,
      reach: reach!,
      link_clicks: link_clicks!,
      lp_views: lp_views!,
      leads: 0,
      spend: spend!,
      extras,
    });
  });
  return { dias, problemas, ignoradas, erro: null };
}

/** O modelo para baixar: cabeçalho do canal e um exemplo, com `;` e BOM (abre bem no Excel). */
export function modeloDoDiaAdia(canal: CanalDaCampanha): string {
  const colunas = colunasDoDiaAdia(canal);
  const exemplo = colunas.map((c) =>
    c === "dia" ? "01/10/2026" : c === "investido" ? "25,50" : "10",
  );
  return `﻿${[colunas, exemplo].map((l) => l.join(";")).join("\r\n")}\r\n`;
}
