"use client";

import * as React from "react";

import { EVENTO_NOVO_COMPROMISSO, type PedidoDeNovoCompromisso } from "@/lib/agenda/abrir-novo";

import { PaginaDoCompromisso } from "./PaginaDoCompromisso";

/**
 * Fica no casco do app e abre a página do compromisso quando qualquer tela pede "Novo
 * agendamento" (`abrirNovoCompromisso`). Depois de criar, a mesma janela passa a mostrar o
 * compromisso criado, já editável.
 */
export function NovoCompromissoGlobal() {
  const [pedido, setPedido] = React.useState<PedidoDeNovoCompromisso | null>(null);
  const [criadoId, setCriadoId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const ouvir = (e: Event) => {
      setCriadoId(null);
      setPedido((e as CustomEvent<PedidoDeNovoCompromisso>).detail ?? {});
    };
    window.addEventListener(EVENTO_NOVO_COMPROMISSO, ouvir);
    return () => window.removeEventListener(EVENTO_NOVO_COMPROMISSO, ouvir);
  }, []);

  if (!pedido) return null;
  return (
    <PaginaDoCompromisso
      id={criadoId}
      novo={pedido}
      onCriado={setCriadoId}
      onClose={() => {
        setPedido(null);
        setCriadoId(null);
      }}
    />
  );
}
