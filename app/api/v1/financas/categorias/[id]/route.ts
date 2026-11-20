/**
 * PATCH /api/v1/financas/categorias/[id]   muda a categoria (nome, grupo, cor, ordem, meta, arquivar)
 * DELETE /api/v1/financas/categorias/[id]  só categoria nunca usada (o banco recusa se houver lançamento)
 * Categoria do sistema (Vendas, Rendimentos, Ajuste de saldo) não se renomeia nem se apaga.
 */
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import {
  COLUNAS_DA_CATEGORIA,
  autorizarFinancas,
  lerCorpo,
  respostaDeErroDoBanco,
} from "@/lib/financas/servidor";
import { mudancaDeCategoriaSchema } from "@/lib/financas/validacao";

export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Contexto): Promise<Response> {
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", "Categoria inválida.", 422, { requestId });
  const corpo = await lerCorpo(req, mudancaDeCategoriaSchema, requestId);
  if (!corpo.ok) return corpo.response;
  if (Object.keys(corpo.dados).length === 0)
    return fail("validation_failed", "Nada para mudar.", 422, { requestId });

  const { data: atual } = await supabase
    .from("fin_categories")
    .select("id,sistema")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!atual) return fail("not_found", "Categoria não encontrada.", 404, { requestId });
  if (atual.sistema && (corpo.dados.nome !== undefined || corpo.dados.tipo !== undefined)) {
    return fail("validation_failed", "Categoria do sistema não pode ser renomeada.", 422, {
      requestId,
    });
  }
  if (corpo.dados.group_id) {
    const { data: g } = await supabase
      .from("fin_category_groups")
      .select("id")
      .eq("id", corpo.dados.group_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!g) return fail("validation_failed", "Grupo inválido.", 422, { requestId });
  }
  const { data, error } = await supabase
    .from("fin_categories")
    .update(corpo.dados)
    .eq("id", id)
    .eq("organization_id", orgId)
    .select(COLUNAS_DA_CATEGORIA)
    .maybeSingle();
  if (error) return respostaDeErroDoBanco(error, requestId, "categorias.mudar");
  if (!data) return fail("not_found", "Categoria não encontrada.", 404, { requestId });
  await audit({
    action: "financas.categoria_alterada",
    resourceType: "fin_category",
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
    return fail("validation_failed", "Categoria inválida.", 422, { requestId });
  const { data: atual } = await supabase
    .from("fin_categories")
    .select("id,sistema")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!atual) return fail("not_found", "Categoria não encontrada.", 404, { requestId });
  if (atual.sistema)
    return fail("validation_failed", "Categoria do sistema não pode ser apagada.", 422, {
      requestId,
    });
  const { error } = await supabase
    .from("fin_categories")
    .delete()
    .eq("id", id)
    .eq("organization_id", orgId);
  if (error) return respostaDeErroDoBanco(error, requestId, "categorias.apagar");
  await audit({
    action: "financas.categoria_removida",
    resourceType: "fin_category",
    resourceId: id,
    requestId,
  });
  return ok({ deleted: true }, { requestId });
}
