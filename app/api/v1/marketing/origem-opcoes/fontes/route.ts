/**
 * POST /api/v1/marketing/origem-opcoes/fontes { nome } — cadastra uma ORIGEM (fonte) da empresa.
 * Ela passa a ser opção para todos os leads e oportunidades (`organizations.settings.fontes_de_origem`).
 * Agent+ cadastra: quem atende o lead precisa poder criar a origem na hora.
 */
import { requireSupportWrite } from "@/lib/impersonate/support";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const corpo = z.object({ nome: z.string().trim().min(2).max(60) });

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "crm_leads" });
  if (!authz.ok) return authz.response;
  const parsed = corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Dê um nome à origem.", 422, { requestId });

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  const settings = (org?.settings as Record<string, unknown> | null) ?? {};
  const atuais = Array.isArray(settings.fontes_de_origem)
    ? (settings.fontes_de_origem as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const nome = parsed.data.nome;
  // Se já existe (sem diferenciar maiúsculas), devolve a que existe: a origem é uma só.
  const existente = atuais.find((f) => f.toLowerCase() === nome.toLowerCase());
  if (existente) return ok({ nome: existente }, { requestId });
  const { error } = await admin
    .from("organizations")
    .update({ settings: { ...settings, fontes_de_origem: [...atuais, nome].slice(0, 200) } })
    .eq("id", authz.org.orgId);
  if (error) return fail("internal_error", "Não foi possível cadastrar a origem.", 500, { requestId });
  return ok({ nome }, { requestId });
}
