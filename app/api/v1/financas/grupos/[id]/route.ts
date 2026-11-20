/**
 * PATCH /api/v1/financas/grupos/[id]   renomeia ou muda a ordem
 * DELETE /api/v1/financas/grupos/[id]  apaga (as categorias ficam sem grupo; o banco faz isso)
 * O grupo "Sistema" é do sistema: não se mexe.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import {
  COLUNAS_DO_GRUPO,
  autorizarFinancas,
  lerCorpo,
  respostaDeErroDoBanco,
} from "@/lib/financas/servidor";
import { mudancaDeGrupoSchema } from "@/lib/financas/validacao";

export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Contexto): Promise<Response> {
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", "Grupo inválido.", 422, { requestId });
  const corpo = await lerCorpo(req, mudancaDeGrupoSchema, requestId);
  if (!corpo.ok) return corpo.response;
  if (Object.keys(corpo.dados).length === 0)
    return fail("validation_failed", "Nada para mudar.", 422, { requestId });
  const { data: atual } = await supabase
    .from("fin_category_groups")
    .select("id,sistema")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!atual) return fail("not_found", "Grupo não encontrado.", 404, { requestId });
  if (atual.sistema)
    return fail("validation_failed", "O grupo do sistema não pode ser alterado.", 422, {
      requestId,
    });
  const { data, error } = await supabase
    .from("fin_category_groups")
    .update(corpo.dados)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select(COLUNAS_DO_GRUPO)
    .maybeSingle();
  if (error) return respostaDeErroDoBanco(error, requestId, "grupos.mudar");
  if (!data) return fail("not_found", "Grupo não encontrado.", 404, { requestId });
  await audit({
    action: "financas.grupo_alterado",
    resourceType: "fin_category_group",
    resourceId: id,
    requestId,
    metadata: { campos: Object.keys(corpo.dados) },
  });
  return ok(data, { requestId });
}

export async function DELETE(_req: NextRequest, { params }: Contexto): Promise<Response> {
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", "Grupo inválido.", 422, { requestId });
  const { data: atual } = await supabase
    .from("fin_category_groups")
    .select("id,sistema")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!atual) return fail("not_found", "Grupo não encontrado.", 404, { requestId });
  if (atual.sistema)
    return fail("validation_failed", "O grupo do sistema não pode ser apagado.", 422, {
      requestId,
    });
  const { error } = await supabase
    .from("fin_category_groups")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return respostaDeErroDoBanco(error, requestId, "grupos.apagar");
  await audit({
    action: "financas.grupo_removido",
    resourceType: "fin_category_group",
    resourceId: id,
    requestId,
  });
  return ok({ deleted: true }, { requestId });
}
