/**
 * COLETAR OS SINAIS — a única peça do Guia que LÊ o banco. Devolve números e datas (nunca dado
 * pessoal de lead) para o diagnóstico puro decidir.
 *
 * Quem chama passa o client de SESSÃO (a RLS vale) e a org ativa já validada por `requireRole`
 * — a org NUNCA vem do corpo da requisição. Cada grupo de sinais é uma leitura independente:
 * se uma falha (tabela ausente, migration ainda não aplicada na VPS), só os passos que dependem
 * dela viram "não consegui verificar" e o resto do Guia segue funcionando.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Leitura, Sinais } from "./tipos";

type Cliente = SupabaseClient;

const MS_DIA = 86_400_000;

/** Erro do PostgREST/Postgres que significa "falta uma atualização do banco" (tabela ou coluna ausente). */
const faltaAtualizacao = (e: { code?: string; message?: string }) =>
  e.code === "42P01" ||
  e.code === "42703" ||
  e.code === "PGRST204" ||
  e.code === "PGRST205" ||
  /schema cache|does not exist/i.test(e.message ?? "");

const MOTIVO_SEM_ATUALIZACAO = "o banco ainda não recebeu uma atualização necessária para ler isto";
const MOTIVO_ERRO = "não foi possível ler esta informação agora";

/** Roda uma leitura; qualquer falha vira `{ ok: false, motivo }` — nunca derruba as outras. */
async function ler<T>(f: () => Promise<T>): Promise<Leitura<T>> {
  try {
    return { ok: true, valor: await f() };
  } catch (e) {
    const erro = e as { code?: string; message?: string };
    return { ok: false, motivo: faltaAtualizacao(erro) ? MOTIVO_SEM_ATUALIZACAO : MOTIVO_ERRO };
  }
}

/** Desembrulha `{ data, error }` do Supabase, lançando o erro (o `ler` o traduz). */
function dados<T>(r: { data: T | null; error: { code?: string; message?: string } | null }): T {
  if (r.error) throw r.error;
  return (r.data ?? ([] as unknown)) as T;
}

function contagem(r: {
  count: number | null;
  error: { code?: string; message?: string } | null;
}): number {
  if (r.error) throw r.error;
  return r.count ?? 0;
}

const desde = (dias: number) => new Date(Date.now() - dias * MS_DIA).toISOString();

const maisRecente = (...datas: (string | null | undefined)[]): string | null =>
  datas
    .filter((d): d is string => !!d)
    .sort()
    .at(-1) ?? null;

export async function coletarSinais(supabase: Cliente, orgId: string): Promise<Sinais> {
  const org = (tabela: string) => supabase.from(tabela);

  const [
    empresa,
    equipe,
    paginas,
    metaCapi,
    landingPages,
    campanhas,
    criativos,
    abordagens,
    leads,
    vendas,
    whatsapp,
    funil,
    proximaAcaoPorEtapa,
    agenda,
    googleAgenda,
    antiNoShow,
    respostasRapidas,
    cronograma,
    autoavaliacao,
  ] = await Promise.all([
    ler(async () => {
      const r = await supabase
        .from("organizations")
        .select("display_name,timezone")
        .eq("id", orgId)
        .maybeSingle();
      if (r.error) throw r.error;
      return {
        temNome: !!r.data?.display_name?.trim(),
        temFuso: !!r.data?.timezone?.trim(),
      };
    }),

    ler(async () => ({
      membrosAtivos: contagem(
        await org("user_organizations")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .not("accepted_at", "is", null)
          .is("revoked_at", null),
      ),
    })),

    ler(async () => {
      const linhas = dados<{ module_key: string; published_at: string | null }[]>(
        await org("marketing_pages")
          .select("module_key,published_at")
          .eq("organization_id", orgId)
          .limit(2000),
      );
      return Object.fromEntries(linhas.map((l) => [l.module_key, l.published_at]));
    }),

    // Só presença e dataset: o token cifrado NUNCA é lido, só contado por filtro.
    ler(async () => {
      const todas = contagem(
        await org("ad_platform_connections")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("platform", "meta_ads"),
      );
      const comToken = dados<{ enabled: boolean; dataset_id: string | null }[]>(
        await org("ad_platform_connections")
          .select("enabled,dataset_id")
          .eq("organization_id", orgId)
          .eq("platform", "meta_ads")
          .not("access_token_encrypted", "is", null),
      );
      return {
        existe: todas > 0,
        ativo: comToken.some((c) => c.enabled),
        temDataset: comToken.some((c) => !!c.dataset_id?.trim()),
      };
    }),

    ler(async () => {
      const lps = dados<{ url: string }[]>(
        await org("demand_campaign_landing_pages")
          .select("url")
          .eq("organization_id", orgId)
          .limit(1000),
      );
      return { total: lps.length, comUrl: lps.filter((l) => l.url.trim() !== "").length };
    }),

    ler(async () => {
      const cs = dados<{ status: string; goal_leads: number | null; goal_cpl: number | null }[]>(
        await org("demand_campaigns")
          .select("status,goal_leads,goal_cpl")
          .eq("organization_id", orgId)
          .limit(1000),
      );
      const ativas = cs.filter((c) => c.status === "ativa");
      const ultimo = dados<{ day: string }[]>(
        await org("demand_campaign_days")
          .select("day")
          .eq("organization_id", orgId)
          .eq("source", "meta")
          .order("day", { ascending: false })
          .limit(1),
      );
      return {
        total: cs.length,
        ativas: ativas.length,
        ativasComMeta: ativas.filter((c) => c.goal_leads !== null && c.goal_cpl !== null).length,
        ultimoDiaDaMeta: ultimo[0]?.day ?? null,
      };
    }),

    ler(async () => {
      const r = await org("demand_campaign_creatives")
        .select("created_at", { count: "exact" })
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(1);
      const total = contagem(r);
      const ultimo = ((r.data ?? []) as { created_at: string }[])[0]?.created_at ?? null;
      return { total, ultimoCriadoEm: ultimo };
    }),

    ler(async () => ({
      total: contagem(
        await org("demand_campaign_approaches")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId),
      ),
    })),

    ler(async () => ({
      deCampanhaEm30Dias: contagem(
        await org("crm_leads")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .not("demand_campaign_id", "is", null)
          .gte("created_at", desde(30)),
      ),
    })),

    ler(async () => ({
      em90Dias: contagem(
        await org("crm_sales")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .in("status", ["comprometida", "concluida"])
          .gte("created_at", desde(90)),
      ),
    })),

    ler(async () => ({
      conectados: contagem(
        await org("channel_sessions")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "WORKING")
          .is("archived_at", null),
      ),
    })),

    ler(async () => {
      const pipelines = dados<{ id: string }[]>(
        await org("crm_pipelines")
          .select("id")
          .eq("organization_id", orgId)
          .eq("is_archived", false),
      );
      const etapas = dados<{ pipeline_id: string; is_won: boolean; is_lost: boolean }[]>(
        await org("crm_stages")
          .select("pipeline_id,is_won,is_lost")
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .limit(5000),
      );
      const ativos = new Set(pipelines.map((p) => p.id));
      const ganhou = new Set(
        etapas.filter((e) => e.is_won && ativos.has(e.pipeline_id)).map((e) => e.pipeline_id),
      );
      const perdeu = new Set(
        etapas.filter((e) => e.is_lost && ativos.has(e.pipeline_id)).map((e) => e.pipeline_id),
      );
      return { comGanhouEPerdeu: [...ganhou].filter((id) => perdeu.has(id)).length };
    }),

    // A coluna vem da migration 0692: sem ela a leitura falha e o passo vira "não consegui verificar".
    ler(async () => {
      const etapas = dados<{ proxima_acao_padrao: string | null }[]>(
        await org("crm_stages")
          .select("proxima_acao_padrao")
          .eq("organization_id", orgId)
          .eq("is_archived", false)
          .limit(5000),
      );
      return { etapasComPasso: etapas.filter((e) => !!e.proxima_acao_padrao?.trim()).length };
    }),

    ler(async () => {
      const tipos = contagem(
        await org("calendar_event_types")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId),
      );
      const horarios = dados<{ schedule: Record<string, unknown> | null }[]>(
        await org("attendant_availability")
          .select("schedule")
          .eq("organization_id", orgId)
          .limit(500),
      );
      return {
        tipos,
        atendentesComHorario: horarios.filter(
          (h) => h.schedule && Object.keys(h.schedule).length > 0,
        ).length,
      };
    }),

    ler(async () => ({
      conectados: contagem(
        await org("calendar_connections")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .in("status", ["healthy", "rate_limited"]),
      ),
    })),

    ler(async () => ({
      fluxos: contagem(
        await org("agenda_noshow_flows")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId),
      ),
    })),

    ler(async () => ({
      total: contagem(
        await org("message_templates")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId),
      ),
    })),

    ler(async () => {
      const itens = await org("marketing_cronograma_itens")
        .select("updated_at", { count: "exact" })
        .eq("organization_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(1);
      const total = contagem(itens);
      const ultimoItem = ((itens.data ?? []) as { updated_at: string }[])[0]?.updated_at ?? null;
      // As tarefas ligadas às ações contam como atividade; sem a migration 0693 só os itens valem.
      let ultimaTarefa: string | null = null;
      const tarefas = await org("crm_tasks")
        .select("updated_at")
        .eq("organization_id", orgId)
        .not("cronograma_item_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (!tarefas.error)
        ultimaTarefa = ((tarefas.data ?? []) as { updated_at: string }[])[0]?.updated_at ?? null;
      return { itens: total, ultimaAtividadeEm: maisRecente(ultimoItem, ultimaTarefa) };
    }),

    ler(async () => {
      const r = dados<{ updated_at: string }[]>(
        await org("marketing_cronograma_autoavaliacoes")
          .select("updated_at")
          .eq("organization_id", orgId)
          .order("updated_at", { ascending: false })
          .limit(1),
      );
      return { ultimaEm: r[0]?.updated_at ?? null };
    }),
  ]);

  return {
    empresa,
    equipe,
    paginas,
    metaCapi,
    landingPages,
    campanhas,
    criativos,
    abordagens,
    leads,
    vendas,
    whatsapp,
    funil,
    proximaAcaoPorEtapa,
    agenda,
    googleAgenda,
    antiNoShow,
    respostasRapidas,
    cronograma,
    autoavaliacao,
  };
}
