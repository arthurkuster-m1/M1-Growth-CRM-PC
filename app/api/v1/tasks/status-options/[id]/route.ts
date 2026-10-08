import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * PATCH  /api/v1/tasks/status-options/[id] — renomeia, recolore, muda de grupo ou reordena.
 * DELETE /api/v1/tasks/status-options/[id] — apaga uma opção.
 *
 * Duas regras que o banco não impõe e esta rota sim:
 *
 *  - **Cada grupo precisa de ao menos uma opção.** Sem "concluída" nenhuma, marcar uma
 *    tarefa como feita não teria nome na tela. A regra vale para apagar E para mudar a
 *    última opção de um grupo para outro grupo.
 *  - Apagar uma opção NÃO apaga tarefa: o `on delete set null` solta a opção e o
 *    trigger do banco devolve a tarefa à primeira opção do grupo dela.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";
import {
  CORES_DA_OPCAO,
  GRUPOS_DA_OPCAO,
  type OpcaoDeStatus,
} from "@/lib/tarefas/opcoes-de-status";

export const dynamic = "force-dynamic";

const COLUNAS = "id, organization_id, name, color, grupo, position";

const edicaoSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    color: z.enum(CORES_DA_OPCAO).optional(),
    grupo: z.enum(GRUPOS_DA_OPCAO).optional(),
    position: z.number().finite().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada para alterar." });

interface Contexto {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;

  const authz = await requireRole("manager", { requestId, resource: "crm_task_status_options" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const parsed = edicaoSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }

  const supabase = await createClient();

  // Mudar de grupo a ÚLTIMA opção do grupo deixaria o grupo sem nome na tela.
  if (parsed.data.grupo) {
    const { data: atual } = await supabase
      .from("crm_task_status_options")
      .select("grupo")
      .eq("id", id)
      .eq("organization_id", authz.org.orgId)
      .maybeSingle();
    const grupoAtual = (atual as { grupo?: string } | null)?.grupo;
    if (grupoAtual && grupoAtual !== parsed.data.grupo) {
      const { count } = await supabase
        .from("crm_task_status_options")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", authz.org.orgId)
        .eq("grupo", grupoAtual);
      if ((count ?? 0) <= 1) {
        return fail("validation_failed", t("Cada grupo precisa de pelo menos uma opção."), 422, {
          requestId,
        });
      }
    }
  }

  const { data, error } = await supabase
    .from("crm_task_status_options")
    .update(parsed.data)
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select(COLUNAS)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return fail("not_found", t("Opção não encontrada."), 404, { requestId });
    }
    if (error.code === "23505") {
      return fail("conflict", t("Já existe uma opção com esse nome."), 409, { requestId });
    }
    return fail("internal_error", t("Erro ao salvar a opção de status."), 500, { requestId });
  }

  const opcao = data as unknown as OpcaoDeStatus;

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "crm_task_status_option.updated",
    resourceType: "crm_task_status_options",
    resourceId: opcao.id,
    requestId,
    metadata: { campos: Object.keys(parsed.data) },
  });

  return ok({ option: opcao }, { requestId });
}

export async function DELETE(_req: NextRequest, ctx: Contexto): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const { id } = await ctx.params;

  const authz = await requireRole("manager", { requestId, resource: "crm_task_status_options" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const supabase = await createClient();

  const { data: alvo } = await supabase
    .from("crm_task_status_options")
    .select("grupo")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  const grupo = (alvo as { grupo?: string } | null)?.grupo;
  if (!grupo) {
    return fail("not_found", t("Opção não encontrada."), 404, { requestId });
  }

  const { count } = await supabase
    .from("crm_task_status_options")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", authz.org.orgId)
    .eq("grupo", grupo);
  if ((count ?? 0) <= 1) {
    return fail("validation_failed", t("Cada grupo precisa de pelo menos uma opção."), 422, {
      requestId,
    });
  }

  // `.select()` no delete para saber se ALGUMA linha saiu (mesma razão de /tasks/[id]).
  const { data, error } = await supabase
    .from("crm_task_status_options")
    .delete()
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select("id");

  if (error) {
    return fail("internal_error", t("Erro ao apagar a opção de status."), 500, { requestId });
  }
  if (!data || data.length === 0) {
    return fail("not_found", t("Opção não encontrada."), 404, { requestId });
  }

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "crm_task_status_option.deleted",
    resourceType: "crm_task_status_options",
    resourceId: id,
    requestId,
  });

  return ok({ deleted: true }, { requestId });
}
