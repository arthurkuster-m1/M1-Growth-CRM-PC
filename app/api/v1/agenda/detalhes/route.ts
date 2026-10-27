/**
 * GET /api/v1/agenda/detalhes?ids=<uuid>,<uuid> — as propriedades EXTRAS dos compromissos de um
 * dia (tipo, link da reunião, telefone do cliente, funil, venda…) para o painel do calendário.
 *
 * Fica fora de `listaAgendamentos` de propósito: aquela função é compartilhada com a ferramenta
 * MCP do agente de IA, e a lista da grade não precisa carregar o telefone de todo mundo — só o
 * dia aberto pede. `agent`+ porque devolve telefone e e-mail do cliente. Toda consulta filtra
 * `organization_id` (a RLS é piso, não escopo).
 */
import { randomUUID } from "node:crypto";

import { type NextRequest } from "next/server";
import { z } from "zod";

import type { DetalheDoCompromisso } from "@/lib/agenda/propriedades-do-compromisso";
import { corDoTipo } from "@/lib/agenda/cor-do-tipo";
import { recorteDeVisibilidadeDaAgenda } from "@/lib/agenda/visibilidade";
import { ALVO_DE_VINCULO_DO_AGENDAMENTO } from "@/lib/agenda/tipos";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";
import { SELECAO_DA_OPORTUNIDADE, vendaDaOportunidade } from "@/lib/vendas";

export const dynamic = "force-dynamic";

const idsSchema = z.array(z.string().uuid()).min(1).max(60);

type Linha = Record<string, unknown>;
const texto = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const t = (s: string) => traduzir(s, authz.user.idioma);
  const orgId = authz.org.orgId;

  const ids = idsSchema.safeParse(
    (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean),
  );
  if (!ids.success) return fail("validation_failed", t("Consulta inválida."), 422, { requestId });

  const supabase = await createClient();
  const soDoDono = await recorteDeVisibilidadeDaAgenda(supabase, orgId, authz.org.role, authz.user.id);
  const { data: compromissos, error } = await supabase
    .from("calendar_appointments")
    .select(
      "id, event_type_id, contact_id, conversation_id, notes, meeting_url, meeting_state, location_kind, location_details, outcome_recorded_at, cancelled_at, cancellation_reason, rescheduled_from_id, reminder_sent_at, google_synced_at, google_sync_error",
    )
    .eq("organization_id", orgId)
    .in("id", ids.data)
    .match(soDoDono ? { owner_user_id: soDoDono } : {});
  if (error)
    return fail("internal_error", t("Erro ao carregar os compromissos."), 500, { requestId });
  const linhas = (compromissos ?? []) as Linha[];

  const idsDe = (campo: string) => [
    ...new Set(linhas.map((l) => texto(l[campo])).filter((x): x is string => x !== null)),
  ];
  const tiposIds = idsDe("event_type_id");
  const contatosIds = idsDe("contact_id");
  const origemIds = idsDe("rescheduled_from_id");

  const [tipos, contatos, vinculos, origens] = await Promise.all([
    tiposIds.length
      ? supabase
          .from("calendar_event_types")
          .select("id, name, category")
          .eq("organization_id", orgId)
          .in("id", tiposIds)
      : { data: [] as Linha[] },
    contatosIds.length
      ? supabase
          .from("contacts")
          .select("id, phone_number, email")
          .eq("organization_id", orgId)
          .in("id", contatosIds)
      : { data: [] as Linha[] },
    // A OPORTUNIDADE do compromisso é a que ele já tem ligada (o vínculo gravado na marcação),
    // e a venda é a própria oportunidade vista pelo dinheiro (parcelas) — mesma conta das telas.
    supabase
      .from("crm_lead_links")
      .select("lead_id, target_id, created_at")
      .eq("organization_id", orgId)
      .eq("target_kind", ALVO_DE_VINCULO_DO_AGENDAMENTO)
      .in("target_id", ids.data)
      .order("created_at", { ascending: true }),
    origemIds.length
      ? supabase
          .from("calendar_appointments")
          .select("id, starts_at")
          .eq("organization_id", orgId)
          .in("id", origemIds)
      : { data: [] as Linha[] },
  ]);

  const leadPorCompromisso = new Map<string, string>();
  for (const v of (vinculos.data ?? []) as Linha[]) {
    const alvo = texto(v.target_id);
    const lead = texto(v.lead_id);
    // O vínculo mais antigo vale (a lista vem em ordem de criação).
    if (alvo && lead && !leadPorCompromisso.has(alvo)) leadPorCompromisso.set(alvo, lead);
  }
  const leadIds = [...new Set(leadPorCompromisso.values())];
  const { data: oportunidades } = leadIds.length
    ? await supabase
        .from("crm_leads")
        .select(SELECAO_DA_OPORTUNIDADE)
        .eq("organization_id", orgId)
        .in("id", leadIds)
    : { data: [] as Linha[] };
  const vendaPorLead = new Map(
    ((oportunidades ?? []) as unknown as Linha[]).map((o) => [
      String(o.id),
      vendaDaOportunidade(o),
    ]),
  );

  const por = (lista: unknown, chave: string) => {
    const mapa = new Map<string, Linha>();
    for (const l of (lista ?? []) as Linha[]) {
      const k = texto(l[chave]);
      // A lista vem da mais nova para a mais velha: a primeira de cada chave é a que vale.
      if (k && !mapa.has(k)) mapa.set(k, l);
    }
    return mapa;
  };
  const tipoPorId = por(tipos.data, "id");
  const contatoPorId = por(contatos.data, "id");
  const origemPorId = por(origens.data, "id");
  const detalhes: DetalheDoCompromisso[] = linhas.map((l) => {
    const tipo = tipoPorId.get(texto(l.event_type_id) ?? "");
    const contatoId = texto(l.contact_id) ?? "";
    const contato = contatoPorId.get(contatoId);
    const venda = vendaPorLead.get(leadPorCompromisso.get(String(l.id)) ?? "");
    return {
      id: String(l.id),
      tipo: tipo
        ? {
            nome: texto(tipo.name) ?? "",
            cor: corDoTipo(String(tipo.id)),
            categoria: texto(tipo.category) ?? "outro",
          }
        : null,
      observacoes: texto(l.notes),
      link_reuniao: texto(l.meeting_url),
      status_do_link: texto(l.meeting_state),
      tipo_de_local: texto(l.location_kind),
      local: texto(l.location_details),
      telefone: contato ? texto(contato.phone_number) : null,
      email: contato ? texto(contato.email) : null,
      conversa_id: texto(l.conversation_id),
      funil: venda?.funil ?? null,
      etapa: venda?.etapa ?? null,
      venda: venda
        ? { status: venda.status, valor_cents: venda.amount_cents, moeda: venda.currency }
        : null,
      resultado_registrado_em: texto(l.outcome_recorded_at),
      cancelado_em: texto(l.cancelled_at),
      motivo_do_cancelamento: texto(l.cancellation_reason),
      remarcado_de: texto(origemPorId.get(texto(l.rescheduled_from_id) ?? "")?.starts_at),
      lembrete_enviado_em: texto(l.reminder_sent_at),
      google_sincronizado_em: texto(l.google_synced_at),
      google_erro: texto(l.google_sync_error),
    };
  });

  return ok({ detalhes }, { requestId });
}
