/**
 * POST /api/v1/anotacoes/captura — a CAIXA DE ENTRADA: joga um texto ou link para analisar depois.
 *
 * Cada organização tem uma página "Caixa de entrada" (`kind = 'inbox'`), criada na primeira captura
 * (ou tirada da lixeira, se foi apagada). A captura acrescenta um parágrafo no fim, com a data e a
 * hora no fuso da organização. Só a agência (manager+) captura; a página nasce privada.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { camposDeBusca } from "@/lib/anotacoes/busca";
import { lerDocumento, type Documento } from "@/lib/anotacoes/documento";
import { traduzir } from "@/lib/i18n/dicionario";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { FUSO_PADRAO, fusoValido } from "@/lib/tempo/fusos";

export const dynamic = "force-dynamic";

const capturaSchema = z.object({ texto: z.string().trim().min(1).max(5000) });
const TITULO_DA_CAIXA = "Caixa de entrada";

/** "12/11 14:30" no fuso da organização. */
function carimbo(fuso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: fuso,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date())
    .replace(",", "");
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "notes_pages",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const parsed = capturaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Escreva algo para guardar."), 422, { requestId });
  }

  const orgId = authz.org.orgId;
  const fuso =
    authz.org.timezone && fusoValido(authz.org.timezone) ? authz.org.timezone : FUSO_PADRAO;
  const novo = {
    id: randomUUID(),
    type: "paragraph",
    props: {},
    content: [
      { type: "text", text: `${carimbo(fuso)} — `, styles: { bold: true } },
      { type: "text", text: parsed.data.texto, styles: {} },
    ],
    children: [],
  };

  const supabase = await createClient();
  const { data: existente, error: erroDaBusca } = await supabase
    .from("notes_pages")
    .select("id, blocks, title, deleted_at")
    .eq("organization_id", orgId)
    .eq("kind", "inbox")
    .maybeSingle();
  if (erroDaBusca) {
    return fail("internal_error", t("Erro ao guardar a anotação."), 500, { requestId });
  }

  let paginaId: string;
  if (existente) {
    const linha = existente as { id: string; blocks: unknown; title: string };
    paginaId = linha.id;
    const documento: Documento = [...lerDocumento(linha.blocks), novo];
    const { error } = await supabase
      .from("notes_pages")
      .update({
        blocks: documento,
        deleted_at: null,
        updated_by: authz.user.id,
        ...camposDeBusca(linha.title, documento),
      })
      .eq("organization_id", orgId)
      .eq("id", linha.id);
    if (error) return fail("internal_error", t("Erro ao guardar a anotação."), 500, { requestId });
  } else {
    const titulo = t(TITULO_DA_CAIXA);
    const documento: Documento = [novo];
    const { data, error } = await supabase
      .from("notes_pages")
      .insert({
        organization_id: orgId,
        parent_id: null,
        title: titulo,
        icon: "📥",
        // Antes de tudo na lista: a Caixa de entrada é o primeiro lugar onde se olha.
        position: 0,
        kind: "inbox",
        blocks: documento,
        created_by: authz.user.id,
        updated_by: authz.user.id,
        ...camposDeBusca(titulo, documento),
      })
      .select("id")
      .single();
    if (error || !data) {
      return fail("internal_error", t("Erro ao guardar a anotação."), 500, { requestId });
    }
    paginaId = (data as { id: string }).id;
  }

  await audit({
    organizationId: orgId,
    actorUserId: authz.user.id,
    action: "notes_page.captured",
    resourceType: "notes_pages",
    resourceId: paginaId,
    requestId,
    metadata: { caracteres: parsed.data.texto.length },
  });

  return ok({ page_id: paginaId }, { requestId, status: 201 });
}
