/**
 * POST /api/v1/financas/lancamentos/importar — grava um lote de lançamentos vindos de planilha/CSV.
 *
 * Cada linha traz a impressão digital (`import_hash`, SHA-256 da linha): o índice único do banco
 * (empresa + hash) impede duplicar, então reimportar o mesmo arquivo não cria nada de novo. Se o lote
 * bater numa repetida (23505), regrava linha a linha pulando só as repetidas. `origem` nasce
 * `importacao`, nunca do corpo. Piso `manager`; empresa e usuário da SESSÃO.
 */
import type { NextRequest } from "next/server";

import { ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { autorizarFinancas, lerCorpo, respostaDeErroDoBanco } from "@/lib/financas/servidor";
import { importarLancamentosSchema } from "@/lib/financas/validacao";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  // a guarda do modo somente leitura do suporte vem ANTES de qualquer efeito
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, userId, requestId } = a.ctx;
  const corpo = await lerCorpo(req, importarLancamentosSchema, requestId);
  if (!corpo.ok) return corpo.response;

  const linhas = corpo.dados.lancamentos.map((l) => ({
    ...l,
    organization_id: orgId,
    origem: "importacao" as const,
    created_by: userId,
  }));

  let inseridas = 0;
  let repetidas = 0;
  const lote = await supabase.from("fin_transactions").insert(linhas);
  if (!lote.error) {
    inseridas = linhas.length;
  } else if (lote.error.code !== "23505") {
    return respostaDeErroDoBanco(lote.error, requestId, "importar.lote");
  } else {
    for (const l of linhas) {
      const u = await supabase.from("fin_transactions").insert(l);
      if (!u.error) inseridas += 1;
      else if (u.error.code === "23505") repetidas += 1;
      else return respostaDeErroDoBanco(u.error, requestId, "importar.linha");
    }
  }

  if (inseridas > 0) {
    await audit({
      action: "financas.lancamentos_importados",
      resourceType: "fin_transaction",
      resourceId: orgId,
      requestId,
      metadata: { inseridas, repetidas },
    });
  }
  return ok({ inseridas, repetidas }, { requestId, status: 201 });
}
