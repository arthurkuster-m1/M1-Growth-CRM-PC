/**
 * GET    /api/v1/anotacoes/[id] — a página aberta, com o conteúdo.
 * PATCH  /api/v1/anotacoes/[id] — título, ícone, conteúdo, lugar na árvore e visibilidade.
 * DELETE /api/v1/anotacoes/[id] — manda para a lixeira; com `?definitivo=1` (e já na lixeira), apaga de vez.
 *
 * O conteúdo é salvo a cada pausa de digitação, então gravar título/ícone/conteúdo/posição NÃO
 * audita (encheria o log, como no rascunho de Marketing). Mover de lugar, mudar a visibilidade,
 * apagar e restaurar auditam.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  COLUNAS_DA_NOTA,
  COLUNAS_DO_RESUMO,
  PROFUNDIDADE_MAXIMA,
  alturaDaSubarvore,
  edicaoDeNotaSchema,
  estaDentroDe,
  idDeNotaSchema,
  idsDaSubarvore,
  profundidadeDaNota,
  type NotaAberta,
  type ResumoDaNota,
} from "@/lib/anotacoes/paginas";
import { camposDeBusca, dobrar } from "@/lib/anotacoes/busca";
import { lerDocumento } from "@/lib/anotacoes/documento";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface Contexto {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Contexto): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", {
    requestId,
    resource: "notes_pages",
    allowPlatformAdmin: "leitura",
  });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const id = idDeNotaSchema.safeParse((await ctx.params).id);
  if (!id.success) return fail("not_found", t("Página não encontrada."), 404, { requestId });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes_pages")
    .select(COLUNAS_DA_NOTA)
    .eq("organization_id", authz.org.orgId)
    .eq("id", id.data)
    .maybeSingle();
  if (error) return fail("internal_error", t("Erro ao carregar a página."), 500, { requestId });
  if (!data) return fail("not_found", t("Página não encontrada."), 404, { requestId });

  const linha = data as unknown as NotaAberta;
  const page: NotaAberta = {
    ...linha,
    position: Number(linha.position),
    blocks: lerDocumento(linha.blocks),
  };
  return ok({ page }, { requestId });
}

async function resumosDaOrganizacao(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
): Promise<ResumoDaNota[]> {
  const { data } = await supabase
    .from("notes_pages")
    .select(COLUNAS_DO_RESUMO)
    .eq("organization_id", orgId)
    .limit(2000);
  return ((data ?? []) as unknown as ResumoDaNota[]).map((n) => ({
    ...n,
    position: Number(n.position),
  }));
}

export async function PATCH(req: NextRequest, ctx: Contexto): Promise<Response> {
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

  const id = idDeNotaSchema.safeParse((await ctx.params).id);
  if (!id.success) return fail("not_found", t("Página não encontrada."), 404, { requestId });
  const notaId = id.data;

  const parsed = edicaoDeNotaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", t("Dados inválidos."), 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
    });
  }
  const { cascade, ...campos } = parsed.data;
  const orgId = authz.org.orgId;
  const supabase = await createClient();

  // Mover e mudar visibilidade precisam enxergar a árvore; o salvamento de conteúdo, não.
  const precisaDaArvore = campos.parent_id !== undefined || campos.visible_to_client !== undefined;
  const arvore = precisaDaArvore ? await resumosDaOrganizacao(supabase, orgId) : [];
  const atual = precisaDaArvore ? arvore.find((n) => n.id === id.data) : undefined;
  if (precisaDaArvore && (!atual || atual.deleted_at)) {
    return fail("not_found", t("Página não encontrada."), 404, { requestId });
  }

  if (campos.parent_id !== undefined && campos.parent_id !== atual!.parent_id) {
    const destino = campos.parent_id;
    if (destino !== null) {
      const mae = arvore.find((n) => n.id === destino);
      if (!mae || mae.deleted_at) {
        return fail("not_found", t("Página não encontrada."), 404, { requestId });
      }
      if (estaDentroDe(arvore, destino, id.data)) {
        return fail("validation_failed", t("Uma página não pode ficar dentro dela mesma."), 422, {
          requestId,
        });
      }
      if (
        profundidadeDaNota(arvore, destino) + alturaDaSubarvore(arvore, id.data) >
        PROFUNDIDADE_MAXIMA
      ) {
        return fail("validation_failed", t("Subpáginas demais, uma dentro da outra."), 422, {
          requestId,
        });
      }
    }
  }

  const { visible_to_client: visibilidade, ...resto } = campos;
  const atualizacao: Record<string, unknown> = { ...resto, updated_by: authz.user.id };
  // A busca acompanha o conteúdo: o texto do documento e o título, sem acento.
  if (resto.blocks !== undefined) {
    let titulo = resto.title;
    if (titulo === undefined) {
      const { data: atualTitulo } = await supabase
        .from("notes_pages")
        .select("title")
        .eq("organization_id", orgId)
        .eq("id", id.data)
        .maybeSingle();
      titulo = (atualTitulo as { title: string } | null)?.title ?? "";
    }
    Object.assign(atualizacao, camposDeBusca(titulo, resto.blocks));
  } else if (resto.title !== undefined) {
    atualizacao.title_fold = dobrar(resto.title).slice(0, 400);
  }
  const alcance =
    visibilidade !== undefined && cascade ? idsDaSubarvore(arvore, id.data) : [id.data];
  if (visibilidade !== undefined && alcance.length === 1)
    atualizacao.visible_to_client = visibilidade;

  const { data, error } = await supabase
    .from("notes_pages")
    .update(atualizacao)
    .eq("organization_id", orgId)
    .eq("id", id.data)
    .is("deleted_at", null)
    .select("id, updated_at")
    .maybeSingle();
  if (error) return fail("internal_error", t("Erro ao salvar a página."), 500, { requestId });
  if (!data) return fail("not_found", t("Página não encontrada."), 404, { requestId });

  // Visibilidade da página e, se pedido, de tudo que está dentro dela.
  if (visibilidade !== undefined && alcance.length > 1) {
    const { error: erroDaVisibilidade } = await supabase
      .from("notes_pages")
      .update({ visible_to_client: visibilidade, updated_by: authz.user.id })
      .eq("organization_id", orgId)
      .in("id", alcance)
      .is("deleted_at", null);
    if (erroDaVisibilidade) {
      return fail("internal_error", t("Erro ao salvar a página."), 500, { requestId });
    }
  }

  if (campos.parent_id !== undefined && campos.parent_id !== atual?.parent_id) {
    await audit({
      organizationId: orgId,
      actorUserId: authz.user.id,
      action: "notes_page.moved",
      resourceType: "notes_pages",
      resourceId: notaId,
      requestId,
      metadata: { de: atual?.parent_id ?? null, para: campos.parent_id },
    });
  }
  if (visibilidade !== undefined && (cascade || visibilidade !== atual?.visible_to_client)) {
    await audit({
      organizationId: orgId,
      actorUserId: authz.user.id,
      action: "notes_page.visibility_changed",
      resourceType: "notes_pages",
      resourceId: notaId,
      requestId,
      metadata: { visible_to_client: visibilidade, paginas: alcance.length },
    });
  }

  return ok({ updated_at: (data as { updated_at: string }).updated_at }, { requestId });
}

export async function DELETE(req: NextRequest, ctx: Contexto): Promise<Response> {
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

  const id = idDeNotaSchema.safeParse((await ctx.params).id);
  if (!id.success) return fail("not_found", t("Página não encontrada."), 404, { requestId });
  const notaId = id.data;
  const definitivo = req.nextUrl.searchParams.get("definitivo") === "1";
  const orgId = authz.org.orgId;

  const supabase = await createClient();
  const arvore = await resumosDaOrganizacao(supabase, orgId);
  const atual = arvore.find((n) => n.id === id.data);
  if (!atual) return fail("not_found", t("Página não encontrada."), 404, { requestId });

  if (definitivo) {
    if (!atual.deleted_at) {
      return fail(
        "validation_failed",
        t("Mande a página para a lixeira antes de apagar de vez."),
        422,
        {
          requestId,
        },
      );
    }
    const { error } = await supabase
      .from("notes_pages")
      .delete()
      .eq("organization_id", orgId)
      .eq("id", id.data);
    if (error) return fail("internal_error", t("Erro ao apagar a página."), 500, { requestId });
    await audit({
      organizationId: orgId,
      actorUserId: authz.user.id,
      action: "notes_page.deleted",
      resourceType: "notes_pages",
      resourceId: notaId,
      requestId,
      metadata: { paginas: idsDaSubarvore(arvore, id.data).length },
    });
    return ok({ apagada: true }, { requestId });
  }

  if (atual.deleted_at) return ok({ lixeira: true }, { requestId });
  const alcance = idsDaSubarvore(arvore, id.data).filter(
    (x) => !arvore.find((n) => n.id === x)?.deleted_at,
  );
  const { error } = await supabase
    .from("notes_pages")
    .update({ deleted_at: new Date().toISOString(), updated_by: authz.user.id })
    .eq("organization_id", orgId)
    .in("id", alcance);
  if (error) return fail("internal_error", t("Erro ao apagar a página."), 500, { requestId });
  await audit({
    organizationId: orgId,
    actorUserId: authz.user.id,
    action: "notes_page.trashed",
    resourceType: "notes_pages",
    resourceId: notaId,
    requestId,
    metadata: { paginas: alcance.length },
  });
  return ok({ lixeira: true }, { requestId });
}
