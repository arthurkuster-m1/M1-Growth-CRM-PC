"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { registrarDesfazer } from "@/lib/motor/desfazer";
import type { UpdateTenantInput } from "@/lib/schemas/tenant-update";
import type { TenantDetailResponse } from "@/hooks/useTenantDetail";

/** Campos da empresa que a ficha edita (a marca vive em `settings.branding`). */
export type EdicaoDaEmpresa = UpdateTenantInput;

interface Opcoes {
  /** Como voltar atrás depois (Ctrl+Z); sem isto a edição não entra na pilha. */
  anterior?: EdicaoDaEmpresa;
  rotulo?: string;
}

/**
 * Salva um pedaço do cadastro da empresa (PATCH) com edição otimista: a tela muda na hora,
 * volta se o servidor recusar, e a edição entra na pilha do Ctrl+Z.
 */
export function useUpdateTenant(id: string) {
  const qc = useQueryClient();
  const chave = ["admin", "tenant", id] as const;

  const mutation = useMutation({
    mutationFn: ({ patch }: { patch: EdicaoDaEmpresa } & Opcoes) =>
      apiClient.patch<unknown>(`/api/v1/admin/tenants/${id}`, patch),
    onMutate: async ({ patch }) => {
      await qc.cancelQueries({ queryKey: chave });
      const antes = qc.getQueryData<TenantDetailResponse>(chave);
      if (antes) {
        const { marca: _marca, ...colunas } = patch;
        qc.setQueryData<TenantDetailResponse>(chave, {
          ...antes,
          data: { ...antes.data, organization: { ...antes.data.organization, ...colunas } },
        });
      }
      return { antes };
    },
    onError: (_erro, _vars, contexto) => {
      if (contexto?.antes) qc.setQueryData(chave, contexto.antes);
    },
    onSuccess: (_dados, { anterior, rotulo }) => {
      if (anterior) {
        registrarDesfazer({
          rotulo,
          desfazer: () => mutation.mutateAsync({ patch: anterior }),
        });
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: chave });
      void qc.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
  });
  return mutation;
}
