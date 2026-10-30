"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

import { definirClienteDaAgencia } from "@/lib/agencia/cliente-da-aba";

interface ClienteAtivo {
  id: string;
  name: string;
}

const Ctx = createContext<ClienteAtivo | null>(null);

/** O cliente que a tela do modo agência está editando; `null` fora dela (a empresa da sessão vale). */
export const useClienteDaAgencia = (): ClienteAtivo | null => useContext(Ctx);

/**
 * Põe uma árvore de componentes "dentro" de um cliente da agência: o `apiClient` passa a carimbar o
 * cliente nas chamadas do cronograma e cada cliente tem o SEU cache de consultas (trocar de cliente
 * nunca mostra o dado do anterior, e voltar a um já aberto é instantâneo).
 */
export function ClienteDaAgenciaProvider({
  cliente,
  children,
}: {
  cliente: ClienteAtivo;
  children: ReactNode;
}) {
  const caches = useRef(new Map<string, QueryClient>());
  let qc = caches.current.get(cliente.id);
  if (!qc) {
    qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
    caches.current.set(cliente.id, qc);
  }
  // Definido NO RENDER (e não em efeito): as consultas dos filhos disparam antes dos efeitos do pai.
  definirClienteDaAgencia(cliente.id);
  useEffect(() => () => definirClienteDaAgencia(null), []);
  return (
    <Ctx.Provider value={cliente}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </Ctx.Provider>
  );
}
