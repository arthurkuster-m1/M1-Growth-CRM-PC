/**
 * GET /api/v1/cron/vendas-recorrentes
 *
 * Duas tarefas, uma vez por dia:
 *  1. GERA as parcelas dos próximos meses de toda recorrência ativa, mantendo `recurrence_ahead`
 *     (padrão 1) previstas à frente (nascem "prevista" — nunca pagas sozinhas);
 *  2. AVISA na Central (um dia antes/no dia, e um dia depois) cada parcela prevista: "esse lead
 *     pagou? houve negociação do valor?". Cada parcela gera no máximo dois avisos.
 *
 * Auth: `Authorization: Bearer <INTERNAL_CRON_SECRET>` (fail-closed).
 */
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { autorizaCron } from "@/lib/auth/cron-auth";
import { logger } from "@/lib/logger";
import { ehOperante, statusDaOrgEmbutida } from "@/lib/organizacao/operante";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisoDaCobranca, somarMesesNaData } from "@/lib/vendas-recorrentes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LIMITE = 500;

const MOMENTO: Record<string, string> = {
  amanha: "vence amanhã",
  hoje: "vence hoje",
  atrasada: "venceu e não foi confirmada",
};

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  if (!autorizaCron(req)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }
  const admin = createAdminClient();
  const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); // dia em São Paulo

  // ── 1. Gerar a parcela do próximo mês ────────────────────────────────────────────────────
  let geradas = 0;
  const { data: vendas } = await admin
    .from("crm_leads")
    .select(
      "id, organization_id, value_cents, closed_at, recurrence_ahead, organizations!inner(status)",
    )
    .eq("recurrence_active", true)
    .in("status", ["open", "won"])
    .limit(LIMITE);
  for (const v of vendas ?? []) {
    if (!ehOperante(statusDaOrgEmbutida(v.organizations as never))) continue;
    const { data: parcelas } = await admin
      .from("crm_sale_payments")
      .select("number, due_on, amount_cents, status")
      .eq("lead_id", v.id as string)
      .order("due_on", { ascending: false });
    const lista = (parcelas ?? []) as Array<{
      number: number;
      due_on: string;
      amount_cents: number;
      status: string;
    }>;
    // Mantém N parcelas previstas à frente (padrão 1): completa só o que falta.
    const alvo = Math.min(12, Math.max(1, Number(v.recurrence_ahead) || 1));
    const abertas = lista.filter((p) => p.status === "prevista").length;
    const faltam = alvo - abertas;
    if (faltam <= 0) continue;
    const validas = lista.filter((p) => p.status !== "cancelada");
    // Só gera para assinatura que já tem parcela (compromisso ou pagamento): interesse não cobra.
    if (validas.length === 0) continue;
    const ultima = validas[0]!; // a lista vem da mais recente para a mais antiga
    let numero = ultima.number;
    let base = ultima.due_on ?? hoje;
    const valor = Number(ultima.amount_cents) || Number(v.value_cents) || 0;
    for (let k = 0; k < faltam; k += 1) {
      numero += 1;
      base = somarMesesNaData(base, 1);
      const { error } = await admin.from("crm_sale_payments").insert({
        organization_id: v.organization_id,
        lead_id: v.id,
        number: numero,
        due_on: base,
        amount_cents: valor,
        status: "prevista",
      });
      if (error) {
        logger.warn("[vendas-recorrentes] parcela não gerada", {
          sale: v.id,
          error: error.message,
        });
        break;
      }
      geradas += 1;
    }
  }

  // ── 2. Avisar: pagou? houve negociação? ─────────────────────────────────────────────────
  let avisos = 0;
  const { data: previstas } = await admin
    .from("crm_sale_payments")
    .select(
      "id, organization_id, lead_id, due_on, amount_cents, reminded_before_on, reminded_after_on, crm_leads!inner(id, contact_id, title, nome_da_venda, status, contacts(name, display_name, phone_number))",
    )
    .eq("status", "prevista")
    .lte(
      "due_on",
      new Date(Date.parse(`${hoje}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10),
    )
    .limit(LIMITE);
  for (const p of previstas ?? []) {
    const momento = avisoDaCobranca(
      {
        due_on: p.due_on as string,
        reminded_before_on: p.reminded_before_on as string | null,
        reminded_after_on: p.reminded_after_on as string | null,
      },
      hoje,
    );
    if (!momento) continue;
    const oportunidade = p.crm_leads as unknown as {
      id: string;
      status: string;
      title: string;
      nome_da_venda: string;
      contacts: { name?: string; display_name?: string; phone_number?: string } | null;
    };
    const venda = {
      lead_id: oportunidade.id as string | null,
      status: oportunidade.status,
      product_name: oportunidade.nome_da_venda || oportunidade.title,
      contacts: oportunidade.contacts,
    };
    if (venda.status === "lost") continue;
    const cliente =
      nomeDoContato(venda.contacts) ?? venda.contacts?.phone_number ?? "Cliente";
    const valor = (Number(p.amount_cents) / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    const data = (p.due_on as string).split("-").reverse().join("/");
    if (venda.lead_id) {
      const { error } = await admin.from("agent_inbox_items").insert({
        organization_id: p.organization_id,
        kind: "other",
        severity: momento === "atrasada" ? "critical" : "warn",
        title: `Cobrança: ${cliente} — ${MOMENTO[momento]}`,
        body: `${venda.product_name || "Recorrência"} · ${valor} · vencimento ${data}. Confirme em Clientes › Vendas se o lead pagou e se houve negociação do valor.`,
        ref_kind: "lead",
        ref_id: venda.lead_id,
      });
      if (error) {
        logger.warn("[vendas-recorrentes] aviso não aberto", { error: error.message });
        continue;
      }
    }
    await admin
      .from("crm_sale_payments")
      .update(
        momento === "atrasada"
          ? {
              reminded_after_on: hoje,
              reminded_before_on: (p.reminded_before_on as string | null) ?? hoje,
            }
          : { reminded_before_on: hoje },
      )
      .eq("id", p.id as string);
    avisos += 1;
  }

  // ── 3. Ciclo de vida: quem saiu da janela de "ativo" hoje vira ex-cliente ────────────────
  let ciclos = 0;
  const { data: recalculados } = await admin.rpc("fn_ciclo_recalcula_todos" as never, {} as never);
  if (typeof recalculados === "number") ciclos = recalculados;

  // ── 3b. Parcelas vencidas entram na linha do tempo do lead (uma vez cada) ─────────────────
  let atrasadas = 0;
  const { data: marcadas } = await admin.rpc("fn_registrar_parcelas_atrasadas" as never, {} as never);
  if (typeof marcadas === "number") atrasadas = marcadas;

  // ── 4. Lixeira: o que passou de 7 dias é apagado de vez ────────────────────────────────
  let lixeira = 0;
  const { data: esvaziados } = await admin.rpc("fn_lixeira_esvaziar" as never, {} as never);
  if (typeof esvaziados === "number") lixeira = esvaziados;

  return ok({ geradas, avisos, ciclos, atrasadas, lixeira }, { requestId });
}
