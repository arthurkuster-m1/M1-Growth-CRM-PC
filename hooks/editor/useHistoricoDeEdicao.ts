"use client";

import { useRef } from "react";

const JANELA_MS = 1000;
const LIMITE = 100;

/**
 * Ctrl+Z / Ctrl+Shift+Z de um editor cujo estado vive FORA dele (a lista de blocos que o pai
 * guarda). Cada mudança guarda o estado anterior; mudanças seguidas na MESMA `chave` (o bloco que
 * está sendo digitado), dentro de 1 s, contam como uma só.
 *
 * Padrão do produto: tudo que edita ou apaga dado se desfaz com Ctrl+Z.
 */
export function useHistoricoDeEdicao<T>(valor: T, aplicar: (novo: T) => void) {
  const h = useRef<{ passado: T[]; futuro: T[]; chave?: string; quando: number }>({
    passado: [],
    futuro: [],
    quando: 0,
  });

  const mudar = (novo: T, chave?: string) => {
    const agora = Date.now();
    const continua =
      chave !== undefined && h.current.chave === chave && agora - h.current.quando < JANELA_MS;
    if (!continua) {
      h.current.passado.push(valor);
      if (h.current.passado.length > LIMITE) h.current.passado.shift();
    }
    h.current.chave = chave;
    h.current.quando = agora;
    h.current.futuro = [];
    aplicar(novo);
  };

  const voltar = (direcao: "desfazer" | "refazer"): T | null => {
    const de = direcao === "desfazer" ? h.current.passado : h.current.futuro;
    const para = direcao === "desfazer" ? h.current.futuro : h.current.passado;
    const alvo = de.pop();
    if (alvo === undefined) return null;
    para.push(valor);
    h.current.chave = undefined;
    aplicar(alvo);
    return alvo;
  };

  return { mudar, desfazer: () => voltar("desfazer"), refazer: () => voltar("refazer") };
}
