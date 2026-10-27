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
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { traduzir } from "@/lib/i18n/dicionario";
import { createClient } from "@/lib/supabase/server";

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
  const { data: compromissos, error } = await supabase
    .from("calendar_appointments")
    .select(
      "id, event_type_id, contact_id, conversation_id, notes, meeting_url, meeting_state, location_kind, location_details, outcome_recorded_at, cancelled_at, cancellation_reason, rescheduled_from_id, reminder_sent_at, google_synced_at, google_sync_error",
    )
    .eq("organization_id", orgId)
    .in("id", ids.data);
  if (error)
    return fail("internal_error", t("Erro ao carregar os compromissos."), 500, { requestId });
  const linhas = (compromissos ?? []) as Linha[];

  const idsDe = (campo: string) => [
    ...new Set(linhas.map((l) => texto(l[campo])).filter((x): x is string => x !== null)),
  ];
  const tiposIds = idsDe("event_type_id");
  const contatosIds = idsDe("contact_id");
  const origemIds = idsDe("rescheduled_from_id");

  const [tipos, contatos, leads, vendas, origens] = await Promise.all([
    tiposIds.length
      ? supabase
          .from("calendar_event_types")
          .select("id, name, color, category")
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
    contatosIds.length
      ? supabase
          .from("crm_leads")
          .select("contact_id, status, created_at, crm_pipelines(name), crm_stages(name)")
          .eq("organization_id", orgId)
          .in("contact_id", contatosIds)
          .order("created_at", { ascending: false })
      : { data: [] as Linha[] },
    contatosIds.length
      ? supabase
          .from("crm_sales")
          .select("contact_id, status, amount_cents, currency, created_at")
          .eq("organization_id", orgId)
          .in("contact_id", contatosIds)
          .order("created_at", { ascending: false })
      : { data: [] as Linha[] },
    origemIds.length
      ? supabase
          .from("calendar_appointments")
          .select("id, starts_at")
          .eq("organization_id", orgId)
          .in("id", origemIds)
      : { data: [] as Linha[] },
  ]);

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
  // Entre os funis do cliente, o aberto mais recente tem preferência sobre o já fechado.
  const leadDoContato = new Map<string, Linha>();
  for (const l of (leads.data ?? []) as Linha[]) {
    const k = texto(l.contact_id);
    if (!k) continue;
    const atual = leadDoContato.get(k);
    if (!atual || (atual.status !== "open" && l.status === "open")) leadDoContato.set(k, l);
  }
  const vendaDoContato = por(vendas.data, "contact_id");
  const nomeDe = (x: unknown): string | null => {
    const obj = Array.isArray(x) ? x[0] : x;
    return obj && typeof obj === "object" ? texto((obj as Linha).name) : null;
  };

  const detalhes: DetalheDoCompromisso[] = linhas.map((l) => {
    const tipo = tipoPorId.get(texto(l.event_type_id) ?? "");
    const contatoId = texto(l.contact_id) ?? "";
    const contato = contatoPorId.get(contatoId);
    const lead = leadDoContato.get(contatoId);
    const venda = vendaDoContato.get(contatoId);
    return {
      id: String(l.id),
      tipo: tipo
        ? {
            nome: texto(tipo.name) ?? "",
            cor: texto(tipo.color),
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
      funil: lead ? nomeDe(lead.crm_pipelines) : null,
      etapa: lead ? nomeDe(lead.crm_stages) : null,
      venda: venda
        ? {
            status: String(venda.status),
            valor_cents: Number(venda.amount_cents ?? 0),
            moeda: texto(venda.currency) ?? "BRL",
          }
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
