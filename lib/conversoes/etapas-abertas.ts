import type { SupabaseClient } from "@supabase/supabase-js";

/** Uma etapa ABERTA de um funil (nem ganho nem perda), com o nome do funil, para escolher o que ela informa à Meta. */
export interface EtapaAbertaDoFunil {
  id: string;
  nome: string;
  funil: string;
  /** É a primeira do funil: é onde o lead nasce (a sugestão "Lead enviado"). */
  primeira: boolean;
}

/** As etapas abertas da organização, agrupadas por funil, na ordem do funil. Lança em falha de leitura. */
export async function lerEtapasAbertas(
  admin: SupabaseClient,
  organizationId: string,
): Promise<EtapaAbertaDoFunil[]> {
  const { data, error } = await admin
    .from("crm_stages")
    .select("id, name, pipeline_id, crm_pipelines(name)")
    .eq("organization_id", organizationId)
    .eq("is_won", false)
    .eq("is_lost", false)
    .order("position");
  if (error) throw new Error("Não foi possível ler as etapas do funil.");
  const vistos = new Set<string>();
  return (
    (data ?? []) as unknown as Array<{
      id: string;
      name: string;
      pipeline_id: string;
      crm_pipelines: { name: string } | Array<{ name: string }> | null;
    }>
  )
    .map((e) => ({
      id: e.id,
      nome: e.name,
      pipelineId: e.pipeline_id,
      funil:
        (Array.isArray(e.crm_pipelines) ? e.crm_pipelines[0] : e.crm_pipelines)?.name ?? "Funil",
    }))
    .sort((a, b) => a.funil.localeCompare(b.funil))
    .map((e) => {
      const primeira = !vistos.has(e.pipelineId);
      vistos.add(e.pipelineId);
      return { id: e.id, nome: e.nome, funil: e.funil, primeira };
    });
}
