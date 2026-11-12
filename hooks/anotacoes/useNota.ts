"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { NotaAberta } from "@/lib/anotacoes/paginas";
import type { Bloco } from "@/lib/marketing/blocos";

const ESPERA_PARA_SALVAR_MS = 900;

export type EstadoDoSalvamento = "salvo" | "pendente" | "salvando" | "erro";

/**
 * Uma página de anotação aberta: o conteúdo e o salvamento sozinho (depois de uma pausa na
 * digitação e ao sair da página). Sem rascunho nem "publicar": o que está na tela é a única versão.
 * Cada página tem a sua fila, então trocar de página nunca grava o conteúdo de uma na outra.
 */
export function useNota(id: string) {
  const queryClient = useQueryClient();
  const chave = ["anotacoes", "pagina", id] as const;
  const rota = `/api/v1/anotacoes/${id}`;

  const consulta = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { page: NotaAberta } }>(rota);
      return r.data.page;
    },
    staleTime: 15_000,
  });

  const [edicao, setEdicao] = useState<Bloco[] | null>(null);
  const [estado, setEstado] = useState<EstadoDoSalvamento>("salvo");
  const pendente = useRef<Bloco[] | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const gravar = useCallback(async (): Promise<boolean> => {
    const alvo = pendente.current;
    if (!alvo) return true;
    pendente.current = null;
    setEstado("salvando");
    try {
      await apiClient.patch(rota, { blocks: alvo });
      queryClient.setQueryData<NotaAberta>(chave, (p) => (p ? { ...p, blocks: alvo } : p));
      setEstado(pendente.current ? "pendente" : "salvo");
      return true;
    } catch (erro) {
      // Não perde a edição: a próxima tentativa a leva junto.
      pendente.current = pendente.current ?? alvo;
      setEstado("erro");
      showApiError(erro);
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rota, queryClient]);

  const editar = useCallback(
    (blocos: Bloco[]) => {
      setEdicao(blocos);
      pendente.current = blocos;
      setEstado("pendente");
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        temporizador.current = undefined;
        void gravar();
      }, ESPERA_PARA_SALVAR_MS);
    },
    [gravar],
  );

  // Saiu da página (ou trocou de página) com edição pendente: grava agora.
  useEffect(
    () => () => {
      if (temporizador.current) {
        clearTimeout(temporizador.current);
        void gravar();
      }
    },
    [gravar],
  );

  const pagina = consulta.data;
  const blocos: Bloco[] = edicao ?? pagina?.blocks ?? [];

  return {
    pagina,
    blocos,
    estado,
    editar,
    carregando: consulta.isLoading,
    falhou: consulta.isError,
  };
}
