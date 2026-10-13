import { requireSupportWrite } from "@/lib/impersonate/support";
/**
 * POST /api/v1/contacts/[id]/atividades — registra à mão uma ação no histórico do cliente
 * (ligação + resultado, mensagem enviada, remarcou…). Entra na Linha do tempo da ficha.
 *
 * A linha do tempo é ancorada num negócio (`lead_id` é NOT NULL): vale o negócio informado ou,
 * sem ele, o negócio mais recente do contato.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import {
  IDS_DAS_ACOES,
  corpoDaAcao,
  somarTagComContador,
  tituloDaAcao,
} from "@/lib/leads/acoes-do-lead";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { categoriaPorRegra, lerConfigDeCategorias } from "@/lib/tags/categorias";
import { chaveDaEtiqueta } from "@/lib/tags/cor-da-etiqueta";

export const dynamic = "force-dynamic";

const corpoSchema = z.object({
  acao: z.enum(IDS_DAS_ACOES),
  /** O título da ação — obrigatório em "Outra ação". */
  titulo: z.string().trim().max(80).optional(),
  resultado: z.string().trim().max(200).optional(),
  comentario: z.string().trim().max(800).optional(),
  /** Tag a somar ao contato (a segunda vez vira "Tag: 2x"). */
  tag: z.string().trim().max(30).optional(),
  lead_id: z.string().uuid().optional(),
});

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "contacts" });
  if (!authz.ok) return authz.response;
  const t = (texto: string) => traduzir(texto, authz.user.idioma);

  const contactId = z.string().uuid().safeParse((await ctx.params).id);
  if (!contactId.success) return fail("not_found", t("Contato não encontrado."), 404, { requestId });
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  if (corpo.data.acao === "outro" && (corpo.data.titulo ?? "").length < 3) {
    return fail(
      "validation_failed",
      t("Escreva um título dizendo qual foi a ação."),
      422,
      { requestId },
    );
  }

  const supabase = await createClient();
  const orgId = authz.org.orgId;

  const { data: contato } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId.data)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!contato) return fail("not_found", t("Contato não encontrado."), 404, { requestId });

  let query = supabase
    .from("crm_leads")
    .select("id")
    .eq("organization_id", orgId)
    .eq("contact_id", contactId.data)
    .order("created_at", { ascending: false })
    .limit(1);
  if (corpo.data.lead_id) query = query.eq("id", corpo.data.lead_id);
  const { data: lead } = await query.maybeSingle();
  if (!lead) {
    return fail(
      "validation_failed",
      t("Este contato ainda não está em nenhum funil — coloque-o num funil para registrar ações."),
      422,
      { requestId },
    );
  }

  const r = await emitLeadActivity(supabase, {
    organizationId: orgId,
    leadId: (lead as { id: string }).id,
    contactId: contactId.data,
    type: "note",
    sourceModule: "ficha_do_lead",
    actor: { type: "user", id: authz.user.id },
    // O texto de baixo (resultado/comentário); o TÍTULO vai no payload e é o que a linha mostra.
    reason: corpoDaAcao(corpo.data.resultado, corpo.data.comentario),
    payload: {
      acao: corpo.data.acao,
      titulo: tituloDaAcao(corpo.data.acao, corpo.data.titulo),
      resultado: corpo.data.resultado ?? null,
      comentario: corpo.data.comentario ?? null,
    },
  });
  if (!r.ok) return fail("internal_error", t("Erro ao registrar a ação."), 500, { requestId });

  // A última atividade do cliente passa a ser esta; e, se pedida, a tag da ação (com contador).
  const atualizacao: Record<string, unknown> = { last_activity_at: new Date().toISOString() };
  let tagFinal: string | null = null;
  if (corpo.data.tag) {
    const { data: atual } = await supabase
      .from("contacts")
      .select("tags")
      .eq("id", contactId.data)
      .eq("organization_id", orgId)
      .maybeSingle();
    const tags = somarTagComContador(
      ((atual as { tags: string[] | null } | null)?.tags ?? []) as string[],
      corpo.data.tag,
    );
    atualizacao.tags = tags;
    tagFinal =
      tags.find((x) => x.toLowerCase().startsWith(corpo.data.tag!.toLowerCase())) ?? corpo.data.tag;
  }
  await supabase
    .from("contacts")
    .update(atualizacao)
    .eq("id", contactId.data)
    .eq("organization_id", orgId);

  // A tag de uma ação é da categoria "Ação": as conhecidas já se reconhecem pelo nome; a que a
  // pessoa digitou ganha a categoria aqui (uma vez), para ter a cor da categoria.
  if (corpo.data.tag && categoriaPorRegra(corpo.data.tag) === null) {
    try {
      const admin = createAdminClient();
      const { data: org } = await admin
        .from("organizations")
        .select("settings")
        .eq("id", orgId)
        .maybeSingle();
      const config = lerConfigDeCategorias(org?.settings ?? null);
      const chave = chaveDaEtiqueta(corpo.data.tag);
      if (!config.tags[chave]) {
        await admin
          .from("organizations")
          .update({
            settings: {
              ...((org?.settings as Record<string, unknown> | null) ?? {}),
              categorias_de_tags: {
                categorias: config.categorias.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor })),
                tags: { ...config.tags, [chave]: "acao" },
              },
            },
          })
          .eq("id", orgId);
      }
    } catch {
      // A categoria é só a cor da tag: não derruba o registro da ação.
    }
  }

  return ok({ registrado: true, tag: tagFinal }, { requestId, status: 201 });
}
