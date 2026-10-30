/**
 * GET /api/v1/dashboards/atendimento?de=&ate= — os números do dashboard de Atendimento: conversas
 * iniciadas e respondidas, tempo da 1ª resposta (com o relógio do horário de atendimento), SLA
 * (resposta em até 1 h do início do horário), leads parados há +24 h e +7 dias, por atendente,
 * quando chegam as conversas e o tempo geral.
 * PUT — grava o horário de atendimento da empresa (manager+).
 *
 * Toda a empresa lê (viewer+) os agregados; a lista nominal de leads esperando é de agent+.
 * Lê com o cliente da empresa filtrado por organização.
 */
import { nomeDoContato } from "@/lib/contacts/rotulo-do-contato";
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { roleAtLeast } from "@/lib/auth/types";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  PRAZO_EM_MINUTOS,
  dentroDoHorario,
  lerHorario,
  minutosAteResponder,
} from "@/lib/dashboards/atendimento";
import { media, mediana } from "@/lib/dashboards/business";
import { periodoAnterior } from "@/lib/dashboards/trafego";
import { chaveDoDia, inicioDoDia, partesNoFuso, somarDias } from "@/lib/inicio/datas";
import { createAdminClient } from "@/lib/supabase/admin";
import { clienteDaRequisicao, ehRecusa } from "@/lib/agencia/cliente-da-requisicao";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const LIMITE = 20000;

interface Conversa {
  id: string;
  contact_id: string | null;
  channel: string | null;
  status: string | null;
  assigned_to_user_id: string | null;
  assigned_to_user_name: string | null;
  assignee_kind: string | null;
  created_at: string;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_handoff_at: string | null;
  service_started_at: string | null;
  service_closed_at: string | null;
  is_group: boolean | null;
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "metrics" });
  if (!authz.ok) return authz.response;
  const q = req.nextUrl.searchParams;
  const de = dia.safeParse(q.get("de"));
  const ate = dia.safeParse(q.get("ate"));
  if (!de.success || !ate.success || de.data > ate.data) {
    return fail("validation_failed", "Período inválido.", 422, { requestId });
  }
  // MODO AGÊNCIA: os dados de outro cliente (reconferido no servidor).
  const outro = await clienteDaRequisicao(authz.user, authz.org.orgId, false, (x) => x, requestId);
  if (outro && ehRecusa(outro)) return outro.response;
  const orgId = outro?.orgId ?? authz.org.orgId;
  const papelNoCliente = outro ? (outro.role === "plataforma" ? "admin" : outro.role) : authz.org.role;
  const podeVerNomes = roleAtLeast(papelNoCliente, "agent");
  const supabase = outro?.supabase ?? (await createClient());

  const { data: org } = await supabase
    .from("organizations")
    .select("timezone, settings")
    .eq("id", orgId)
    .maybeSingle();
  const fuso = (org?.timezone as string | null) || "America/Sao_Paulo";
  const horario = lerHorario(
    ((org?.settings ?? {}) as Record<string, unknown>).horario_de_atendimento,
  );
  const ant = periodoAnterior(de.data, ate.data);
  const agora = new Date();
  const desde = inicioDoDia(ant.de, fuso).toISOString();
  const ateInstante = inicioDoDia(somarDias(ate.data, 1), fuso).toISOString();
  const inicioAtual = inicioDoDia(de.data, fuso).getTime();

  const { data: conversasBrutas } = await supabase
    .from("conversations")
    .select(
      "id, contact_id, channel, status, assigned_to_user_id, assigned_to_user_name, assignee_kind, created_at, last_inbound_at, last_outbound_at, last_handoff_at, service_started_at, service_closed_at, is_group",
    )
    .eq("organization_id", orgId)
    .gte("created_at", desde)
    .lt("created_at", ateInstante)
    .limit(LIMITE);
  const todas = ((conversasBrutas ?? []) as Conversa[]).filter((c) => c.is_group !== true);

  // A 1ª mensagem do lead e a 1ª resposta (qualquer saída depois dela) de cada conversa.
  const ids = todas.map((c) => c.id);
  const primeiraEntrada = new Map<string, Date>();
  const primeiraSaida = new Map<string, Date>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase
      .from("messages")
      .select("conversation_id, direction, created_at")
      .eq("organization_id", orgId)
      .in("conversation_id", ids.slice(i, i + 150))
      .order("created_at", { ascending: true })
      .limit(LIMITE);
    for (const m of (data ?? []) as Array<{
      conversation_id: string;
      direction: string;
      created_at: string;
    }>) {
      const t = new Date(m.created_at);
      if (m.direction === "inbound") {
        if (!primeiraEntrada.has(m.conversation_id)) primeiraEntrada.set(m.conversation_id, t);
      } else if (m.direction === "outbound") {
        const entrada = primeiraEntrada.get(m.conversation_id);
        if (entrada && t >= entrada && !primeiraSaida.has(m.conversation_id)) {
          primeiraSaida.set(m.conversation_id, t);
        }
      }
    }
  }

  const resumir = (lista: Conversa[]) => {
    const tempos: number[] = [];
    let respondidas = 0;
    let noPrazo = 0;
    let comResposta = 0;
    let foraDoHorario = 0;
    let resolvidas = 0;
    const duracoes: number[] = [];
    let ia = 0;
    let humano = 0;
    for (const c of lista) {
      const entrada = primeiraEntrada.get(c.id);
      const saida = primeiraSaida.get(c.id);
      if (entrada && !dentroDoHorario(entrada, horario, fuso)) foraDoHorario += 1;
      if (saida) respondidas += 1;
      if (entrada && saida) {
        const min = minutosAteResponder(entrada, saida, horario, fuso);
        tempos.push(min);
        comResposta += 1;
        if (min <= PRAZO_EM_MINUTOS) noPrazo += 1;
      }
      if (c.service_closed_at && c.service_started_at) {
        resolvidas += 1;
        duracoes.push(
          (new Date(c.service_closed_at).getTime() - new Date(c.service_started_at).getTime()) /
            60_000,
        );
      }
      if (c.assignee_kind === "ai") ia += 1;
      if (c.last_handoff_at) humano += 1;
    }
    return {
      iniciadas: lista.length,
      respondidas,
      tempoMedio: media(tempos),
      tempoMediana: mediana(tempos),
      noPrazoPct: comResposta > 0 ? (noPrazo / comResposta) * 100 : null,
      foraDoHorarioPct: lista.length > 0 ? (foraDoHorario / lista.length) * 100 : null,
      duracaoMedia: media(duracoes),
      resolvidas,
      ia,
      passouParaHumano: humano,
    };
  };
  const doPeriodo = todas.filter((c) => new Date(c.created_at).getTime() >= inicioAtual);
  const doAnterior = todas.filter((c) => new Date(c.created_at).getTime() < inicioAtual);
  const atual = resumir(doPeriodo);
  const anterior = resumir(doAnterior);

  // Por atendente (a IA vira uma linha própria).
  const porAtendente = new Map<
    string,
    { nome: string; conversas: Conversa[] }
  >();
  for (const c of doPeriodo) {
    const chave = c.assignee_kind === "ai" ? "ia" : (c.assigned_to_user_id ?? "sem");
    const nome =
      c.assignee_kind === "ai"
        ? "Atendente IA"
        : (c.assigned_to_user_name ?? (c.assigned_to_user_id ? "Atendente" : "Sem responsável"));
    const x = porAtendente.get(chave) ?? { nome, conversas: [] };
    x.conversas.push(c);
    porAtendente.set(chave, x);
  }
  // Resultado por atendente: negócios ganhos e perdidos que ele fechou no período (o dono do negócio).
  // Pela sessão: a RLS recorta o que cada papel pode ver, como nas demais leituras desta rota.
  const { data: fechados } = await supabase
    .from("crm_leads")
    .select("owner_user_id, status")
    .eq("organization_id", orgId)
    .in("status", ["won", "lost"])
    .gte("closed_at", new Date(inicioAtual).toISOString())
    .lt("closed_at", ateInstante)
    .limit(LIMITE);
  const ganhosPor = new Map<string, number>();
  const perdidosPor = new Map<string, number>();
  for (const l of (fechados ?? []) as Array<{ owner_user_id: string | null; status: string }>) {
    if (!l.owner_user_id) continue;
    const mapa = l.status === "won" ? ganhosPor : perdidosPor;
    mapa.set(l.owner_user_id, (mapa.get(l.owner_user_id) ?? 0) + 1);
  }
  const atendentes = [...porAtendente.entries()]
    .map(([chave, x]) => {
      const r = resumir(x.conversas);
      const pessoa = chave !== "ia" && chave !== "sem";
      return {
        nome: x.nome,
        conversas: r.iniciadas,
        respondidas: r.respondidas,
        tempoMedio: r.tempoMedio,
        noPrazoPct: r.noPrazoPct,
        // A IA e "sem responsável" não são donos de negócio: ficam sem o par ganhos/perdidos.
        ganhos: pessoa ? (ganhosPor.get(chave) ?? 0) : null,
        perdidos: pessoa ? (perdidosPor.get(chave) ?? 0) : null,
      };
    })
    .sort((a, b) => b.conversas - a.conversas);

  // Quando chegam (dia da semana × hora 08–19), pelas primeiras mensagens do lead.
  const calor = Array.from({ length: 7 }, () => Array.from({ length: 12 }, () => 0));
  for (const c of doPeriodo) {
    const t = primeiraEntrada.get(c.id) ?? new Date(c.created_at);
    const p = partesNoFuso(t, fuso);
    const diaSemana = new Date(`${chaveDoDia(t, fuso)}T12:00:00Z`).getUTCDay();
    if (p.hora >= 8 && p.hora < 20) calor[diaSemana]![p.hora - 8]! += 1;
  }

  // Esperando resposta agora: o lead falou por último e ninguém respondeu (conversas abertas).
  const { data: abertasBrutas } = await supabase
    .from("conversations")
    .select(
      "id, contact_id, channel, status, assigned_to_user_id, assigned_to_user_name, assignee_kind, created_at, last_inbound_at, last_outbound_at, is_group, contacts(name, display_name, phone_number)",
    )
    .eq("organization_id", orgId)
    .not("last_inbound_at", "is", null)
    .limit(LIMITE);
  const esperando = ((abertasBrutas ?? []) as unknown as Array<
    Conversa & { contacts: { name?: string; display_name?: string; phone_number?: string } | null }
  >)
    .filter((c) => c.is_group !== true)
    .filter((c) => !["closed", "resolved", "archived"].includes(c.status ?? ""))
    .filter((c) => {
      const entrada = new Date(c.last_inbound_at!).getTime();
      const saida = c.last_outbound_at ? new Date(c.last_outbound_at).getTime() : 0;
      return entrada > saida;
    })
    .map((c) => ({
      ...c,
      horas: (agora.getTime() - new Date(c.last_inbound_at!).getTime()) / 3_600_000,
    }));
  const maisDe24h = esperando.filter((c) => c.horas >= 24);
  const maisDe7d = esperando.filter((c) => c.horas >= 24 * 7);
  const lista = podeVerNomes
    ? maisDe24h
        .sort((a, b) => b.horas - a.horas)
        .slice(0, 20)
        .map((c) => ({
          conversa_id: c.id,
          contato_id: c.contact_id,
          nome:
            nomeDoContato(c.contacts) ?? c.contacts?.phone_number ?? "—",
          canal: c.channel ?? "—",
          responsavel:
            c.assignee_kind === "ai" ? "Atendente IA" : (c.assigned_to_user_name ?? "Sem responsável"),
          horas: Math.round(c.horas),
        }))
    : [];

  return ok(
    {
      de: de.data,
      ate: ate.data,
      horario,
      atual,
      anterior,
      atendentes,
      calor,
      parados24h: maisDe24h.length,
      parados7d: maisDe7d.length,
      lista,
      podeEditarHorario: roleAtLeast(papelNoCliente, "manager"),
    },
    { requestId },
  );
}

const horarioSchema = z.object({
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  dias: z.array(z.number().int().min(0).max(6)).min(1).max(7),
});

export async function PUT(req: NextRequest): Promise<Response> {
  const negado = await requireSupportWrite();
  if (negado) return negado;
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "metrics" });
  if (!authz.ok) return authz.response;
  // MODO AGÊNCIA: a empresa de outro cliente (reconferida no servidor).
  const outro = await clienteDaRequisicao(authz.user, authz.org.orgId, true, (x) => x, requestId);
  if (outro && ehRecusa(outro)) return outro.response;
  const orgAlvo = outro?.orgId ?? authz.org.orgId;
  const corpo = horarioSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success || corpo.data.inicio >= corpo.data.fim) {
    return fail("validation_failed", "Horário inválido.", 422, { requestId });
  }
  // `organizations` só aceita escrita do cliente admin (a RLS recusa o membro em silêncio).
  const admin = createAdminClient();
  const { data: atual } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", orgAlvo)
    .maybeSingle();
  const settings = (atual?.settings ?? {}) as Record<string, unknown>;
  const { error } = await admin
    .from("organizations")
    .update({
      settings: {
        ...settings,
        horario_de_atendimento: {
          inicio: corpo.data.inicio,
          fim: corpo.data.fim,
          dias: [...new Set(corpo.data.dias)].sort(),
        },
      },
    })
    .eq("id", orgAlvo);
  if (error) return fail("internal_error", "Erro ao salvar o horário.", 500, { requestId });
  return ok({ salvo: true }, { requestId });
}
