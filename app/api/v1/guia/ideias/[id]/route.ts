/**
 * PATCH /api/v1/guia/ideias/[id] — a pessoa decide sobre uma ideia: aceitar (guarda a foto dos
 * números e marca quando medir de novo; opcionalmente cria a tarefa), dispensar, marcar como feita,
 * reabrir ou dar o veredito do que foi medido (e o veredito vira um aprendizado).
 *
 * O motor só SUGERE: nada aqui acontece sozinho. Cada transição confere o estado de partida no
 * próprio UPDATE (duas pessoas clicando não se atropelam: a segunda recebe 409). Manager+, org da
 * org ativa, rastro em `audit()`.
 */
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { DIAS_PARA_MEDIR, fotoAtualDaCampanha } from "@/lib/guia/gerar-ideias";
import { faltaMigrationDoGuia } from "@/lib/guia/guardado";
import { COLUNAS_DA_IDEIA, ideiaDaLinha, type StatusDaIdeia } from "@/lib/guia/ideias-guardadas";
import { SEM_IDEIAS, autorizarGuia, lerCorpo } from "@/lib/guia/servidor";
import { somarDias } from "@/lib/inicio/datas";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { diaNoFusoDaEmpresa } from "@/lib/marketing/crm-por-dia";

export const dynamic = "force-dynamic";
type Contexto = { params: Promise<{ id: string }> };

const corpoSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("aceitar"), criarTarefa: z.boolean().default(true) }),
  z.object({ acao: z.literal("dispensar"), motivo: z.string().trim().max(500).nullish() }),
  z.object({ acao: z.literal("feita") }),
  z.object({ acao: z.literal("reabrir") }),
  z.object({
    acao: z.literal("veredito"),
    veredito: z.enum(["funcionou", "nao_funcionou", "inconclusivo"]),
    resultado: z.string().trim().max(2000).nullish(),
  }),
]);

/** De que estados cada ação pode partir. */
const PARTE_DE: Record<string, StatusDaIdeia[]> = {
  aceitar: ["nova", "dispensada"],
  dispensar: ["nova", "aceita"],
  feita: ["aceita"],
  reabrir: ["aceita", "dispensada", "feita"],
};

const ACAO_DE_AUDITORIA = {
  aceitar: "guia.ideia_aceita",
  dispensar: "guia.ideia_dispensada",
  feita: "guia.ideia_feita",
  reabrir: "guia.ideia_reaberta",
  veredito: "guia.ideia_veredito",
} as const;

export async function PATCH(req: Request, { params }: Contexto): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const a = await autorizarGuia(true);
  if (!a.ok) return a.response;
  const { supabase, orgId, userId, requestId } = a;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return fail("validation_failed", "Ideia inválida.", 422, { requestId });
  }
  const corpo = await lerCorpo(req, corpoSchema, requestId);
  if (!corpo.ok) return corpo.response;
  const c = corpo.dados;

  const atual = await supabase
    .from("guia_ideias")
    .select(COLUNAS_DA_IDEIA)
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (atual.error) {
    if (faltaMigrationDoGuia(atual.error))
      return fail("guia_ideias_sem_migration", SEM_IDEIAS, 503, { requestId });
    return fail("internal_error", "Não foi possível carregar a ideia.", 500, { requestId });
  }
  if (!atual.data) return fail("not_found", "Ideia não encontrada.", 404, { requestId });
  const ideia = ideiaDaLinha(atual.data as unknown as Record<string, unknown>);
  const agora = new Date();
  const agoraIso = agora.toISOString();
  const conflito = () =>
    fail("state_conflict", "A ideia já mudou de situação. Atualize a tela.", 409, { requestId });

  if (c.acao === "veredito") {
    if (ideia.veredito) return conflito();
    if (ideia.status !== "medida" && ideia.status !== "feita") {
      return fail("validation_failed", "Só dá para avaliar uma ideia já medida ou feita.", 422, {
        requestId,
      });
    }
    const texto = c.resultado?.trim() || ideia.resultado?.linhas.join("; ") || null;
    const { data: marcada } = await supabase
      .from("guia_ideias")
      .update({ veredito: c.veredito, decidido_por: userId, updated_at: agoraIso })
      .eq("organization_id", orgId)
      .eq("id", id)
      .is("veredito", null)
      .select("id")
      .maybeSingle();
    if (!marcada) return conflito();
    const { error } = await supabase.from("guia_aprendizados").insert({
      organization_id: orgId,
      ideia_id: id,
      campanha_id: ideia.alvoTipo === "campanha" ? ideia.alvoId : null,
      titulo: ideia.titulo.slice(0, 200),
      hipotese: `Regra ${ideia.regra}: ${ideia.evidencia[0] ?? ""}`.slice(0, 1000),
      resultado: texto?.slice(0, 2000) ?? null,
      veredito: c.veredito,
      criado_por: userId,
    });
    if (error)
      return fail("internal_error", "O veredito foi salvo, mas o aprendizado não.", 500, {
        requestId,
      });
  } else {
    if (!PARTE_DE[c.acao]!.includes(ideia.status)) return conflito();
    const mudanca: Record<string, unknown> = { decidido_por: userId, updated_at: agoraIso };
    let taskId: string | null = null;

    if (c.acao === "aceitar") {
      mudanca.status = "aceita";
      mudanca.motivo = null;
      if (ideia.alvoTipo === "campanha") {
        const foto = await fotoAtualDaCampanha(supabase, orgId, ideia.alvoId, agora);
        const { data: org } = await supabase
          .from("organizations")
          .select("timezone")
          .eq("id", orgId)
          .maybeSingle();
        const hoje = diaNoFusoDaEmpresa(
          agoraIso,
          (org?.timezone as string | null) || "America/Sao_Paulo",
        );
        mudanca.linha_de_base = foto;
        mudanca.medir_em = foto ? somarDias(hoje, DIAS_PARA_MEDIR) : null;
      }
      if (c.criarTarefa && !ideia.tarefaId) {
        const { data: tarefa, error } = await supabase
          .from("crm_tasks")
          .insert({
            organization_id: orgId,
            created_by: userId,
            title: ideia.titulo.slice(0, 255),
            description: `${ideia.evidencia.join("\n")}${ideia.acaoHref ? `\n\nOnde fazer: ${ideia.acaoHref}` : ""}\n\nIdeia do Guia de marketing (${ideia.regra}).`,
            priority: ideia.prioridade === 1 ? "high" : "medium",
            status: "pending",
          })
          .select("id")
          .single();
        if (error || !tarefa)
          return fail("internal_error", "Não foi possível criar a tarefa.", 500, { requestId });
        taskId = tarefa.id as string;
        mudanca.task_id = taskId;
      }
    } else if (c.acao === "dispensar") {
      mudanca.status = "dispensada";
      mudanca.motivo = c.motivo?.trim() || null;
    } else if (c.acao === "feita") {
      mudanca.status = "feita";
    } else {
      // reabrir: volta ao começo e esquece a foto e a data (a tarefa criada, se houver, continua).
      mudanca.status = "nova";
      mudanca.motivo = null;
      mudanca.linha_de_base = null;
      mudanca.medir_em = null;
    }

    const { data: gravada, error } = await supabase
      .from("guia_ideias")
      .update(mudanca)
      .eq("organization_id", orgId)
      .eq("id", id)
      .eq("status", ideia.status)
      .select("id")
      .maybeSingle();
    if (error)
      return fail("internal_error", "Não foi possível salvar a decisão.", 500, { requestId });
    if (!gravada) return conflito();
  }

  await audit({
    organizationId: orgId,
    actorUserId: userId,
    action: ACAO_DE_AUDITORIA[c.acao],
    resourceType: "guia_ideias",
    resourceId: id,
    requestId,
    metadata: { regra: ideia.regra, ...(c.acao === "veredito" ? { veredito: c.veredito } : {}) },
  });
  return ok({ id, acao: c.acao }, { requestId });
}
