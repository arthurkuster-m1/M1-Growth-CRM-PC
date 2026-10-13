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
  criados: number;
  contatos_criados: number;
  erros: { linha: number; motivo: string }[];
  colunas_ignoradas: string[];
}

/** Manda a tabela (cabeçalho + linhas) para o servidor, que valida linha a linha. */
export async function enviarLeadsParaOCRM(corpo: {
  pipeline_id: string;
  stage_id?: string;
  celulas: string[][];
}): Promise<ResumoDaImportacaoDoCRM> {
  const r = await apiClient.post<{ data: ResumoDaImportacaoDoCRM }>("/api/v1/leads/import", corpo);
  return r.data;
}
