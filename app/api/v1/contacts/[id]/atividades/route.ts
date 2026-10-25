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
  exigeResultado,
  corpoDaAcao,
  somarTagComContador,
  tituloDaAcao,
} from "@/lib/leads/acoes-do-lead";
import {
  aplicarTagsAutomaticas,
  listarTagsAutomaticas,
  tagsAutomaticasDaAbordagem,
} from "@/lib/leads/tags-automaticas";
import { registrarTentativaNaRemarcacao } from "@/lib/agenda/remarcacao";
import { iniciarAbordagemDosLeads } from "@/lib/cadencia/iniciar-abordagem";
import { subirDeEtapaAoResponder } from "@/lib/cadencia/subir-de-etapa";
import { registrarTentativaNaCadencia } from "@/lib/cadencia/progresso";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { garantirCategoriaDoFunil } from "@/lib/tags/categoria-do-funil";
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
  /** Por onde a abordagem foi feita (prospecção): alimenta o dashboard por tipo de contato. */
  meio: z.enum(["ligacao", "whatsapp", "instagram", "email", "outro"]).optional(),
  /** A abordagem (roteiro) usada, da campanha do lead. */
  abordagem_id: z.string().uuid().optional(),
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

  const contactId = z
    .string()
    .uuid()
    .safeParse((await ctx.params).id);
  if (!contactId.success)
    return fail("not_found", t("Contato não encontrado."), 404, { requestId });
  const corpo = corpoSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return fail("validation_failed", t("Dados inválidos."), 422, { requestId });
  if (corpo.data.acao === "outro" && (corpo.data.titulo ?? "").length < 3) {
    return fail("validation_failed", t("Escreva um título dizendo qual foi a ação."), 422, {
      requestId,
    });
  }

  // Ligação, mensagem e e-mail são abordagens: sem resultado não entram no histórico (os
  // dashboards de Prospecção contam contato e decisor a partir dele).
  if (exigeResultado(corpo.data.acao) && (corpo.data.resultado ?? "").trim().length < 2) {
    return fail("validation_failed", t("Diga o resultado da abordagem."), 422, { requestId });
  }

  const supabase = await createClient();
  const orgId = authz.org.orgId;
  let abordagemId: string | null = null;
  let abordagemNome: string | null = null;
  if (corpo.data.abordagem_id) {
    const { data: ab } = await supabase
      .from("demand_campaign_approaches")
      .select("id, name")
      .eq("id", corpo.data.abordagem_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    abordagemId = (ab as { id: string } | null)?.id ?? null;
    abordagemNome = (ab as { name: string } | null)?.name ?? null;
  }
  const { data: contato } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId.data)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!contato) return fail("not_found", t("Contato não encontrado."), 404, { requestId });

  let query = supabase
    .from("crm_leads")
    .select("id, pipeline_id, pipeline:crm_pipelines(name)")
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

  // As tags que a abordagem põe sozinha (contato, decisor, abordagem usada): só para as ações de
  // abordagem, que têm resultado. As de contato levam o NOME DO FUNIL ("Contato · Funil"), para
  // caberem na categoria de tags dele. O histórico guarda quais foram — a conta por dia sai dele.
  const funilDoLead = (() => {
    const p = (lead as unknown as { pipeline: { name: string } | { name: string }[] | null })
      .pipeline;
    return (Array.isArray(p) ? p[0] : p)?.name ?? null;
  })();
  const automaticas = exigeResultado(corpo.data.acao)
    ? tagsAutomaticasDaAbordagem({
        resultado: corpo.data.resultado,
        abordagemNome,
        funilNome: funilDoLead,
      })
    : { fixas: [], abordagem: null };
  const postas = listarTagsAutomaticas(automaticas);

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
      ...(corpo.data.meio ? { meio: corpo.data.meio } : {}),
      ...(abordagemId ? { abordagem_id: abordagemId } : {}),
      ...(postas.length > 0 ? { tags_automaticas: postas } : {}),
    },
  });
  if (!r.ok) return fail("internal_error", t("Erro ao registrar a ação."), 500, { requestId });

  // A última atividade do cliente passa a ser esta; e, se pedida, a tag da ação (com contador).
  const atualizacao: Record<string, unknown> = { last_activity_at: new Date().toISOString() };
  let tagFinal: string | null = null;
  if (corpo.data.tag || postas.length > 0) {
    const { data: atual } = await supabase
      .from("contacts")
      .select("tags")
      .eq("id", contactId.data)
      .eq("organization_id", orgId)
      .maybeSingle();
    let tags = ((atual as { tags: string[] | null } | null)?.tags ?? []) as string[];
    if (corpo.data.tag) tags = somarTagComContador(tags, corpo.data.tag);
    tags = aplicarTagsAutomaticas(tags, automaticas);
    atualizacao.tags = tags;
    if (corpo.data.tag) {
      tagFinal =
        tags.find((x) => x.toLowerCase().startsWith(corpo.data.tag!.toLowerCase())) ??
        corpo.data.tag;
    }
  }
  await supabase
    .from("contacts")
    .update(atualizacao)
    .eq("id", contactId.data)
    .eq("organization_id", orgId);

  // As tags automáticas são próprias do funil: ganham a categoria de tags dele (nome do funil e cor).
  if (postas.length > 0) {
    try {
      const l = lead as unknown as {
        pipeline_id: string;
        pipeline: { name: string } | { name: string }[] | null;
      };
      const funil = Array.isArray(l.pipeline) ? l.pipeline[0] : l.pipeline;
      await garantirCategoriaDoFunil(createAdminClient(), {
        organizationId: orgId,
        pipelineId: l.pipeline_id,
        nomeDoFunil: funil?.name ?? "",
        tags: postas,
      });
    } catch {
      // É só a cor e o agrupamento da tag: não derruba o registro da ação.
    }
  }

  // A cadência do lead: contato encerra, sem contato o passo é dado como feito.
  if (exigeResultado(corpo.data.acao)) {
    try {
      const admin = createAdminClient();
      // A primeira ação sobre o lead (ligação, mensagem, e-mail) é a largada: quem ainda era
      // "Novo lead" passa para "Abordagem" e a cadência começa — esta ação já conta como o passo 1.
      await iniciarAbordagemDosLeads(admin, {
        organizationId: orgId,
        leadIds: [(lead as { id: string }).id],
        motivo: "cadencia:primeira_acao",
      });
      const resultadoDaCadencia = await registrarTentativaNaCadencia(admin, {
        organizationId: orgId,
        leadId: (lead as { id: string }).id,
        respondeu: automaticas.fixas.length > 0,
      });
      // O lead que faltou e está na mini-cadência de remarcação: a tentativa conta.
      await registrarTentativaNaRemarcacao(admin, {
        organizationId: orgId,
        leadId: (lead as { id: string }).id,
        respondeu: automaticas.fixas.length > 0,
      });
      // Quem respondeu na cadência sobe de etapa (Contato, ou Contato com decisor).
      if (resultadoDaCadencia === "respondeu") {
        await subirDeEtapaAoResponder(admin, {
          organizationId: orgId,
          leadId: (lead as { id: string }).id,
          decisor: automaticas.fixas.some((x) => x.toLowerCase().startsWith("contato com decisor")),
        });
      }
    } catch {
      // A cadência é acompanhamento: não derruba o registro da ação.
    }
  }

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
