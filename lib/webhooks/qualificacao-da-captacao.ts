import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * O LEAD QUE JÁ CHEGA QUALIFICADO.
 *
 * Um formulário com perguntas de qualificação (na página de captura, no n8n, em qualquer
 * ferramenta) decide, do lado dele, se a pessoa passou. Basta mandar isso no corpo do webhook, num
 * destes campos com um valor afirmativo (`true`, `sim`, `1`…) — e o lead já nasce na etapa de MQL do
 * funil, em vez da primeira. Entrar na etapa de MQL marca o contato como MQL sozinho (trigger do
 * banco) e avisa a Meta (`QualifiedLead`), como em qualquer outra entrada nessa etapa.
 *
 * Quem NÃO manda o campo (ou manda "não") entra na primeira etapa, como sempre foi. Funil sem
 * etapa de MQL também não muda nada.
 */
export const CAMPOS_DE_QUALIFICADO = [
  "qualificado",
  "qualificada",
  "qualified",
  "lead_qualificado",
  "mql",
] as const;

const AFIRMATIVOS = new Set(["true", "1", "sim", "s", "yes", "y", "qualificado", "qualificada"]);

const normalizar = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/** O formulário disse que a pessoa passou na qualificação? Lê o payload já achatado (chave → texto). */
export function veioQualificado(payload: Record<string, string>): boolean {
  for (const [chave, valor] of Object.entries(payload)) {
    // A chave pode vir aninhada ("respostas.qualificado"): vale o último trecho.
    const nome = normalizar(
      chave
        .split(/[.\[\]]/)
        .filter(Boolean)
        .pop() ?? chave,
    );
    if (
      (CAMPOS_DE_QUALIFICADO as readonly string[]).includes(nome) &&
      AFIRMATIVOS.has(normalizar(valor))
    ) {
      return true;
    }
  }
  return false;
}

/** A etapa de MQL do funil (a primeira, se houver mais de uma); `null` se o funil não tem. */
export async function etapaDeMql(
  db: SupabaseClient,
  organizationId: string,
  pipelineId: string,
): Promise<string | null> {
  const { data } = await db
    .from("crm_stages")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("pipeline_id", pipelineId)
    .eq("is_archived", false)
    .eq("is_won", false)
    .eq("is_lost", false)
    .eq("qualification", "mql")
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
