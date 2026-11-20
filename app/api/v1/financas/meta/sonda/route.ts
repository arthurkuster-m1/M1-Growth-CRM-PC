/**
 * GET /api/v1/financas/meta/sonda — a SONDA das cobranças da Meta (somente leitura, só admin).
 *
 * Responde, com o token JÁ SALVO da empresa em Conexões › Meta Ads, se a API deixa ler o que foi
 * cobrado no cartão (valor, data, recusa) — e mostra o retorno CRU de cada chamada. É a base da
 * decisão de como as Finanças vão puxar a fatura do cartão da Meta (docs/PLANO-FINANCAS-M1.md, §5).
 *
 * Abre-se direto no navegador, já logado como administrador:
 *   /api/v1/financas/meta/sonda            (últimos 30 dias, conta padrão da conexão)
 *   /api/v1/financas/meta/sonda?dias=60&conta=act_123
 *
 * Piso `admin`: o retorno pode trazer dado de pagamento (final do cartão). Não grava nada, não
 * chama nenhuma rota que mude a conta de anúncio e não devolve o token. Org da org ativa (cookie
 * validado), NUNCA do query/body. Read-only ⇒ sem audit.
 */
import { randomUUID } from "node:crypto";

import type { NextRequest } from "next/server";

import { respostaSemConexao } from "@/app/api/v1/ads/meta/_falha";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import {
  contaLiberada,
  lerCredencialDeLeitura,
} from "@/lib/plataformas-de-anuncio/credenciais-de-leitura";
import { sondarCobrancas } from "@/lib/plataformas-de-anuncio/meta/cobrancas";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const dia = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("admin", { requestId, resource: "ads_insights" });
  if (!authz.ok) return authz.response;
  const { org } = authz;

  const url = new URL(req.url);
  const dias = Math.min(Math.max(Number(url.searchParams.get("dias") ?? 30) || 30, 1), 90);
  const ate = new Date();
  const de = new Date(ate.getTime() - dias * 86_400_000);

  // Admin client: `ad_insights_connections` tem RLS ligada e ZERO policies; pelo client de sessão
  // isto devolveria vazio, sem erro.
  const admin = createAdminClient();
  const credencial = await lerCredencialDeLeitura(admin, org.orgId, "meta_ads");
  if (!credencial.ok) return respostaSemConexao(credencial.motivo, { requestId });

  const conta = url.searchParams.get("conta")?.trim() || credencial.credencial.contaPadrao;
  if (!conta) {
    return fail(
      "validation_failed",
      "Sem conta de anúncio: escolha a conta padrão em Conexões › Meta Ads ou passe ?conta=act_…",
      422,
      { requestId },
    );
  }
  if (!/^(act_)?\d{5,20}$/.test(conta)) {
    return fail("validation_failed", "Número de conta de anúncio inválido.", 422, { requestId });
  }
  if (!contaLiberada(credencial.credencial, conta)) {
    return fail(
      "forbidden_role",
      "Esta conta de anúncio não está liberada para a sua empresa.",
      403,
      { requestId },
    );
  }

  const resultado = await sondarCobrancas(
    credencial.credencial.accessToken,
    conta,
    dia(de),
    dia(ate),
  );
  return ok(resultado, { requestId });
}
