"use client";

import { useQuery } from "@tanstack/react-query";

import type { CustomFieldDef } from "@/lib/schemas/settings";
import { camposDoFunil } from "@/lib/leads/campos-do-funil";
import { apiClient } from "@/lib/api/client";

/** Os funis da organização com os campos personalizados de cada um (para a ficha e a tabela). */
export function useCamposDosFunis(ativo: boolean) {
  const consulta = useQuery({
    queryKey: ["pipelines", "campos-personalizados"],
    enabled: ativo,
    staleTime: 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: Array<{ id: string; settings: Record<string, unknown> | null }>;
        }>("/api/v1/pipelines")
      ).data,
  });
  const porFunil = new Map<string, CustomFieldDef[]>();
  for (const f of consulta.data ?? []) porFunil.set(f.id, camposDoFunil(f.settings));
  return { camposDoFunil: (id: string): CustomFieldDef[] => porFunil.get(id) ?? [] };
}

export interface ResumoDaImportacaoDoCRM {
  total_linhas: number;
  contatos_criados: number;
  contatos_atualizados: number;
  cards_criados: number;
  sem_funil: number;
  erros: { linha: number; motivo: string }[];
  colunas_personalizadas: string[];
}

/**
 * Manda as pessoas (cabeçalho + linhas) para o CRM. Sem `pipeline_id` (e sem coluna "Funil"), o
 * lead fica só guardado, sem funil e sem venda.
 */
export async function enviarLeadsParaOCRM(corpo: {
  pipeline_id?: string | null;
  stage_id?: string | null;
  celulas: string[][];
}): Promise<ResumoDaImportacaoDoCRM> {
  const r = await apiClient.post<{ data: ResumoDaImportacaoDoCRM }>(
    "/api/v1/clientes/importar",
    corpo,
  );
  return r.data;
}
