"use client";

import { useEffect, useState } from "react";

import { EVENTO_ANOTACAO_RAPIDA } from "@/components/anotacoes/AnotacaoRapida";

/**
 * Quem mostra uma página das Anotações (o cartão do Início, a tela de Anotações) precisa saber
 * quando uma ANOTAÇÃO RÁPIDA (o lápis da barra do topo) entrou nela. `versao` sobe a cada anotação,
 * para quem mostra a página remontar o editor — em vez de o salvamento sozinho sobrescrever o que
 * acabou de entrar. O lápis já tirou a página do cache e releu a árvore.
 */
export function useVersaoDasNotas(): number {
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    const aoEntrar = () => setVersao((v) => v + 1);
    window.addEventListener(EVENTO_ANOTACAO_RAPIDA, aoEntrar);
    return () => window.removeEventListener(EVENTO_ANOTACAO_RAPIDA, aoEntrar);
  }, []);
  return versao;
}
