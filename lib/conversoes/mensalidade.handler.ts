/**
 * Cada MENSALIDADE recebida de uma assinatura vai à plataforma de anúncio como uma compra, com o
 * valor dela. A primeira parcela já saiu como a compra da venda (`envio.handler.ts`, que numa
 * assinatura usa o valor da 1ª mensalidade); aqui saem as seguintes.
 *
 * Idempotência: o livro-razão guarda uma linha por (lead, `Mensalidade:<parcela>`) e o id de
 * deduplicação da plataforma é `<lead>:Purchase:<parcela>`.
 */
import type { EventHandler, EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import { lerCredencial } from "@/lib/plataformas-de-anuncio/credenciais";
import { transporteDe } from "@/lib/plataformas-de-anuncio/registry";
import type { ConversaoOffline } from "@/lib/plataformas-de-anuncio/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerAtribuicao } from "./leitura-da-atribuicao";
import { lerRegistro, registraEnvio } from "./registro-de-envio";

const CONSUMER_KEY = "conversoes.mensalidade";
const ESPERA_MS = 5 * 60 * 1000;

const ok = (status: HandlerResult["status"], detail?: string): HandlerResult => ({
  consumer_key: CONSUMER_KEY,
  status,
  detail,
});

export async function processarMensalidade(row: EventRow): Promise<HandlerResult> {
  const paymentId = typeof row.payload.payment_id === "string" ? row.payload.payment_id : null;
  if (!row.entity_id || !paymentId) return ok("skipped", "sem_parcela");
  const admin = createAdminClient();

  const { data: lead } = await admin
    .from("crm_leads")
    .select("id, status, currency, contact_id, is_recurring")
    .eq("id", row.entity_id)
    .eq("organization_id", row.organization_id)
    .maybeSingle();
  if (!lead) return ok("skipped", "lead_inexistente");
  const l = lead as {
    id: string;
    status: string;
    currency: string | null;
    contact_id: string | null;
    is_recurring: boolean | null;
  };
  if (l.is_recurring !== true) return ok("skipped", "nao_e_assinatura");

  const { data: parcela } = await admin
    .from("crm_sale_payments")
    .select("id, amount_cents, paid_on, number, status")
    .eq("id", paymentId)
    .eq("organization_id", row.organization_id)
    .maybeSingle();
  const p = parcela as {
    id: string;
    amount_cents: number | string;
    paid_on: string | null;
    number: number;
    status: string;
  } | null;
  if (!p || p.status !== "recebida") return ok("skipped", "parcela_nao_recebida");
  const valor = Number(p.amount_cents);
  if (!Number.isFinite(valor) || valor <= 0) return ok("skipped", "sem_valor");

  // A primeira mensalidade recebida é a compra da venda: não se repete aqui.
  const { data: anteriores } = await admin
    .from("crm_sale_payments")
    .select("id, paid_on, number")
    .eq("organization_id", row.organization_id)
    .eq("lead_id", l.id)
    .eq("status", "recebida")
    .neq("id", p.id);
  const veioDepois = ((anteriores ?? []) as Array<{ paid_on: string | null; number: number }>).some(
    (a) =>
      (a.paid_on ?? "") < (p.paid_on ?? "") ||
      ((a.paid_on ?? "") === (p.paid_on ?? "") && a.number < p.number),
  );
  if (!veioDepois) return ok("skipped", "primeira_mensalidade");

  const evento = `Mensalidade:${p.id}` as const;
  const registro = await lerRegistro(admin, row.organization_id, l.id, evento);
  if (registro?.status === "sent") return ok("skipped", "ja_enviada");

  const leitura = await lerAtribuicao(admin, row.organization_id, l.contact_id);
  if (!leitura.temAtribuicao) return ok("skipped", leitura.motivo);
  const { plataforma, cliqueDeOrigem, telefone } = leitura.atribuicao;
  const identificadoresGoogle =
    "identificadoresGoogle" in leitura.atribuicao
      ? leitura.atribuicao.identificadoresGoogle
      : undefined;

  const transporte = transporteDe(plataforma);
  if (!transporte) return ok("skipped", "plataforma_sem_transporte");
  const credencial = await lerCredencial(admin, row.organization_id, plataforma, {
    exigirAcaoDeVenda: true,
  });
  if (!credencial.ok) {
    if (credencial.motivo === "leitura_indisponivel") throw new Error("Leitura da conexão indisponível.");
    return ok("skipped", credencial.motivo);
  }

  const conversao: ConversaoOffline = {
    organizationId: row.organization_id,
    leadId: l.id,
    evento: "Purchase",
    eventoId: `${l.id}:Purchase:${p.id}`,
    ocorridoEm: new Date(p.paid_on ? `${p.paid_on.slice(0, 10)}T12:00:00Z` : Date.now()),
    cliqueDeOrigem,
    identificadoresGoogle,
    telefone,
    moeda: l.currency ?? "BRL",
    valorCentavos: valor,
    eventoNaPlataforma: null,
  };
  const registra = (status: "sent" | "skipped" | "error", motivo: string | null, detalhe?: string) =>
    registraEnvio(admin, {
      organizationId: row.organization_id,
      leadId: l.id,
      plataforma,
      evento,
      status,
      motivo,
      eventoId: conversao.eventoId,
      valorCentavos: valor,
      moeda: conversao.moeda,
      detalhe: detalhe ?? null,
    });

  const r = await transporte.enviar(credencial.credencial, conversao);
  if (r.tipo === "ok") {
    if (credencial.credencial.testEventCode) {
      await registra("skipped", "evento_de_teste", "Evento recebido em modo de teste.");
      return ok("skipped", "evento_de_teste");
    }
    await registra("sent", null, r.detalhe);
    return ok("ok", `mensalidade reportada (${plataforma})`);
  }
  if (r.tipo === "transitorio" || r.tipo === "processando") {
    await registra("skipped", "nova_tentativa_agendada", r.detalhe);
    return {
      consumer_key: CONSUMER_KEY,
      status: "retry",
      retry_at: new Date(Date.now() + ESPERA_MS).toISOString(),
      detail: r.detalhe,
    };
  }
  await registra("error", "recusado_pela_plataforma", r.detalhe);
  return ok("skipped", "recusado_pela_plataforma");
}

async function handle(row: EventRow): Promise<HandlerResult> {
  try {
    return await processarMensalidade(row);
  } catch {
    return {
      consumer_key: CONSUMER_KEY,
      status: "retry",
      retry_at: new Date(Date.now() + ESPERA_MS).toISOString(),
      detail: "Falha ao ler ou registrar a mensalidade. Nova tentativa agendada.",
    };
  }
}

export const conversaoDeMensalidadeHandler: EventHandler = {
  key: CONSUMER_KEY,
  naOrgParada: "pula",
  events: ["lead.payment_received"],
  handle,
};
