import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import { janelaDaSync } from "@/lib/marketing/campanhas-resumo";
import { lerCredencialDeLeitura } from "@/lib/plataformas-de-anuncio/credenciais-de-leitura";
import { atualizarMetricasDosCriativos } from "@/lib/marketing/criativos-servidor";
import { lerInsightsPorDia } from "@/lib/plataformas-de-anuncio/meta/insights-por-dia";

/**
 * A SINCRONIZAÇÃO com o Meta (C3): puxa o dia a dia das campanhas do Meta atreladas a uma
 * campanha de demanda e grava em `demand_campaign_days` (source = 'meta').
 *
 * Chamada pelo botão da tela e pelo relógio (a cada hora). Escreve com o cliente ADMIN — o
 * relógio não tem sessão — e por isso confere a organização em toda consulta.
 */

export type MotivoDaFalhaDeSync =
  | "sem_campanhas"
  | "sem_conta"
  | "sem_conexao"
  | "token_invalido"
  | "permissao_insuficiente"
  | "limite_de_chamadas"
  | "campo_invalido"
  | "transitorio"
  | "erro_ao_gravar";

export type ResultadoDaSync =
  { ok: true; dias: number; de: string; ate: string } | { ok: false; motivo: MotivoDaFalhaDeSync };

interface CampanhaParaSync {
  id: string;
  organization_id: string;
  start_date: string | null;
  end_date: string | null;
  meta_account_id: string;
  platform_campaigns: Array<{ id: string | null; name: string }>;
}

export async function sincronizarCampanhaComMeta(
  admin: SupabaseClient,
  c: CampanhaParaSync,
  agora: Date = new Date(),
): Promise<ResultadoDaSync> {
  const marcar = async (motivo: MotivoDaFalhaDeSync | "") => {
    await admin
      .from("demand_campaigns")
      .update({
        meta_sync_error: motivo,
        ...(motivo === "" ? { meta_synced_at: agora.toISOString() } : {}),
      })
      .eq("id", c.id)
      .eq("organization_id", c.organization_id);
  };
  const falha = async (motivo: MotivoDaFalhaDeSync): Promise<ResultadoDaSync> => {
    await marcar(motivo);
    return { ok: false, motivo };
  };

  const ids = c.platform_campaigns.flatMap((p) => (p.id ? [p.id] : []));
  if (ids.length === 0) return falha("sem_campanhas");

  const credencial = await lerCredencialDeLeitura(admin, c.organization_id, "meta_ads");
  if (!credencial.ok) return falha("sem_conexao");
  const conta = c.meta_account_id || credencial.credencial.contaPadrao;
  if (!conta) return falha("sem_conta");

  const janela = janelaDaSync(c, agora);
  if (!janela) {
    await marcar("");
    return { ok: true, dias: 0, de: c.start_date ?? "", ate: "" };
  }

  const leitura = await lerInsightsPorDia(
    credencial.credencial.accessToken,
    conta,
    ids,
    janela.de,
    janela.ate,
  );
  if (!leitura.ok) return falha(leitura.falha);

  if (leitura.dias.length > 0) {
    // Sem `extras` nem `leads` no envio: o upsert só troca as colunas enviadas e preserva o resto.
    const { error } = await admin.from("demand_campaign_days").upsert(
      leitura.dias.map((d) => ({
        organization_id: c.organization_id,
        campaign_id: c.id,
        day: d.day,
        impressions: d.impressions,
        reach: d.reach,
        link_clicks: d.link_clicks,
        lp_views: d.lp_views,
        spend: d.spend,
        source: "meta",
      })),
      { onConflict: "campaign_id,day" },
    );
    if (error) {
      logger.error("[campanhas-meta] gravação falhou", { campanha: c.id, error: error.message });
      return falha("erro_ao_gravar");
    }
  }
  // As métricas por criativo andam junto (só gasta chamada se houver criativo do Meta cadastrado).
  await atualizarMetricasDosCriativos(
    admin,
    c,
    credencial.credencial.accessToken,
    conta,
    ids,
    agora,
  );
  await marcar("");
  return { ok: true, dias: leitura.dias.length, ...janela };
}
