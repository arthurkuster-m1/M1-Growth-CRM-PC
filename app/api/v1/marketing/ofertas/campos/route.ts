import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * PATCH  /api/v1/marketing/ofertas/campos — muda campos de UM ou VÁRIOS produtos de uma vez
 *        (a edição direto na tabela e as ações em massa). `{ keys, mudancas }`.
 * DELETE /api/v1/marketing/ofertas/campos — apaga vários produtos (`{ keys }`).
 *
 * A mudança vale no RASCUNHO e, se o produto já está publicado, também no PUBLICADO — é o que
 * "editar na tabela" promete: o que se vê na linha é o que a IA e o cliente passam a ver. O que
 * mais estiver diferente entre rascunho e publicado fica como estava. Só manager+.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import {
  ETAPAS_DA_OFERTA,
  NIVEIS_DA_OFERTA,
  TIPOS_DE_PRECO,
  lerBlocos,
} from "@/lib/marketing/blocos";
import { lerChaveDePagina } from "@/lib/marketing/modulos";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { sincronizarOfertas } from "@/lib/marketing/sincronizar-ofertas";
import { tipoAoMudarOPreco } from "@/lib/marketing/tipo-ao-mudar-preco";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MODULO = "produtos-e-ofertas";

const chaveDeOferta = z.string().refine((k) => {
  const lida = lerChaveDePagina(k);
  return lida?.modulo === MODULO && lida.tipo === "oferta";
}, "Produto inválido.");

const mudancasSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    etapa: z.enum(ETAPAS_DA_OFERTA),
    nivel: z.enum(NIVEIS_DA_OFERTA),
    carroChefe: z.boolean(),
    tipoDePreco: z.enum(TIPOS_DE_PRECO),
    /** O preço em reais; `null` limpa. */
    preco: z.number().finite().min(0).max(1e9).nullable(),
    /** Meses em que um pagamento deste produto mantém a pessoa como cliente ativa; `null` = padrão da empresa. */
    janelaAtivoMeses: z.number().int().min(1).max(60).nullable(),
  })
  .partial()
  .refine((m) => Object.keys(m).length > 0, "Nada para alterar.");

const edicaoSchema = z
  .object({ keys: z.array(chaveDeOferta).min(1).max(150), mudancas: mudancasSchema })
  .refine((v) => v.mudancas.title === undefined || v.keys.length === 1, {
    message: "O nome só muda de um em um.",
  });

const apagarSchema = z.object({ keys: z.array(chaveDeOferta).min(1).max(150) });

type Mudancas = z.infer<typeof mudancasSchema>;

/** Aplica as mudanças ao bloco de oferta de uma lista de blocos; devolve a lista nova. */
function aplicar(blocosBrutos: unknown, m: Mudancas): unknown[] | null {
  const blocos = lerBlocos(blocosBrutos);
  let achou = false;
  const saida = blocos.map((b) => {
    if (b.tipo !== "oferta") return b;
    achou = true;
    // Digitar um preço em produto gratuito/sob consulta muda o tipo para "Único" (senão o valor
    // ficava escondido atrás do tipo e a tabela parecia não ter salvo).
    const tipoNovo = m.tipoDePreco ?? tipoAoMudarOPreco(b.preco.tipo, m.preco);
    return {
      ...b,
      ...(m.etapa !== undefined ? { etapa: m.etapa } : {}),
      ...(m.nivel !== undefined ? { nivel: m.nivel } : {}),
      ...(m.carroChefe !== undefined ? { carroChefe: m.carroChefe } : {}),
      preco: {
        ...b.preco,
        ...(tipoNovo !== undefined ? { tipo: tipoNovo } : {}),
        ...(m.preco !== undefined ? { valor: m.preco === null ? "" : moedaDoNumero(m.preco) } : {}),
      },
    };
  });
  return achou ? saida : null;
}

export async function PATCH(req: NextRequest): Promise<Response> {
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

  const corpo = edicaoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  const { keys, mudancas } = corpo.data;
  const orgId = authz.org.orgId;
  const supabase = await createClient();

  const { data: paginas, error } = await supabase
    .from("marketing_pages")
    .select("id, module_key, published_blocks")
    .eq("organization_id", orgId)
    .in("module_key", keys);
  if (error) return fail("internal_error", t("Erro ao salvar os produtos."), 500, { requestId });
  const linhas = (paginas ?? []) as Array<{
    id: string;
    module_key: string;
    published_blocks: unknown;
  }>;
  const { data: rascunhos } = await supabase
    .from("marketing_page_drafts")
    .select("page_id, blocks")
    .in(
      "page_id",
      linhas.map((l) => l.id),
    );
  const blocosDoRascunho = new Map(
    ((rascunhos ?? []) as Array<{ page_id: string; blocks: unknown }>).map((r) => [
      r.page_id,
      r.blocks,
    ]),
  );

  let alterados = 0;
  let publicadosAlterados = false;
  const agora = new Date().toISOString();
  for (const l of linhas) {
    if (mudancas.title !== undefined) {
      const { error: e } = await supabase
        .from("marketing_pages")
        .update({ title: mudancas.title })
        .eq("id", l.id)
        .eq("organization_id", orgId);
      if (e) continue;
    }
    if (mudancas.janelaAtivoMeses !== undefined) {
      const { error: e } = await supabase
        .from("marketing_pages")
        .update({ janela_ativo_meses: mudancas.janelaAtivoMeses })
        .eq("id", l.id)
        .eq("organization_id", orgId);
      if (e) continue;
    }
    const semCampos = { ...mudancas };
    delete semCampos.title;
    delete semCampos.janelaAtivoMeses;
    if (Object.keys(semCampos).length > 0) {
      const novoRascunho = aplicar(blocosDoRascunho.get(l.id), semCampos);
      if (novoRascunho) {
        await supabase
          .from("marketing_page_drafts")
          .update({ blocks: novoRascunho, updated_by: authz.user.id, updated_at: agora })
          .eq("page_id", l.id)
          .eq("organization_id", orgId);
      }
      if (l.published_blocks !== null) {
        const novoPublicado = aplicar(l.published_blocks, semCampos);
        if (novoPublicado) {
          await supabase
            .from("marketing_pages")
            .update({ published_blocks: novoPublicado })
            .eq("id", l.id)
            .eq("organization_id", orgId);
          publicadosAlterados = true;
        }
      }
    }
    alterados += 1;
  }

  await audit({
    organizationId: orgId,
    actorUserId: authz.user.id,
    action: "marketing_page.offers_bulk_edited",
    resourceType: "marketing_pages",
    resourceId: null,
    requestId,
    metadata: { quantidade: alterados, campos: Object.keys(mudancas) },
  });
  if (publicadosAlterados || mudancas.title !== undefined) await sincronizarOfertas(orgId);

  return ok({ alterados }, { requestId });
}

export async function DELETE(req: NextRequest): Promise<Response> {
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

  const corpo = apagarSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_pages")
    .delete()
    .eq("organization_id", authz.org.orgId)
    .in("module_key", corpo.data.keys)
    .select("id");
  if (error) return fail("internal_error", t("Erro ao apagar os produtos."), 500, { requestId });

  await audit({
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    action: "marketing_page.offers_bulk_deleted",
    resourceType: "marketing_pages",
    resourceId: null,
    requestId,
    metadata: { quantidade: (data ?? []).length },
  });
  await sincronizarOfertas(authz.org.orgId);

  return ok({ apagados: (data ?? []).length }, { requestId });
}
