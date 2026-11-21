/**
 * GET /api/v1/financas/meta/estado — a situação das cobranças da Meta para as Finanças.
 * Devolve: o cartão ligado, se há conta de anúncios conectada, a última leitura (e o erro, se houve),
 * a situação da conta, o ALERTA (cobrança recusada / pagamento pendente) e as cobranças recentes.
 * Só leitura; piso `manager`. Nunca devolve o token nem o JSON cru da plataforma.
 */
import { ok } from "@/lib/api/wrappers";
import { autorizarFinancas, faltaMigration, respostaDeErroDoBanco } from "@/lib/financas/servidor";
import { calcularAlertaMeta, type CobrancaDoAlerta } from "@/lib/financas/meta-alerta";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DIA = 86_400_000;

export async function GET(): Promise<Response> {
  const a = await autorizarFinancas(false);
  if (!a.ok) return a.response;
  const { supabase, orgId, requestId } = a.ctx;

  const cfg = await supabase
    .from("fin_orcamento_config")
    .select("conta_meta_id")
    .eq("organization_id", orgId)
    .maybeSingle();
  // Sem a migration das cobranças (0704) a tela some com a parte da Meta, sem quebrar o resto.
  if (faltaMigration(cfg.error) || (cfg.error && /conta_meta_id/.test(cfg.error.message ?? "")))
    return ok({ disponivel: false }, { requestId });
  if (cfg.error) return respostaDeErroDoBanco(cfg.error, requestId, "meta.estado.config");

  const desde = new Date(Date.now() - 60 * DIA).toISOString();
  const [estado, cobrancas] = await Promise.all([
    supabase
      .from("fin_meta_estado")
      .select("ultima_leitura_em,ultimo_erro,conta_status,conta_status_em")
      .eq("organization_id", orgId)
      .maybeSingle(),
    supabase
      .from("fin_cobrancas_meta")
      .select("id,cobrada_em,valor_cents,moeda,estado")
      .eq("organization_id", orgId)
      .gte("cobrada_em", desde)
      .order("cobrada_em", { ascending: false })
      .limit(100),
  ]);
  if (estado.error) return respostaDeErroDoBanco(estado.error, requestId, "meta.estado.estado");
  if (cobrancas.error)
    return respostaDeErroDoBanco(cobrancas.error, requestId, "meta.estado.cobrancas");

  // `ad_insights_connections` não tem policy (só o servidor lê): aqui só se pergunta SE existe.
  const { count } = await createAdminClient()
    .from("ad_insights_connections")
    .select("organization_id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("platform", "meta_ads");

  const lista = (cobrancas.data ?? []) as Array<CobrancaDoAlerta & { id: string; moeda: string }>;
  return ok(
    {
      disponivel: true,
      cartao_id: (cfg.data?.conta_meta_id as string | null) ?? null,
      conectado: (count ?? 0) > 0,
      ultima_leitura_em: estado.data?.ultima_leitura_em ?? null,
      ultimo_erro: estado.data?.ultimo_erro ?? null,
      conta_status: estado.data?.conta_status ?? null,
      alerta: calcularAlertaMeta(
        lista,
        { status: estado.data?.conta_status ?? null, lidoEm: estado.data?.conta_status_em ?? null },
        new Date(),
      ),
      cobrancas: lista,
    },
    { requestId },
  );
}
