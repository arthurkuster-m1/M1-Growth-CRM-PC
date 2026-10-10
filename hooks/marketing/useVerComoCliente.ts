"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHAVE = "m1-marketing-ver-como-cliente";
const EVENTO = "m1-ver-como-cliente";

function ler(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

function assinar(aoMudar: () => void): () => void {
  window.addEventListener(EVENTO, aoMudar);
  window.addEventListener("storage", aoMudar);
  return () => {
    window.removeEventListener(EVENTO, aoMudar);
    window.removeEventListener("storage", aoMudar);
  };
}

/**
 * "VER COMO CLIENTE" — a agência olha as páginas de Marketing exatamente como o cliente as vê
 * (só o publicado, sem botões de edição), sem trocar de conta. É só uma visão: as permissões
 * reais seguem as do usuário. Fica guardado neste navegador.
 */
export function useVerComoCliente() {
  const ativo = useSyncExternalStore(assinar, ler, () => false);
  const definir = useCallback((valor: boolean) => {
    try {
      window.localStorage.setItem(CHAVE, valor ? "1" : "0");
    } catch {
      /* sem armazenamento: a visão vale só até recarregar */
    }
    window.dispatchEvent(new Event(EVENTO));
  }, []);
  return { ativo, definir };
}
