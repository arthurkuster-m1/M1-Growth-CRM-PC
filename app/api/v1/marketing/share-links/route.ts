import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * GET  /api/v1/marketing/share-links — os links sem login da empresa (só a agência, manager+).
 * POST /api/v1/marketing/share-links — cria um link (do painel inteiro ou de uma página).
 *
 * O link abre só o conteúdo PUBLICADO, somente leitura, sem login (rota pública `/p/<token>`).
 * Quem pode criar é a agência; o cliente não vê nem lista os links (a RLS da tabela exige manager).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import {
  COLUNAS_DO_LINK,
  MAXIMO_DE_LINKS_VIGENTES,
  criacaoDeLinkSchema,
  gerarToken,
  linkVigente,
  type LinkDeMarketing,
} from "@/lib/marketing/links";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "marketing_share_links",
    allowPlatformAdmin: "leitura",
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_share_links")
    .select(COLUNAS_DO_LINK)
    .eq("organization_id", authz.org.orgId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return fail("internal_error", t("Erro ao listar os links."), 500, { requestId });

  return ok({ links: (data ?? []) as unknown as LinkDeMarketing[] }, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "marketing_share_links",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const parsed = criacaoDeLinkSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  }

  const supabase = await createClient();
  const { data: atuais } = await supabase
    .from("marketing_share_links")
    .select("expires_at, revoked_at")
    .eq("organization_id", authz.org.orgId)
    .is("revoked_at", null);
  const vigentes = ((atuais ?? []) as Pick<LinkDeMarketing, "expires_at" | "revoked_at">[]).filter(
    (l) => linkVigente(l),
  ).length;
  if (vigentes >= MAXIMO_DE_LINKS_VIGENTES) {
    return fail("validation_failed", t("Limite de links atingido. Revogue algum antes."), 422, {
      requestId,
    });
  }

  const dias = parsed.data.expires_in_days;
  const { data, error } = await supabase
    .from("marketing_share_links")
    .insert({
      organization_id: authz.org.orgId,
      module_key: parsed.data.module_key ?? null,
      token: gerarToken(),
      expires_at: dias ? new Date(Date.now() + dias * 86_400_000).toISOString() : null,
      created_by: authz.user.id,
    })
    .select(COLUNAS_DO_LINK)
    .single();
  if (error || !data) return fail("internal_error", t("Erro ao criar o link."), 500, { requestId });

  const link = data as unknown as LinkDeMarketing;
  // O token NUNCA vai para o log de auditoria: só o id e o escopo.
  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "marketing_share_link.created",
    resourceType: "marketing_share_links",
    resourceId: link.id,
    requestId,
    metadata: { module_key: link.module_key, expira: link.expires_at !== null },
  });

  return ok({ link }, { requestId, status: 201 });
}
