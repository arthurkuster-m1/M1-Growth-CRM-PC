/**
 * Taxas das formas de pagamento (Pix, cartão de crédito por parcela, cartão de débito e as formas
 * criadas pela empresa). Client de sessão: a RLS decide quem lê (organização) e quem escreve
 * (manager+).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { FORMAS_PRINCIPAIS, SEM_TAXA, chaveDaFormaNova, taxaSchema } from "@/lib/financeiro/taxas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COLUNAS = "forma, name, is_custom, is_active, payer, percent_bps, fixed_cents, installment_bps";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "financeiro" });
  if (!authz.ok) return authz.response;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_fee_settings")
    .select(COLUNAS)
    .eq("organization_id", authz.org.orgId)
    .eq("is_active", true)
    .limit(200);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  const gravadas = (data ?? []) as unknown as Array<ReturnType<typeof SEM_TAXA>>;
  // As três formas principais sempre existem, mesmo sem taxa cadastrada.
  const principais = FORMAS_PRINCIPAIS.map(
    (f) => gravadas.find((g) => g.forma === f) ?? SEM_TAXA(f),
  );
  const outras = gravadas
    .filter((g) => !(FORMAS_PRINCIPAIS as readonly string[]).includes(g.forma))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return ok([...principais, ...outras], { requestId });
}

/** Salva a taxa de uma forma; com `forma` nova (+ `name`) cria uma forma "Outra". */
export async function PUT(req: NextRequest): Promise<Response> {
  const denied = await requireSupportWrite();
  if (denied) return denied;
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "financeiro" });
  if (!authz.ok) return authz.response;
  const json = await req.json().catch(() => null);
  const parsed = taxaSchema.safeParse(json);
  if (!parsed.success) {
    return fail("validation_failed", "Taxa inválida.", 422, { requestId });
  }
  const d = parsed.data;
  const principal = (FORMAS_PRINCIPAIS as readonly string[]).includes(d.forma);
  let forma = d.forma;
  let name: string | null = null;
  if (!principal) {
    if (!d.name && !forma.startsWith("outra:")) {
      return fail("validation_failed", "Dê um nome à forma de pagamento.", 422, { requestId });
    }
    forma = forma.startsWith("outra:") ? forma : chaveDaFormaNova(d.name ?? forma);
    name = d.name ?? null;
  }
  const supabase = await createClient();
  const linha = {
    organization_id: authz.org.orgId,
    forma,
    name,
    is_custom: !principal,
    is_active: true,
    payer: principal && forma !== "cartao_credito" && forma !== "cartao_debito" && forma !== "pix" ? "company" : d.payer,
    percent_bps: d.percent_bps,
    fixed_cents: d.fixed_cents,
    installment_bps: forma === "cartao_credito" ? d.installment_bps : {},
  };
  const { data, error } = await supabase
    .from("payment_fee_settings")
    .upsert(linha as never, { onConflict: "organization_id,forma" })
    .select(COLUNAS)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok(data, { requestId });
}

/** Tira uma forma criada pela empresa de uso (as principais não saem). */
export async function DELETE(req: NextRequest): Promise<Response> {
  const denied = await requireSupportWrite();
  if (denied) return denied;
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "financeiro" });
  if (!authz.ok) return authz.response;
  const forma = req.nextUrl.searchParams.get("forma") ?? "";
  if (!forma.startsWith("outra:")) {
    return fail("validation_failed", "Só as formas criadas por você podem ser removidas.", 422, {
      requestId,
    });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("payment_fee_settings")
    .update({ is_active: false } as never)
    .eq("organization_id", authz.org.orgId)
    .eq("forma", forma);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok({ removida: true }, { requestId });
}
