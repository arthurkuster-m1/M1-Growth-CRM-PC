/**
 * GET /api/v1/clientes/importar/opcoes — o que a página de importar leads precisa para montar a
 * tabela: os funis, as etapas de cada um e os campos personalizados de cada funil. Atendente em
 * diante (a leitura de funis em /pipelines exige gerente).
 */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { camposDoFunil } from "@/lib/leads/campos-do-funil";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const orgId = authz.org.orgId;
  const supabase = await createClient();

  const [funis, etapas] = await Promise.all([
    supabase
      .from("crm_pipelines")
      .select("id, name, settings")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
    supabase
      .from("crm_stages")
      .select("id, pipeline_id, name, is_won, is_lost")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
  ]);
  if (funis.error || etapas.error) {
    return fail(
      "internal_error",
      traduzir("Não consegui carregar os funis.", authz.user.idioma),
      500,
      { requestId },
    );
  }
  return ok(
    {
      funis: (funis.data ?? []).map((f) => ({
        id: f.id as string,
        name: f.name as string,
        campos: camposDoFunil((f.settings as Record<string, unknown> | null) ?? null).map((c) => ({
          key: c.key,
          label: c.label,
        })),
      })),
      etapas: (etapas.data ?? []) as Array<{
        id: string;
        pipeline_id: string;
        name: string;
        is_won: boolean;
        is_lost: boolean;
      }>,
    },
    { requestId },
  );
}
