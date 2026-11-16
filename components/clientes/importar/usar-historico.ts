"use client";

import { useCallback, useEffect, useReducer } from "react";

import type { LinhaDeLead } from "./GradeDeLeads";

/**
 * O DESFAZER / REFAZER (Ctrl+Z / Ctrl+Y) da tabela de importar leads. A grade da biblioteca só
 * cuida de selecionar, copiar, colar e apagar — o histórico é daqui: cada mudança (editar,
 * colar, apagar, arrastar para preencher, inserir ou excluir linhas, mostrar/ocultar/reordenar
 * colunas, limpar, abrir arquivo) guarda o estado de antes. Digitar várias letras na mesma
 * célula, em seguida, conta como UMA mudança.
 */
export interface EstadoDaTabela {
  linhas: LinhaDeLead[];
  visiveis: string[];
  extras: string[];
}

interface Historico {
  atual: EstadoDaTabela;
  passado: EstadoDaTabela[];
  futuro: EstadoDaTabela[];
  /** A última edição de uma célula só, para juntar as letras digitadas em seguida. */
  ultima: { chave: string; em: number } | null;
}

type Acao =
  | { tipo: "mudar"; parcial: Partial<EstadoDaTabela>; agrupar?: string; em: number }
  | { tipo: "desfazer" }
  | { tipo: "refazer" };

const LIMITE = 100;
const JANELA_MS = 800;

function reduzir(h: Historico, a: Acao): Historico {
  if (a.tipo === "mudar") {
    const novo = { ...h.atual, ...a.parcial };
    const junta = !!a.agrupar && h.ultima?.chave === a.agrupar && a.em - h.ultima.em < JANELA_MS;
    return {
      atual: novo,
      passado: junta ? h.passado : [...h.passado, h.atual].slice(-LIMITE),
      futuro: [],
      ultima: a.agrupar ? { chave: a.agrupar, em: a.em } : null,
    };
  }
  if (a.tipo === "desfazer") {
    const anterior = h.passado[h.passado.length - 1];
    if (!anterior) return h;
    return {
      atual: anterior,
      passado: h.passado.slice(0, -1),
      futuro: [h.atual, ...h.futuro].slice(0, LIMITE),
      ultima: null,
    };
  }
  const proximo = h.futuro[0];
  if (!proximo) return h;
  return {
    atual: proximo,
    passado: [...h.passado, h.atual].slice(-LIMITE),
    futuro: h.futuro.slice(1),
    ultima: null,
  };
}

/** Qual célula mudou, se foi UMA só (para juntar as letras de uma digitação). */
export function celulaUnicaAlterada(
  antes: LinhaDeLead[],
  depois: LinhaDeLead[],
): string | undefined {
  if (antes.length !== depois.length) return undefined;
  let achada: string | undefined;
  for (let i = 0; i < antes.length; i += 1) {
    if (antes[i] === depois[i]) continue;
    const a = antes[i]!;
    const d = depois[i]!;
    for (const k of new Set([...Object.keys(a), ...Object.keys(d)])) {
      if ((a[k] ?? "") === (d[k] ?? "")) continue;
      if (achada) return undefined;
      achada = `${i}|${k}`;
    }
  }
  return achada;
}

export function useHistorico(inicial: () => EstadoDaTabela) {
  const [h, despachar] = useReducer(reduzir, undefined, () => ({
    atual: inicial(),
    passado: [],
    futuro: [],
    ultima: null,
  }));

  const mudar = useCallback(
    (parcial: Partial<EstadoDaTabela>, agrupar?: string) =>
      despachar({ tipo: "mudar", parcial, agrupar, em: Date.now() }),
    [],
  );
  const desfazer = useCallback(() => despachar({ tipo: "desfazer" }), []);
  const refazer = useCallback(() => despachar({ tipo: "refazer" }), []);

  // Ctrl+Z / Ctrl+Y (⌘ no Mac) — na grade ou fora de qualquer campo; nos outros campos da página
  // (custo, caixa de colar) vale o desfazer do próprio campo.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      const desf = k === "z" && !e.shiftKey;
      const ref = k === "y" || (k === "z" && e.shiftKey);
      if (!desf && !ref) return;
      const alvo = e.target instanceof HTMLElement ? e.target : null;
      const campo = alvo?.closest("input, textarea, select, [contenteditable='true']");
      if (campo && !campo.closest(".leads-grade")) return;
      e.preventDefault();
      // Nesta página o Ctrl+Z é da tabela: o atalho geral do app (que desfaz edições gravadas em
      // outras telas) não pode rodar junto.
      e.stopImmediatePropagation();
      if (desf) desfazer();
      else refazer();
    }
    window.addEventListener("keydown", aoTeclar, { capture: true });
    return () => window.removeEventListener("keydown", aoTeclar, { capture: true });
  }, [desfazer, refazer]);

  return {
    estado: h.atual,
    mudar,
    desfazer,
    refazer,
    podeDesfazer: h.passado.length > 0,
    podeRefazer: h.futuro.length > 0,
  };
}
