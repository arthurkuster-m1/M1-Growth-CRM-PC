/**
 * POST /api/v1/financas/meta/sincronizar — "Atualizar agora": lê as cobranças da Meta e lança as pagas
 * no cartão ligado. Piso `manager`. Sem corpo. A organização vem da sessão. No máximo uma leitura por
 * minuto por empresa (a cota da Meta é escassa): pedir de novo antes disso devolve `recente: true`.
 */
import { respostaDeFalha, respostaSemConexao } from "@/app/api/v1/ads/meta/_falha";
import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { autorizarFinancas } from "@/lib/financas/servidor";
import { lerCobrancasDaMeta } from "@/lib/financas/meta-servidor";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(): Promise<Response> {
  // a guarda do modo somente leitura do suporte vem ANTES de qualquer efeito
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarFinancas(true);
  if (!a.ok) return a.response;
  const { orgId, requestId } = a.ctx;

  const admin = createAdminClient();
  const { data: estado } = await admin
    .from("fin_meta_estado")
    .select("ultima_leitura_em")
    .eq("organization_id", orgId)
    .maybeSingle();
  const ultima = estado?.ultima_leitura_em ? new Date(estado.ultima_leitura_em).getTime() : 0;
  if (Date.now() - ultima < 60_000) return ok({ recente: true }, { requestId });

  const r = await lerCobrancasDaMeta(admin, orgId);
  if (!r.ok) {
    switch (r.motivo) {
      case "sem_cartao":
        return fail(
          "validation_failed",
          "Escolha qual cartão a Meta cobra em Configurações › Cartões.",
          422,
          { requestId },
        );
      case "sem_conexao":
      case "cifra_indisponivel":
        return respostaSemConexao(r.motivo, { requestId });
      case "sem_conta":
        return fail(
          "validation_failed",
          "Escolha a conta de anúncios padrão em Conexões › Meta Ads.",
          422,
          { requestId },
        );
      case "conta_nao_liberada":
        return fail(
          "forbidden_role",
          "Esta conta de anúncios não está liberada para a sua empresa.",
          403,
          { requestId },
        );
      case "erro_ao_gravar":
        return fail("internal_error", "Não consegui guardar as cobranças. Tente de novo.", 500, {
          requestId,
        });
      default:
        return respostaDeFalha(r.motivo, r.motivo, { requestId });
    }
  }
  await audit({
    action: "financas.meta_sincronizada",
    resourceType: "fin_cobrancas_meta",
    resourceId: null,
    requestId,
    metadata: { lidas: r.lidas, novas: r.novas, alteradas: r.alteradas, avisos: r.avisos },
  });
  return ok(r, { requestId });
}
