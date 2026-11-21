/**
 * Coleta os dados do Dossiê (server-only). Client de SESSÃO (a RLS vale) e org da org ativa — nunca
 * do corpo. Só agregados e estratégia: nenhuma leitura de lead individual. Cada parte é uma leitura
 * independente que, se falhar, vira "não consegui ler" no dossiê em vez de derrubar o documento.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { textoDaPagina } from "@/lib/marketing/texto-estruturado";
import type { Bloco } from "@/lib/marketing/blocos";

import { dados, ler } from "./coletar-sinais";
import type {
  AprendizadoParaDossie,
  CampanhaParaDossie,
  CriativoParaDossie,
  PaginaParaDossie,
} from "./dossie";
import { faltaMigrationDoGuia } from "./guardado";
import type { Leitura } from "./tipos";

const soma = (xs: (number | null | undefined)[]) =>
  xs.reduce<number>((a, b) => a + Number(b ?? 0), 0);

export async function nomeDaEmpresa(supabase: SupabaseClient, orgId: string): Promise<string> {
  const r = await supabase
    .from("organizations")
    .select("display_name")
    .eq("id", orgId)
    .maybeSingle();
  return (r.data?.display_name as string | undefined)?.trim() || "Empresa";
}

export function lerPaginasDoDossie(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Leitura<PaginaParaDossie[]>> {
  return ler(async () => {
    const linhas = dados<
      { module_key: string; title: string; published_blocks: unknown; published_at: string }[]
    >(
      await supabase
        .from("marketing_pages")
        .select("module_key,title,published_blocks,published_at")
        .eq("organization_id", orgId)
        .not("published_blocks", "is", null)
        .order("module_key")
        .limit(80),
    );
    return linhas.map((l) => {
      let texto = "";
      try {
        texto = textoDaPagina(l.published_blocks as Bloco[]).texto;
      } catch {
        texto = "(não foi possível converter esta página em texto)";
      }
      return { chave: l.module_key, titulo: l.title, texto, publicadaEm: l.published_at };
    });
  });
}

export function lerCampanhasDoDossie(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Leitura<CampanhaParaDossie[]>> {
  return ler(async () => {
    const cs = dados<
      {
        id: string;
        name: string;
        channel: string;
        status: string;
        start_date: string | null;
        end_date: string | null;
        goal_leads: number | null;
        goal_cpl: number | null;
        goal_sales: number | null;
        goal_revenue: number | null;
      }[]
    >(
      await supabase
        .from("demand_campaigns")
        .select(
          "id,name,channel,status,start_date,end_date,goal_leads,goal_cpl,goal_sales,goal_revenue",
        )
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(40),
    );
    if (cs.length === 0) return [];
    const ids = cs.map((c) => c.id);
    const dias = dados<
      {
        campaign_id: string;
        leads: number;
        spend: number;
        impressions: number;
        link_clicks: number;
      }[]
    >(
      await supabase
        .from("demand_campaign_days")
        .select("campaign_id,leads,spend,impressions,link_clicks")
        .eq("organization_id", orgId)
        .in("campaign_id", ids)
        .limit(20000),
    );
    const vendas = dados<{ demand_campaign_id: string; amount_cents: number }[]>(
      await supabase
        .from("crm_sales")
        .select("demand_campaign_id,amount_cents")
        .eq("organization_id", orgId)
        .in("demand_campaign_id", ids)
        .in("status", ["comprometida", "concluida"])
        .limit(20000),
    );
    return cs.map((c) => {
      const d = dias.filter((x) => x.campaign_id === c.id);
      const v = vendas.filter((x) => x.demand_campaign_id === c.id);
      return {
        nome: c.name,
        canal: c.channel,
        status: c.status,
        inicio: c.start_date,
        fim: c.end_date,
        metaLeads: c.goal_leads,
        metaCpl: c.goal_cpl === null ? null : Number(c.goal_cpl),
        metaVendas: c.goal_sales,
        metaReceita: c.goal_revenue === null ? null : Number(c.goal_revenue),
        gasto: soma(d.map((x) => x.spend)),
        leads: soma(d.map((x) => x.leads)),
        impressoes: soma(d.map((x) => x.impressions)),
        cliques: soma(d.map((x) => x.link_clicks)),
        vendas: v.length,
        receita: soma(v.map((x) => x.amount_cents)) / 100,
      };
    });
  });
}

export function lerCriativosDoDossie(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Leitura<CriativoParaDossie[]>> {
  return ler(async () => {
    const linhas = dados<
      {
        name: string;
        format: string;
        status: string;
        spend: number;
        impressions: number;
        link_clicks: number;
        campanha: { name: string } | { name: string }[] | null;
      }[]
    >(
      await supabase
        .from("demand_campaign_creatives")
        .select("name,format,status,spend,impressions,link_clicks,campanha:demand_campaigns(name)")
        .eq("organization_id", orgId)
        .order("spend", { ascending: false })
        .limit(60),
    );
    return linhas.map((l) => ({
      campanha: (Array.isArray(l.campanha) ? l.campanha[0]?.name : l.campanha?.name) ?? "—",
      nome: l.name,
      formato: l.format,
      status: l.status,
      gasto: Number(l.spend),
      impressoes: l.impressions,
      cliques: l.link_clicks,
    }));
  });
}

/** Os aprendizados registrados. Banco sem a 0704 = ninguém registrou nada ainda (lista vazia). */
export function lerAprendizadosDoDossie(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Leitura<AprendizadoParaDossie[]>> {
  return ler(async () => {
    const r = await supabase
      .from("guia_aprendizados")
      .select("titulo,hipotese,resultado,veredito,created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (r.error) {
      if (faltaMigrationDoGuia(r.error)) return [];
      throw r.error;
    }
    return (
      (r.data ?? []) as {
        titulo: string;
        hipotese: string | null;
        resultado: string | null;
        veredito: AprendizadoParaDossie["veredito"];
        created_at: string;
      }[]
    ).map((a) => ({
      titulo: a.titulo,
      hipotese: a.hipotese,
      resultado: a.resultado,
      veredito: a.veredito,
      em: a.created_at.slice(0, 10),
    }));
  });
}
