import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/marketing/ofertas/importar — cadastra produtos e serviços em lote, a partir das
 * linhas da planilha (CSV lido pela tela). Cada linha vira uma OFERTA SIMPLES, em rascunho ou já
 * publicada (e então a IA passa a enxergá-la). Manager+.
 *
 * Idempotente de propósito: produto cujo NOME já existe (sem distinguir caixa e acento) é
 * PULADO e listado — reenviar a mesma planilha não duplica nada.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import {
  COLUNAS_DO_MODELO,
  MAXIMO_DE_LINHAS,
  ofertaDaLinha,
  semAcento,
  type LinhaDaPlanilha,
} from "@/lib/marketing/produtos-csv";
import { chaveDeSubpagina } from "@/lib/marketing/modulos";
import { sincronizarOfertas } from "@/lib/marketing/sincronizar-ofertas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MODULO = "produtos-e-ofertas";
const MAXIMO_DE_PAGINAS = 500;
const ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789";
const novoId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALFABETO[b % ALFABETO.length]).join(
    "",
  );

const corpoSchema = z.object({
  linhas: z
    .array(z.record(z.string(), z.string().max(2000)))
    .min(1)
    .max(MAXIMO_DE_LINHAS),
  publicar: z.boolean().default(false),
});

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = randomUUID();
  const authz = await requireRole("manager", {
    requestId,
    resource: "marketing_pages",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  }
  const orgId = authz.org.orgId;
  const supabase = await createClient();

  const { data: existentes, error: erroDeLeitura } = await supabase
    .from("marketing_pages")
    .select("title, sort_order")
    .eq("organization_id", orgId)
    .like("module_key", `${MODULO}--%`)
    .limit(1000);
  if (erroDeLeitura) {
    return fail("internal_error", t("Erro ao ler os produtos."), 500, { requestId });
  }
  const lista = (existentes ?? []) as Array<{ title: string; sort_order: number }>;
  const nomesExistentes = new Set(lista.map((p) => semAcento(p.title)));
  let proximaPosicao = lista.reduce((m, p) => Math.max(m, p.sort_order), -1) + 1;

  const novas: Array<{ chave: string; titulo: string; bloco: unknown }> = [];
  const problemas: Array<{ linha: number; erro: string }> = [];
  const pulados: Array<{ linha: number; nome: string }> = [];

  corpo.data.linhas.forEach((bruta, i) => {
    const linha = i + 2; // a linha 1 da planilha é o cabeçalho
    const valores: LinhaDaPlanilha = {};
    for (const c of COLUNAS_DO_MODELO) if (typeof bruta[c] === "string") valores[c] = bruta[c];
    const r = ofertaDaLinha(valores, () => randomUUID().slice(0, 12));
    if (!r.ok) {
      problemas.push({ linha, erro: r.erro });
      return;
    }
    const nome = semAcento(r.titulo);
    if (nomesExistentes.has(nome)) {
      pulados.push({ linha, nome: r.titulo });
      return;
    }
    nomesExistentes.add(nome);
    novas.push({
      chave: chaveDeSubpagina(MODULO, "oferta", novoId()),
      titulo: r.titulo,
      bloco: r.oferta,
    });
  });

  if (lista.length + novas.length > MAXIMO_DE_PAGINAS) {
    return fail(
      "validation_failed",
      t("O limite é de 500 produtos. Apague os que não usa mais antes de importar."),
      422,
      { requestId },
    );
  }

  if (novas.length > 0) {
    const agora = new Date().toISOString();
    const { data: paginas, error } = await supabase
      .from("marketing_pages")
      .insert(
        novas.map((n) => ({
          organization_id: orgId,
          module_key: n.chave,
          title: n.titulo,
          sort_order: proximaPosicao++,
          ...(corpo.data.publicar
            ? { published_blocks: [n.bloco], published_at: agora, published_by: authz.user.id }
            : {}),
        })),
      )
      .select("id, module_key");
    if (error || !paginas) {
      return fail("internal_error", t("Erro ao criar os produtos."), 500, { requestId });
    }
    const idDaChave = new Map(
      (paginas as Array<{ id: string; module_key: string }>).map((p) => [p.module_key, p.id]),
    );
    const { error: erroDosRascunhos } = await supabase.from("marketing_page_drafts").insert(
      novas.map((n) => ({
        page_id: idDaChave.get(n.chave)!,
        organization_id: orgId,
        blocks: [n.bloco],
        updated_by: authz.user.id,
      })),
    );
    if (erroDosRascunhos) {
      await supabase
        .from("marketing_pages")
        .delete()
        .in("id", [...idDaChave.values()]);
      return fail("internal_error", t("Erro ao criar os produtos."), 500, { requestId });
    }

    await audit({
      organizationId: orgId,
      actorUserId: authz.user.id,
      action: "marketing_page.offers_imported",
      resourceType: "marketing_pages",
      resourceId: null,
      requestId,
      metadata: {
        criados: novas.length,
        pulados: pulados.length,
        com_erro: problemas.length,
        publicados: corpo.data.publicar,
      },
    });
    if (corpo.data.publicar) await sincronizarOfertas(orgId);
  }

  return ok(
    { criados: novas.length, pulados, problemas, publicados: corpo.data.publicar },
    { requestId, status: novas.length > 0 ? 201 : 200 },
  );
}
