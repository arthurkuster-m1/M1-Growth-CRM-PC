import type { SupabaseClient } from "@supabase/supabase-js";

import {
  horariosLivresDaOrg,
  type ParametrosDaConsulta,
  type ResultadoDaConsulta,
} from "@/lib/agenda/consulta";

/**
 * A EQUIPE DA AGENDA: quem atende cada tipo, quem está livre num horário e quem pega o
 * compromisso quando a escolha é "qualquer atendente".
 *
 * Cada atendente tem a própria agenda (a jornada dele, o Google dele e os compromissos dele). Um
 * horário "existe" para o tipo se pelo menos um atendente do tipo está livre nele.
 *
 * Funciona antes da migration 0649: sem a tabela, os atendentes do tipo são só o responsável
 * padrão dele (o que era antes).
 */

export interface AtendenteDoTipo {
  user_id: string;
  priority: number;
}

/** Os atendentes ATIVOS de um tipo, da maior prioridade (número menor) para a menor. */
export async function atendentesDoTipo(
  db: SupabaseClient,
  organizationId: string,
  eventTypeId: string,
  responsavelPadrao: string | null,
): Promise<AtendenteDoTipo[]> {
  const { data, error } = await db
    .from("calendar_event_type_attendants")
    .select("user_id, priority")
    .eq("organization_id", organizationId)
    .eq("event_type_id", eventTypeId)
    .eq("is_active", true)
    .order("priority", { ascending: true });
  let lista = (error ? [] : ((data ?? []) as AtendenteDoTipo[])).slice();
  if (lista.length === 0 && responsavelPadrao) lista = [{ user_id: responsavelPadrao, priority: 100 }];
  if (lista.length === 0) return [];
  // Quem saiu da empresa não atende mais.
  const { data: membros } = await db
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", organizationId)
    .in(
      "user_id",
      lista.map((a) => a.user_id),
    )
    .is("revoked_at", null);
  const ativos = new Set(((membros ?? []) as Array<{ user_id: string }>).map((m) => m.user_id));
  return lista.filter((a) => ativos.has(a.user_id));
}

export interface AtendenteLivre extends AtendenteDoTipo {
  /** Compromissos dele no dia (a régua da distribuição). */
  carga: number;
  /** Tem agenda do Google conectada: o compromisso aparece lá. */
  google: boolean;
}

/** Os atendentes do tipo que estão LIVRES no instante, já ordenados (menos carregado, depois prioridade). */
export async function atendentesLivresNoHorario(
  db: SupabaseClient,
  organizationId: string,
  args: {
    eventTypeId: string;
    responsavelPadrao: string | null;
    inicio: Date;
    fim: Date;
    agora: Date;
    ignorarAgendamentoId?: string;
    /** Limites do dia local (para contar a carga). */
    diaDe: Date;
    diaAte: Date;
  },
): Promise<AtendenteLivre[]> {
  const equipe = await atendentesDoTipo(db, organizationId, args.eventTypeId, args.responsavelPadrao);
  const livres: AtendenteLivre[] = [];
  for (const a of equipe) {
    const r = await horariosLivresDaOrg(db, organizationId, {
      eventTypeId: args.eventTypeId,
      ownerUserId: a.user_id,
      de: args.inicio,
      ate: args.fim,
      agora: args.agora,
      ignorarAgendamentoId: args.ignorarAgendamentoId,
    });
    if (!r.ok || !r.publicouHorarios) continue;
    if (!r.slots.some((s) => s.inicio.getTime() === args.inicio.getTime())) continue;
    livres.push({ ...a, carga: 0, google: false });
  }
  if (livres.length === 0) return [];
  const ids = livres.map((l) => l.user_id);
  const [{ data: dia }, { data: conexoes }] = await Promise.all([
    db
      .from("calendar_appointments")
      .select("owner_user_id")
      .eq("organization_id", organizationId)
      .in("owner_user_id", ids)
      .in("status", ["pending", "confirmed", "completed"])
      .gte("starts_at", args.diaDe.toISOString())
      .lt("starts_at", args.diaAte.toISOString()),
    db
      .from("calendar_connections")
      .select("user_id")
      .eq("organization_id", organizationId)
      .in("user_id", ids)
      .eq("status", "healthy")
      .eq("provider", "google_calendar"),
  ]);
  const carga = new Map<string, number>();
  for (const x of (dia ?? []) as Array<{ owner_user_id: string }>)
    carga.set(x.owner_user_id, (carga.get(x.owner_user_id) ?? 0) + 1);
  const comGoogle = new Set(((conexoes ?? []) as Array<{ user_id: string }>).map((c) => c.user_id));
  return livres
    .map((l) => ({ ...l, carga: carga.get(l.user_id) ?? 0, google: comGoogle.has(l.user_id) }))
    .sort((x, y) => x.carga - y.carga || x.priority - y.priority);
}

/** O MENOS carregado no dia entre os livres (desempate: prioridade). `null` se ninguém está livre. */
export function escolherOMenosCarregado(livres: AtendenteLivre[]): AtendenteLivre | null {
  return livres.length === 0
    ? null
    : [...livres].sort((x, y) => x.carga - y.carga || x.priority - y.priority)[0]!;
}

/**
 * Os horários livres do TIPO, para quem não escolheu um atendente (a IA e as integrações): a união
 * dos horários dos atendentes do tipo. Com zero ou um atendente, é exatamente a consulta de sempre.
 * Qualquer falha ao ler a equipe cai na consulta de sempre: a equipe melhora a oferta, não a bloqueia.
 */
export async function horariosLivresDaEquipe(
  db: SupabaseClient,
  organizationId: string,
  params: ParametrosDaConsulta,
): Promise<ResultadoDaConsulta> {
  if (params.ownerUserId) return horariosLivresDaOrg(db, organizationId, params);
  let equipe: AtendenteDoTipo[] = [];
  try {
    const { data: tipo } = await db
      .from("calendar_event_types")
      .select("id, default_owner_user_id")
      .eq("organization_id", organizationId)
      .eq(params.eventTypeSlug ? "slug" : "id", params.eventTypeSlug ?? params.eventTypeId ?? "")
      .maybeSingle();
    if (tipo?.id)
      equipe = await atendentesDoTipo(
        db,
        organizationId,
        tipo.id as string,
        (tipo.default_owner_user_id as string | null) ?? null,
      );
  } catch {
    equipe = [];
  }
  if (equipe.length <= 1) return horariosLivresDaOrg(db, organizationId, params);

  const resultados = await Promise.all(
    equipe.map((a) => horariosLivresDaOrg(db, organizationId, { ...params, ownerUserId: a.user_id })),
  );
  const oks = resultados.filter((r): r is Extract<ResultadoDaConsulta, { ok: true }> => r.ok);
  if (oks.length === 0) return resultados[0]!;
  const porInicio = new Map<number, (typeof oks)[number]["slots"][number]>();
  for (const r of oks) for (const sl of r.slots) if (!porInicio.has(sl.inicio.getTime())) porInicio.set(sl.inicio.getTime(), sl);
  const base = oks[0]!;
  return {
    ...base,
    slots: [...porInicio.entries()].sort((x, y) => x[0] - y[0]).map(([, sl]) => sl),
    publicouHorarios: oks.some((r) => r.publicouHorarios),
    fusoSuposto: oks.every((r) => r.fusoSuposto),
    fontesDefasadas: oks.flatMap((r) => r.fontesDefasadas),
    agendaExternaNuncaLida: oks.every((r) => r.agendaExternaNuncaLida),
    googleCoberturaParcial: oks.some((r) => r.googleCoberturaParcial),
  };
}
