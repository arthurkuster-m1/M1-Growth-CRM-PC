"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";
import type { Bloco } from "@/lib/marketing/blocos";
import type { PaginaDeMarketing } from "@/lib/marketing/paginas";

const ESPERA_PARA_SALVAR_MS = 900;

export type EstadoDoSalvamento = "salvo" | "pendente" | "salvando" | "erro";

/**
 * Uma página de marketing: o que se lê (publicado), o que a agência edita (rascunho) e as
 * ações de salvar, publicar e tirar do ar.
 *
 * O rascunho é salvo SOZINHO, depois de uma pausa na digitação (e na saída da tela). `publicar`
 * primeiro grava o que estiver pendente — o cliente nunca recebe uma versão mais velha que a
 * que a agência acabou de ver.
 */
export function usePaginaDeMarketing(chave: string) {
  const queryClient = useQueryClient();
  const rota = `/api/v1/marketing/pages/${chave}`;
  const chaveDaConsulta = ["marketing-page", chave] as const;

  const consulta = useQuery({
    queryKey: chaveDaConsulta,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { page: PaginaDeMarketing } }>(rota);
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
      const r = await apiClient.put<{ data: { updated_at: string } }>(`${rota}/draft`, {
        blocks: alvo,
      });
      queryClient.setQueryData<PaginaDeMarketing>(chaveDaConsulta, (p) =>
        p ? { ...p, draft: { blocks: alvo, updated_at: r.data.updated_at } } : p,
      );
      setEstado(pendente.current ? "pendente" : "salvo");
      return true;
    } catch (erro) {
      // Não perde a edição: volta para pendente e a próxima tentativa a leva junto.
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

  // Saiu da tela com edição pendente: grava agora.
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
  // O que aparece no editor: o que a pessoa está digitando, senão o rascunho salvo, senão o publicado.
  const blocos: Bloco[] = edicao ?? pagina?.draft?.blocks ?? pagina?.published_blocks ?? [];

  async function publicar(): Promise<boolean> {
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = undefined;
    }
    // Garante o rascunho no servidor (mesmo que vazio de mudanças) antes de publicar.
    if (!pendente.current && !pagina?.draft) pendente.current = blocos;
    if (!(await gravar())) return false;
    try {
      await apiClient.post(`${rota}/publish`, {});
      await queryClient.invalidateQueries({ queryKey: chaveDaConsulta });
      return true;
    } catch (erro) {
      showApiError(erro);
      return false;
    }
  }

  async function tirarDoAr(): Promise<boolean> {
    try {
      await apiClient.post(`${rota}/unpublish`, {});
      await queryClient.invalidateQueries({ queryKey: chaveDaConsulta });
      return true;
    } catch (erro) {
      showApiError(erro);
      return false;
    }
  }

  /** Troca o título da página (subpáginas): grava o que estiver pendente junto, sem perder edição. */
  async function renomear(title: string): Promise<boolean> {
    if (temporizador.current) {
      clearTimeout(temporizador.current);
      temporizador.current = undefined;
    }
    pendente.current = pendente.current ?? blocos;
    pendente.current = pendente.current ?? [];
    const alvo = pendente.current;
    pendente.current = null;
    try {
      await apiClient.put(`${rota}/draft`, { title, blocks: alvo });
      queryClient.setQueryData<PaginaDeMarketing>(chaveDaConsulta, (p) =>
        p ? { ...p, title } : p,
      );
      setEstado("salvo");
      return true;
    } catch (erro) {
      pendente.current = alvo;
      setEstado("erro");
      showApiError(erro);
      return false;
    }
  }

  return {
    pagina,
    renomear,
    carregando: consulta.isLoading,
    falhou: consulta.isError,
    blocos,
    estado,
    editar,
    publicar,
    tirarDoAr,
  };
}
