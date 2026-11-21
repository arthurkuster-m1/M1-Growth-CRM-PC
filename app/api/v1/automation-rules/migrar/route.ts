import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/automation-rules/migrar — a migração das regras para o motor único (Fase 4c do plano do
 * motor único). Admin da organização ativa.
 *
 *   { "acao": "simular" }                 → o ENSAIO (padrão): converte em memória, NÃO grava nada.
 *   { "acao": "migrar" }                  → cria os fluxos, desliga as regras, publica (reversível).
 *   { "acao": "desfazer", "rule_id": … }  → pausa o fluxo e religa a regra como estava.
 *
 * Só `simular` é leitura. `migrar` e `desfazer` mudam o que o sistema faz sozinho, então exigem o aval de
 * suporte, ficam no audit e nunca aceitam organização vinda do corpo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import {
  createSupabaseMigracaoDb,
  desfazerMigracao,
  migrarRegras,
  simularMigracao,
} from "@/lib/followup/migrar-regras";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.discriminatedUnion("acao", [
  z.strictObject({ acao: z.literal("simular") }),
  z.strictObject({ acao: z.literal("migrar") }),
  z.strictObject({ acao: z.literal("desfazer"), rule_id: z.string().uuid() }),
]);

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "automation_rules" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);
  const { user, org: activeOrg } = authz;

  let raw: unknown = { acao: "simular" };
  try {
    const lido = await req.json();
    if (lido && typeof lido === "object") raw = lido;
  } catch {
    // corpo vazio = o ensaio
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return fail("invalid_request", t("Dados inválidos."), 400, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  const db = createSupabaseMigracaoDb(createAdminClient());
  const orgId = activeOrg.orgId;

  if (parsed.data.acao === "simular") {
    return ok({ relatorio: await simularMigracao(db, orgId) }, { requestId });
  }

  // `migrar` e `desfazer` mudam o que roda sozinho: antes do efeito, o aval de suporte.
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  if (parsed.data.acao === "desfazer") {
    const r = await desfazerMigracao(db, { orgId, ruleId: parsed.data.rule_id });
    if (!r.ok) return fail("invalid_request", r.motivo, 422, { requestId });
    void audit({
      action: "automation.rule_migration_reverted",
      actorUserId: user.id,
      organizationId: orgId,
      resourceType: "automation_rule",
      resourceId: parsed.data.rule_id,
      requestId,
      metadata: { religada: r.religada },
    });
    return ok({ religada: r.religada }, { requestId });
  }

  const relatorio = await migrarRegras(db, { orgId, userId: user.id });
  const contagem: Record<string, number> = {};
  for (const l of relatorio) contagem[l.resultado] = (contagem[l.resultado] ?? 0) + 1;
  void audit({
    action: "automation.rules_migrated",
    actorUserId: user.id,
    organizationId: orgId,
    resourceType: "automation_rule",
    requestId,
    metadata: contagem,
  });
  return ok({ relatorio }, { requestId });
}
