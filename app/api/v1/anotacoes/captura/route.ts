/**
 * POST /api/v1/anotacoes/captura — a CAIXA DE ENTRADA: joga um texto ou link para analisar depois.
 *
 * Cada organização tem uma página "Caixa de entrada" (`kind = 'inbox'`), criada na primeira captura
 * (ou tirada da lixeira, se foi apagada). A anotação entra no TOPO da página — a Caixa de entrada
 * ou a página escolhida em `page_id` —, com a data e a hora em negrito (fuso da organização). Só a agência (manager+) captura; a página nasce privada.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { blocosDaNota } from "@/lib/anotacoes/blocos-da-nota";
import {
  blocosDaAnotacaoRapida,
  inserirNoTopo,
  MAXIMO_DA_ANOTACAO_RAPIDA,
} from "@/lib/anotacoes/anotacao-rapida";
import { camposDeBusca } from "@/lib/anotacoes/busca";
import { MAXIMO_DE_BLOCOS_DA_NOTA } from "@/lib/anotacoes/blocos-da-nota";
import { lerDocumento, type Documento } from "@/lib/anotacoes/documento";
import { traduzir } from "@/lib/i18n/dicionario";
import { requireSupportWrite } from "@/lib/impersonate/support";
import type { Bloco } from "@/lib/marketing/blocos";
import { createClient } from "@/lib/supabase/server";
import { FUSO_PADRAO, fusoValido } from "@/lib/tempo/fusos";

export const dynamic = "force-dynamic";

const capturaSchema = z.object({
  texto: z.string().trim().min(1).max(MAXIMO_DA_ANOTACAO_RAPIDA),
  /** A página que recebe a anotação; sem ela, a Caixa de entrada. */
  page_id: z.string().uuid().optional(),
});
const TITULO_DA_CAIXA = "Caixa de entrada";

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
  const novos: Bloco[] = blocosDaAnotacaoRapida(parsed.data.texto, new Date(), fuso, () =>
    randomUUID().slice(0, 12),
  );
  if (novos.length === 0) {
    return fail("validation_failed", t("Escreva algo para guardar."), 422, { requestId });
  }

  const supabase = await createClient();
  // A página escolhida; sem escolha (ou se for a Caixa), a Caixa de entrada da empresa.
  const consulta = supabase
    .from("notes_pages")
    .select("id, blocks, title, deleted_at, kind")
    .eq("organization_id", orgId);
  const { data: existente, error: erroDaBusca } = parsed.data.page_id
    ? await consulta.eq("id", parsed.data.page_id).maybeSingle()
    : await consulta.eq("kind", "inbox").maybeSingle();
  if (erroDaBusca) {
    return fail("internal_error", t("Erro ao guardar a anotação."), 500, { requestId });
  }
  if (parsed.data.page_id && !existente) {
    return fail("not_found", t("Página não encontrada."), 404, { requestId });
  }
  const escolhida = existente as { kind?: string | null; deleted_at?: string | null } | null;
  if (parsed.data.page_id && escolhida?.deleted_at && escolhida.kind !== "inbox") {
    return fail("validation_failed", t("Essa página está na lixeira."), 422, { requestId });
  }

  let paginaId: string;
  if (existente) {
    const linha = existente as { id: string; blocks: unknown; title: string };
    paginaId = linha.id;
    const atuais = blocosDaNota(lerDocumento(linha.blocks));
    if (atuais.length + novos.length > MAXIMO_DE_BLOCOS_DA_NOTA) {
      return fail("validation_failed", t("A página está cheia: não cabe mais uma anotação."), 422, {
        requestId,
      });
    }
    const documento: Documento = inserirNoTopo(atuais, novos);
    const { error } = await supabase
      .from("notes_pages")
      .update({
        blocks: documento,
        ...(escolhida?.kind === "inbox" ? { deleted_at: null } : {}),
        updated_by: authz.user.id,
        ...camposDeBusca(linha.title, documento),
      })
      .eq("organization_id", orgId)
      .eq("id", linha.id);
    if (error) return fail("internal_error", t("Erro ao guardar a anotação."), 500, { requestId });
  } else {
    const titulo = t(TITULO_DA_CAIXA);
    const documento: Documento = novos;
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
    metadata: {
      caracteres: parsed.data.texto.length,
      pagina_escolhida: Boolean(parsed.data.page_id),
    },
  });

  return ok({ page_id: paginaId }, { requestId, status: 201 });
}
