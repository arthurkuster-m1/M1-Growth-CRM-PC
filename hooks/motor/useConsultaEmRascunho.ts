"use client";

import { useState } from "react";

import { consultasIguais, normalizarConsulta, type ConsultaDaTabela } from "@/lib/motor/consulta";
import type { PreferenciasDaTabela } from "@/lib/motor/layout";

/**
 * O filtro SALVO é o padrão da visualização (como no Notion). Filtro, ordem e agrupamento são um
 * RASCUNHO por cima do que está salvo: o que se muda vale na tela, "Reset" volta ao salvo e
 * "Salvar" grava o rascunho como o novo padrão. Não há "Limpar tudo": tirar um filtro é mexer no
 * rascunho, e só vira definitivo ao salvar.
 *
 * Um rascunho por aba (`ativaId`), na memória da página: recarregar descarta, trocar de aba não.
 * Colunas, larguras e o resto do layout seguem gravando na hora, como sempre.
 */
export function useConsultaEmRascunho({
  ativaId,
  salvas,
  atualizar,
  podeSalvar,
}: {
  ativaId: string;
  /** As preferências SALVAS da aba ativa (da visualização, ou as pessoais da aba de fábrica). */
  salvas: PreferenciasDaTabela;
  /** Grava na aba ativa (a mesma função que a tela usa para colunas e larguras). */
  atualizar: (mudar: (atual: PreferenciasDaTabela) => PreferenciasDaTabela) => void;
  /** Quem pode alterar a visualização; para os demais só o Reset aparece. */
  podeSalvar: boolean;
}) {
  const [rascunhos, setRascunhos] = useState<Record<string, ConsultaDaTabela>>({});
  const rascunho = rascunhos[ativaId];
  const alterada = rascunho !== undefined && !consultasIguais(rascunho, salvas);

  const preferencias: PreferenciasDaTabela = rascunho
    ? {
        ...salvas,
        filtros: rascunho.filtros,
        ordenacao: rascunho.ordenacao,
        agrupar: rascunho.agrupar,
        agruparPor: rascunho.agruparPor,
      }
    : salvas;

  const resetar = () =>
    setRascunhos(({ [ativaId]: _descartado, ...resto }) => {
      void _descartado;
      return resto;
    });

  const salvar = () => {
    if (!rascunho) return;
    const consulta = normalizarConsulta(rascunho);
    atualizar((p) => ({
      ...p,
      filtros: consulta.filtros,
      ordenacao: consulta.ordenacao,
      agrupar: consulta.agrupar,
      agruparPor: consulta.agruparPor,
    }));
    resetar();
  };

  return {
    preferencias,
    mudarConsulta: (c: ConsultaDaTabela) =>
      setRascunhos((r) => ({ ...r, [ativaId]: normalizarConsulta(c) })),
    /** Para a prop `salvamento` da `BarraDeConsulta`. */
    salvamento: {
      alterada,
      aoResetar: resetar,
      aoSalvar: podeSalvar ? salvar : undefined,
    },
  };
}
