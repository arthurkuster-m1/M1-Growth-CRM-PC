import "server-only";

import type { ClienteDaAgencia } from "@/lib/agencia/acesso";
import { cplDaCampanha, origemDosLeads, prazoDaCampanha, verbaDaCampanha, type OrigemDosLeads, type PrazoDaCampanha, type VerbaDaCampanha } from "@/lib/agencia/campanhas";
import { COLUNAS_DA_CAMPANHA, campanhaDaLinha } from "@/lib/marketing/campanhas";
import { createAdminClient } from "@/lib/supabase/admin";

export interface LinhaDeCampanha {
  id: string;
  nome: string;
  status: string;
  canal: string;
  prazo: PrazoDaCampanha;
  fim: string | null;
  leads: number;
  investido: number;
  cpl: number | null;
  meta_cpl: number | null;
  verba: VerbaDaCampanha;
}

export interface GrupoDeCliente {
  cliente: ClienteDaAgencia;
  origem: OrigemDosLeads;
  campanhas: LinhaDeCampanha[];
}

const hojeNoFuso = (tz: string): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

/**
 * As campanhas dos clientes escolhidos, agrupadas por cliente. Lê com o cliente ADMIN, e por isso
 * só recebe organizações que `clientesDaAgencia` já liberou para esta pessoa — filtra
 * `organization_id` em toda consulta.
 */
export async function campanhasDaAgencia(
  clientes: readonly ClienteDaAgencia[],
  incluirEncerradas: boolean,
): Promise<GrupoDeCliente[]> {
  if (clientes.length === 0) return [];
  const db = createAdminClient();
  const ids = clientes.map((c) => c.id);
  const [{ data: orgs }, { data: camps }] = await Promise.all([
    db.from("organizations").select("id, timezone, settings").in("id", ids),
    (() => {
      const q = db
        .from("demand_campaigns")
        .select(COLUNAS_DA_CAMPANHA + ", organization_id")
        .in("organization_id", ids)
        .order("position", { ascending: true });
      return incluirEncerradas ? q : q.neq("status", "encerrada");
    })(),
  ]);
  const orgPorId = new Map(
    ((orgs ?? []) as Array<{ id: string; timezone: string | null; settings: unknown }>).map((o) => [o.id, o]),
  );
  const campanhas = ((camps ?? []) as unknown as Array<Record<string, unknown>>).map((l) => ({
    organization_id: l.organization_id as string,
    c: campanhaDaLinha(l),
  }));

  // Investido e leads do CRM no período de cada campanha (a mesma conta da lista do cliente).
  const estados = new Map<string, { de: string; ate: string; spend: number; leads: number }>();
  await Promise.all(
    ids.map(async (id) => {
      if (!campanhas.some((x) => x.organization_id === id)) return;
      const { data } = await db.rpc("fn_demand_campaigns_estado", {
        p_org: id,
        p_tz: orgPorId.get(id)?.timezone || "America/Sao_Paulo",
      });
      for (const e of (data ?? []) as Array<{ campaign_id: string; de: string; ate: string; spend: number | string; leads: number }>) {
        estados.set(e.campaign_id, { de: e.de, ate: e.ate, spend: Number(e.spend) || 0, leads: Number(e.leads) || 0 });
      }
    }),
  );

  // Clientes sem CRM: os leads são as conversas iniciadas que o Meta informa, dia a dia.
  const idsDeMeta = campanhas
    .filter((x) => origemDosLeads(orgPorId.get(x.organization_id)?.settings) === "meta")
    .map((x) => x.c.id);
  const leadsDoMeta = new Map<string, number>();
  if (idsDeMeta.length > 0) {
    const { data: dias } = await db
      .from("demand_campaign_days")
      .select("campaign_id, day, leads")
      .in("campaign_id", idsDeMeta)
      .in("organization_id", ids)
      .limit(50000);
    for (const d of (dias ?? []) as Array<{ campaign_id: string; day: string; leads: number }>) {
      const e = estados.get(d.campaign_id);
      if (e && (d.day < e.de || d.day > e.ate)) continue;
      leadsDoMeta.set(d.campaign_id, (leadsDoMeta.get(d.campaign_id) ?? 0) + (Number(d.leads) || 0));
    }
  }

  return clientes.map((cliente) => {
    const org = orgPorId.get(cliente.id);
    const origem = origemDosLeads(org?.settings);
    const hoje = hojeNoFuso(org?.timezone || "America/Sao_Paulo");
    const linhas = campanhas
      .filter((x) => x.organization_id === cliente.id)
      .map(({ c }): LinhaDeCampanha => {
        const e = estados.get(c.id);
        const investido = e?.spend ?? 0;
        const leads = origem === "meta" ? (leadsDoMeta.get(c.id) ?? 0) : (e?.leads ?? 0);
        return {
          id: c.id,
          nome: c.name,
          status: c.status,
          canal: c.channel,
          prazo: prazoDaCampanha(c, hoje),
          fim: c.end_date,
          leads,
          investido,
          cpl: cplDaCampanha(investido, leads),
          meta_cpl: c.goal_cpl,
          verba: verbaDaCampanha(c),
        };
      });
    return { cliente, origem, campanhas: linhas };
  });
}
