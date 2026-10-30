"use client";

import { useEffect, useLayoutEffect } from "react";

import {
  definirClienteDaAgencia,
  HEADER_CLIENTE_DA_AGENCIA,
  HEADER_EMBUTIDO,
} from "@/lib/agencia/cliente-da-aba";
import { marcarEmbutido, pedirAbrirNaAgencia } from "@/lib/agencia/embutido";

let fetchOriginal: typeof window.fetch | null = null;

/**
 * Deixa ESTE documento (um iframe do Modo agência) agindo como o cliente `clienteId`: toda chamada à
 * própria origem — as da API e as navegações suaves do Next — leva o header do cliente. O servidor o
 * reconfere contra as associações da pessoa (`clienteDoPedido`). Idempotente.
 */
function instalarCliente(clienteId: string): void {
  definirClienteDaAgencia(clienteId);
  marcarEmbutido(clienteId);
  if (fetchOriginal) return;
  fetchOriginal = window.fetch.bind(window);
  window.fetch = (entrada, init) => {
    try {
      const url = new URL(
        typeof entrada === "string" || entrada instanceof URL ? entrada.toString() : entrada.url,
        window.location.href,
      );
      if (url.origin === window.location.origin) {
        const cabecalhos = new Headers(
          init?.headers ?? (entrada instanceof Request ? entrada.headers : undefined),
        );
        if (!cabecalhos.has(HEADER_CLIENTE_DA_AGENCIA))
          cabecalhos.set(HEADER_CLIENTE_DA_AGENCIA, clienteId);
        cabecalhos.set(HEADER_EMBUTIDO, "1");
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
    // A janela de uma campanha (pop-up) tem altura própria: não mexe na altura do quadro da tabela.
    if (new URLSearchParams(window.location.search).get("_janela") === "1") return;
    const avisar = () =>
      window.parent?.postMessage(
        {
          tipo: "agencia-altura",
          cliente: clienteId,
          altura: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
        },
        window.location.origin,
      );
    avisar();
    const observador = new ResizeObserver(avisar);
    observador.observe(document.body);
    return () => observador.disconnect();
  }, [clienteId]);
  useEffect(() => {
    document.documentElement.dataset.embutido = "1";
    // O quadro cresce com o conteúdo: nada de rolagem interna.
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    // Clique em "Abrir" de uma campanha: em vez de navegar dentro do quadro, a página-mãe abre a janela
    // da campanha. Captura (antes do Link do Next) para o clique não navegar.
    const aoClicar = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (pedirAbrirNaAgencia(url.pathname)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, []);
  return null;
}
