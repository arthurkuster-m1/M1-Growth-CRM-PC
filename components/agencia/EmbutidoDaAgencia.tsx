"use client";

import { useEffect, useLayoutEffect } from "react";

import { definirClienteDaAgencia, HEADER_CLIENTE_DA_AGENCIA } from "@/lib/agencia/cliente-da-aba";

let fetchOriginal: typeof window.fetch | null = null;

/**
 * Deixa ESTE documento (um iframe do Modo agência) agindo como o cliente `clienteId`: toda chamada à
 * própria origem — as da API e as navegações suaves do Next — leva o header do cliente. O servidor o
 * reconfere contra as associações da pessoa (`clienteDoPedido`). Idempotente.
 */
function instalarCliente(clienteId: string): void {
  definirClienteDaAgencia(clienteId);
  if (fetchOriginal) return;
  fetchOriginal = window.fetch.bind(window);
  window.fetch = (entrada, init) => {
    try {
      const url = new URL(
        typeof entrada === "string" || entrada instanceof URL ? entrada.toString() : entrada.url,
        window.location.href,
      );
      if (url.origin === window.location.origin) {
        const cabecalhos = new Headers(init?.headers ?? (entrada instanceof Request ? entrada.headers : undefined));
        if (!cabecalhos.has(HEADER_CLIENTE_DA_AGENCIA)) cabecalhos.set(HEADER_CLIENTE_DA_AGENCIA, clienteId);
        return fetchOriginal!(entrada, { ...init, headers: cabecalhos });
      }
    } catch {
      /* URL ilegível: segue sem carimbo */
    }
    return fetchOriginal!(entrada, init);
  };
}

/**
 * O gancho do iframe: instala o cliente ANTES de qualquer consulta dos filhos (render roda antes dos
 * efeitos) e avisa a página-mãe da altura do conteúdo, para o quadro crescer sem barra interna.
 */
export function EmbutidoDaAgencia({ clienteId }: { clienteId: string }) {
  instalarCliente(clienteId);
  useLayoutEffect(() => {
    const avisar = () =>
      window.parent?.postMessage(
        { tipo: "agencia-altura", cliente: clienteId, altura: document.documentElement.scrollHeight },
        window.location.origin,
      );
    avisar();
    const observador = new ResizeObserver(avisar);
    observador.observe(document.body);
    return () => observador.disconnect();
  }, [clienteId]);
  useEffect(() => {
    document.documentElement.dataset.embutido = "1";
  }, []);
  return null;
}
