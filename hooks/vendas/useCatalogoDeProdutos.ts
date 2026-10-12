"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { ResumoDeSubpagina } from "@/lib/marketing/paginas";

export interface ProdutoDoCatalogo {
  id: string;
  nome: string;
  /** Preço de tabela em reais (0 = sem preço definido). */
  valor: number;
}

/** Os produtos e serviços cadastrados em Marketing › Produtos e Ofertas (o catálogo de vendas). */
export function useCatalogoDeProdutos(ativo = true) {
  const consulta = useQuery({
    queryKey: ["catalogo-de-produtos"],
    enabled: ativo,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { subpaginas: ResumoDeSubpagina[] } }>(
        "/api/v1/marketing/pages?modulo=produtos-e-ofertas",
      );
      return r.data.subpaginas
        .filter((s) => s.oferta)
        .map((s): ProdutoDoCatalogo => ({
          id: s.id,
          nome: s.title || "Produto sem nome",
          valor: s.oferta?.valor ?? 0,
        }))
        .sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });
  return { produtos: consulta.data ?? [], carregando: consulta.isLoading };
}
