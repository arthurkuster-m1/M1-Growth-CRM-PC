import type { SupabaseClient } from "@supabase/supabase-js";

import { campanhaDaOportunidade, type CampanhaDoFunil } from "@/lib/marketing/atribuicao";

/** O que o CRM sabe de uma campanha, dia a dia (o dia é o da data/hora no fuso da empresa). */
export interface DiaDoCrm {
  vendas: number;
  /** Valor total das vendas fechadas naquele dia (a 1ª parcela recebida marca o dia). */
  faturamento: number;
  recebido: number;
  aReceber: number;
  agendamentos: number;
  reunioes: number;
}

const vazio = (): DiaDoCrm => ({
  vendas: 0,
  faturamento: 0,
  recebido: 0,
  aReceber: 0,
  agendamentos: 0,
  reunioes: 0,
});

/** `AAAA-MM-DD` de um instante, no fuso da empresa. */
export function diaNoFusoDaEmpresa(iso: string, fuso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date(iso));
}

/**
 * Vendas, dinheiro e reuniões das oportunidades que pertencem à campanha (mesma regra de
 * atribuição do resto do produto: o funil dono da oportunidade, ou a origem dela).
 */
export async function crmDaCampanhaPorDia(
  supabase: SupabaseClient,
  orgId: string,
  campaignId: string,
  pipelineId: string | null,
  campanhasDoFunil: readonly CampanhaDoFunil[],
  fuso: string,
): Promise<Map<string, DiaDoCrm>> {
  const porDia = new Map<string, DiaDoCrm>();
  const dia = (d: string) => {
    let v = porDia.get(d);
    if (!v) {
      v = vazio();
      porDia.set(d, v);
    }
    return v;
  };

  const { data: oportunidades } = await supabase
    .from("crm_leads")
    .select("id, pipeline_id, demand_campaign_id, status")
    .eq("organization_id", orgId)
    .or(
      pipelineId
        ? `pipeline_id.eq.${pipelineId},demand_campaign_id.eq.${campaignId}`
        : `demand_campaign_id.eq.${campaignId}`,
    )
    .limit(5000);
  const doGrupo = (
    (oportunidades ?? []) as Array<{
      id: string;
      pipeline_id: string | null;
      demand_campaign_id: string | null;
      status: string;
    }>
  ).filter((o) => campanhaDaOportunidade(o, [...campanhasDoFunil]) === campaignId);
  const statusDoLead = new Map(doGrupo.map((o) => [o.id, o.status]));
  const ids = doGrupo.map((o) => o.id);

  // Dinheiro: recebido no dia em que caiu; a receber no vencimento; a venda no dia da 1ª parcela.
  const primeira = new Map<string, string>();
  const totalDaVenda = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("crm_sale_payments")
      .select("lead_id, status, paid_on, due_on, amount_cents")
      .eq("organization_id", orgId)
      .in("lead_id", ids.slice(i, i + 200))
      .neq("status", "cancelada")
      .limit(20000);
    for (const p of (data ?? []) as Array<{
      lead_id: string;
      status: string;
      paid_on: string | null;
      due_on: string | null;
      amount_cents: number | string;
    }>) {
      const valor = Number(p.amount_cents) / 100;
      totalDaVenda.set(p.lead_id, (totalDaVenda.get(p.lead_id) ?? 0) + valor);
      if (p.status === "recebida" && p.paid_on) {
        const d = p.paid_on.slice(0, 10);
        dia(d).recebido += valor;
        const atual = primeira.get(p.lead_id);
        if (!atual || d < atual) primeira.set(p.lead_id, d);
      } else if (p.status === "prevista" && p.due_on && statusDoLead.get(p.lead_id) !== "lost") {
        dia(p.due_on.slice(0, 10)).aReceber += valor;
      }
    }
  }
  for (const [lead, d] of primeira) {
    dia(d).vendas += 1;
    dia(d).faturamento += totalDaVenda.get(lead) ?? 0;
  }

  // Agendamentos e reuniões feitas: os compromissos e as ações registradas nas oportunidades.
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from("crm_lead_activities")
      .select("type, payload, performed_at")
      .eq("organization_id", orgId)
      .in("lead_id", ids.slice(i, i + 200))
      .in("type", ["note", "appointment_scheduled", "appointment_completed"])
      .limit(10000);
    for (const at of (data ?? []) as Array<{
      type: string;
      payload: { acao?: string } | null;
      performed_at: string;
    }>) {
      const d = dia(diaNoFusoDaEmpresa(at.performed_at, fuso));
      if (at.type === "appointment_scheduled") d.agendamentos += 1;
      else if (at.type === "appointment_completed") d.reunioes += 1;
      else if (at.payload?.acao === "reuniao") d.reunioes += 1;
    }
  }
  return porDia;
}

/** As chaves do `extras` do dia onde o dia a dia leva estes números. */
export function extrasDoCrm(d: DiaDoCrm): Record<string, number> {
  return {
    crm_vendas: d.vendas,
    crm_faturamento: Math.round(d.faturamento * 100) / 100,
    crm_recebido: Math.round(d.recebido * 100) / 100,
    crm_a_receber: Math.round(d.aReceber * 100) / 100,
    crm_agendamentos: d.agendamentos,
    crm_reunioes: d.reunioes,
  };
}

/**
 * O FUNIL DA COORTE: dos leads que ENTRARAM na campanha dentro da janela, quantos agendaram, fizeram
 * a reunião e compraram (em qualquer data). Contar por pessoa e só dentro da coorte garante que o
 * funil não desça de uma etapa para a anterior (nada de agendamento sem lead, nem venda sem
 * agendamento): quem chegou a uma etapa conta também nas anteriores.
 */
export interface FunilDaCoorte {
  leads: number;
  agendados: number;
  feitas: number;
  vendas: number;
  /** O dinheiro já recebido dessas pessoas. */
  faturamento: number;
}

export function montarCoorte(
  pessoas: ReadonlyMap<
    string,
    { agendou: boolean; fez: boolean; comprou: boolean; recebido: number }
  >,
): FunilDaCoorte {
  let agendados = 0;
  let feitas = 0;
  let vendas = 0;
  let faturamento = 0;
  for (const p of pessoas.values()) {
    const comprou = p.comprou;
    const fez = p.fez || comprou;
    const agendou = p.agendou || fez;
    if (agendou) agendados += 1;
    if (fez) feitas += 1;
    if (comprou) vendas += 1;
    faturamento += p.recebido;
  }
  return {
    leads: pessoas.size,
    agendados,
    feitas,
    vendas,
    faturamento: Math.round(faturamento * 100) / 100,
  };
}

export async function coorteDaCampanha(
  supabase: SupabaseClient,
  orgId: string,
  campaignId: string,
  pipelineId: string | null,
  campanhasDoFunil: readonly CampanhaDoFunil[],
  fuso: string,
  janela: { de: string; ate: string },
): Promise<FunilDaCoorte> {
  const { data: oportunidades } = await supabase
    .from("crm_leads")
    .select("id, contact_id, pipeline_id, demand_campaign_id, created_at")
    .eq("organization_id", orgId)
    .or(
      pipelineId
        ? `pipeline_id.eq.${pipelineId},demand_campaign_id.eq.${campaignId}`
        : `demand_campaign_id.eq.${campaignId}`,
    )
    .limit(5000);
  const doGrupo = (
    (oportunidades ?? []) as Array<{
      id: string;
      contact_id: string | null;
      pipeline_id: string | null;
      demand_campaign_id: string | null;
      created_at: string;
    }>
  ).filter((o) => {
    if (campanhaDaOportunidade(o, [...campanhasDoFunil]) !== campaignId) return false;
    const d = diaNoFusoDaEmpresa(o.created_at, fuso);
    return d >= janela.de && d <= janela.ate;
  });
  // A pessoa é o contato (o mesmo contato com duas oportunidades é um lead só).
  const pessoaDe = new Map(doGrupo.map((o) => [o.id, o.contact_id ?? o.id]));
  const pessoas = new Map<
    string,
    { agendou: boolean; fez: boolean; comprou: boolean; recebido: number }
  >();
  for (const pessoa of pessoaDe.values()) {
    pessoas.set(pessoa, { agendou: false, fez: false, comprou: false, recebido: 0 });
  }
  const ids = doGrupo.map((o) => o.id);
  for (let i = 0; i < ids.length; i += 200) {
    const lote = ids.slice(i, i + 200);
    const { data: atividades } = await supabase
      .from("crm_lead_activities")
      .select("lead_id, type, payload")
      .eq("organization_id", orgId)
      .in("lead_id", lote)
      .in("type", ["note", "appointment_scheduled", "appointment_completed"])
      .limit(10000);
    for (const at of (atividades ?? []) as Array<{
      lead_id: string;
      type: string;
      payload: { acao?: string } | null;
    }>) {
      const p = pessoas.get(pessoaDe.get(at.lead_id) ?? "");
      if (!p) continue;
      if (at.type === "appointment_scheduled") p.agendou = true;
      else if (at.type === "appointment_completed" || at.payload?.acao === "reuniao") p.fez = true;
    }
    const { data: pagamentos } = await supabase
      .from("crm_sale_payments")
      .select("lead_id, amount_cents")
      .eq("organization_id", orgId)
      .eq("status", "recebida")
      .in("lead_id", lote)
      .limit(20000);
    for (const pg of (pagamentos ?? []) as Array<{
      lead_id: string;
      amount_cents: number | string;
    }>) {
      const p = pessoas.get(pessoaDe.get(pg.lead_id) ?? "");
      if (!p) continue;
      p.comprou = true;
      p.recebido += Number(pg.amount_cents) / 100;
    }
  }
  return montarCoorte(pessoas);
}
