/**
 * A MIGRAÇÃO DAS REGRAS PARA O MOTOR ÚNICO (Fase 4c — docs/PLANO-MOTOR-UNICO-M1.md).
 *
 * Três operações, todas por organização e todas com o banco injetado (`MigracaoDb`), para a lógica ser testada
 * sem Postgres:
 *
 *  - `simularMigracao`: o ENSAIO. Converte toda regra em memória e diz "converte" ou "não converte, porque…".
 *    NÃO grava nada.
 *  - `migrarRegras`: cria o fluxo `crm_automation` de cada regra que converte e DESLIGA a regra original (que
 *    nunca é apagada). Regra que não converte fica exatamente como está.
 *  - `desfazerMigracao`: pausa o fluxo e religa a regra como estava.
 *
 * ═══ A ORDEM DE GRAVAÇÃO É A GARANTIA ═══
 *
 * Regra e fluxo NUNCA ficam ligados ao mesmo tempo — senão cada WhatsApp, webhook e tarefa sairia em dobro.
 * Por isso, para uma regra que estava ligada: (1) cria o fluxo em RASCUNHO (não dispara nada), (2) DESLIGA a
 * regra e grava o vínculo, (3) só então PUBLICA o fluxo (a publicação o liga). Uma queda entre (2) e (3) deixa
 * os dois desligados — um buraco de eventos, nunca um disparo duplo — e a rodada seguinte RETOMA do ponto
 * onde parou (o vínculo + `migrated_was_active` dizem que falta publicar). Se a publicação falha, a migração
 * da regra é desfeita na hora: melhor a automação antiga ligada que nenhuma.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { publishFollowupFlowVersion } from "./publish";
import type { FlowGraph } from "./graph-schema";
import { regraParaFluxo, type RegraParaConverter } from "./regra-para-fluxo";

export interface RegraGravada extends RegraParaConverter {
  id: string;
  is_active: boolean;
  migrated_to_pointer_id: string | null;
  migrated_was_active: boolean | null;
}

export interface EstadoDoFluxo {
  status: string;
  active_version_id: string | null;
  draft_graph: FlowGraph | null;
}

export type NovoFluxo = {
  nome: string;
  trigger_config: Record<string, unknown>;
  graph: FlowGraph;
};

export interface MigracaoDb {
  listaRegras(orgId: string): Promise<RegraGravada[]>;
  /** `conflito`: já existe fluxo com esse nome na organização. */
  criaFluxo(orgId: string, fluxo: NovoFluxo): Promise<{ id: string } | "conflito">;
  /** Desliga a regra, grava o vínculo e quem mexeu (`system`). */
  vinculaRegra(
    orgId: string,
    ruleId: string,
    v: { pointerId: string; eraAtiva: boolean },
  ): Promise<void>;
  publica(
    orgId: string,
    pointerId: string,
    graph: FlowGraph,
    userId: string,
  ): Promise<{ ok: true } | { ok: false; motivo: string }>;
  estadoDoFluxo(orgId: string, pointerId: string): Promise<EstadoDoFluxo | null>;
  desativaFluxo(orgId: string, pointerId: string): Promise<void>;
  /** Religa (ou não) a regra e solta o vínculo. */
  soltaRegra(orgId: string, ruleId: string, ativa: boolean): Promise<void>;
}

export type ResultadoDaRegra =
  | "converte"
  | "nao_converte"
  | "ja_migrada"
  | "migrada"
  | "migrada_pausada"
  | "retomada"
  | "desfeita_publicacao_falhou";

export interface LinhaDoRelatorio {
  rule_id: string;
  name: string;
  is_active: boolean;
  resultado: ResultadoDaRegra;
  motivo?: string;
  fluxo_id?: string;
}

const MAX_TENTATIVAS_DE_NOME = 6;

export async function simularMigracao(db: MigracaoDb, orgId: string): Promise<LinhaDoRelatorio[]> {
  const relatorio: LinhaDoRelatorio[] = [];
  for (const regra of await db.listaRegras(orgId)) {
    const base = { rule_id: regra.id, name: regra.name, is_active: regra.is_active };
    if (regra.migrated_to_pointer_id) {
      relatorio.push({ ...base, resultado: "ja_migrada", fluxo_id: regra.migrated_to_pointer_id });
      continue;
    }
    const f = regraParaFluxo(regra);
    relatorio.push(
      f.ok
        ? { ...base, resultado: "converte" }
        : { ...base, resultado: "nao_converte", motivo: f.motivo },
    );
  }
  return relatorio;
}

async function criaComNomeLivre(
  db: MigracaoDb,
  orgId: string,
  f: NovoFluxo,
): Promise<string | null> {
  for (let i = 0; i < MAX_TENTATIVAS_DE_NOME; i++) {
    const sufixo = i === 0 ? "" : i === 1 ? " (automação)" : ` (automação ${i})`;
    const r = await db.criaFluxo(orgId, {
      ...f,
      nome: `${f.nome.slice(0, 80 - sufixo.length)}${sufixo}`,
    });
    if (r !== "conflito") return r.id;
  }
  return null;
}

export async function migrarRegras(
  db: MigracaoDb,
  params: { orgId: string; userId: string },
): Promise<LinhaDoRelatorio[]> {
  const { orgId, userId } = params;
  const relatorio: LinhaDoRelatorio[] = [];

  for (const regra of await db.listaRegras(orgId)) {
    const base = { rule_id: regra.id, name: regra.name, is_active: regra.is_active };

    // Já migrada. Se a rodada anterior caiu entre desligar a regra e publicar o fluxo, retoma daqui.
    if (regra.migrated_to_pointer_id) {
      const fluxoId = regra.migrated_to_pointer_id;
      const estado = regra.migrated_was_active ? await db.estadoDoFluxo(orgId, fluxoId) : null;
      if (
        estado &&
        estado.status === "draft" &&
        estado.active_version_id === null &&
        estado.draft_graph
      ) {
        const pub = await db.publica(orgId, fluxoId, estado.draft_graph, userId);
        relatorio.push(
          pub.ok
            ? { ...base, resultado: "retomada", fluxo_id: fluxoId }
            : {
                ...base,
                resultado: "ja_migrada",
                fluxo_id: fluxoId,
                motivo: `retomada_falhou: ${pub.motivo}`,
              },
        );
      } else {
        relatorio.push({ ...base, resultado: "ja_migrada", fluxo_id: fluxoId });
      }
      continue;
    }

    const f = regraParaFluxo(regra);
    if (!f.ok) {
      relatorio.push({ ...base, resultado: "nao_converte", motivo: f.motivo });
      continue;
    }

    // (1) o fluxo nasce em RASCUNHO: não dispara nada.
    const fluxoId = await criaComNomeLivre(db, orgId, f);
    if (!fluxoId) {
      relatorio.push({ ...base, resultado: "nao_converte", motivo: "nome_do_fluxo_em_uso" });
      continue;
    }
    // (2) a regra é DESLIGADA e o vínculo gravado ANTES de o fluxo poder ligar.
    await db.vinculaRegra(orgId, regra.id, { pointerId: fluxoId, eraAtiva: regra.is_active });

    if (!regra.is_active) {
      // Estava pausada: o fluxo fica como rascunho, pausado como ela estava.
      relatorio.push({ ...base, resultado: "migrada_pausada", fluxo_id: fluxoId });
      continue;
    }

    // (3) publicar liga o fluxo.
    const pub = await db.publica(orgId, fluxoId, f.graph, userId);
    if (pub.ok) {
      relatorio.push({ ...base, resultado: "migrada", fluxo_id: fluxoId });
    } else {
      // Melhor a automação antiga ligada que nenhuma.
      await db.desativaFluxo(orgId, fluxoId);
      await db.soltaRegra(orgId, regra.id, true);
      relatorio.push({
        ...base,
        resultado: "desfeita_publicacao_falhou",
        fluxo_id: fluxoId,
        motivo: pub.motivo,
      });
    }
  }
  return relatorio;
}

/** Pausa o fluxo e religa a regra como estava. Primeiro o fluxo, depois a regra: nunca os dois ligados. */
export async function desfazerMigracao(
  db: MigracaoDb,
  params: { orgId: string; ruleId: string },
): Promise<{ ok: true; religada: boolean } | { ok: false; motivo: string }> {
  const regra = (await db.listaRegras(params.orgId)).find((r) => r.id === params.ruleId);
  if (!regra) return { ok: false, motivo: "regra_nao_encontrada" };
  if (!regra.migrated_to_pointer_id) return { ok: false, motivo: "regra_nao_foi_migrada" };
  await db.desativaFluxo(params.orgId, regra.migrated_to_pointer_id);
  const religada = regra.migrated_was_active === true;
  await db.soltaRegra(params.orgId, regra.id, religada);
  return { ok: true, religada };
}

// ─── o adaptador de produção ─────────────────────────────────────────────────

export function createSupabaseMigracaoDb(admin: SupabaseClient): MigracaoDb {
  return {
    async listaRegras(orgId) {
      const { data, error } = await admin
        .from("automation_rules")
        .select(
          "id, name, is_active, trigger_event, trigger_config, conditions, actions, migrated_to_pointer_id, migrated_was_active",
        )
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as RegraGravada[];
    },

    async criaFluxo(orgId, f) {
      const { data, error } = await admin
        .from("followup_flow_pointers")
        .insert({
          organization_id: orgId,
          name: f.nome,
          surface: "crm_automation",
          trigger_config: f.trigger_config,
          draft_graph: f.graph,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") return "conflito";
        throw new Error(error.message);
      }
      return { id: (data as { id: string }).id };
    },

    async vinculaRegra(orgId, ruleId, v) {
      const { error } = await admin
        .from("automation_rules")
        .update({
          is_active: false,
          migrated_to_pointer_id: v.pointerId,
          migrated_was_active: v.eraAtiva,
          last_change_actor_kind: "system",
          last_change_at: new Date().toISOString(),
        })
        .eq("organization_id", orgId)
        .eq("id", ruleId);
      if (error) throw new Error(error.message);
    },

    async publica(orgId, pointerId, graph, userId) {
      const r = await publishFollowupFlowVersion(admin, {
        orgId,
        pointerId,
        graph,
        createdBy: userId,
      });
      return r.ok ? { ok: true } : { ok: false, motivo: r.message };
    },

    async estadoDoFluxo(orgId, pointerId) {
      const { data, error } = await admin
        .from("followup_flow_pointers")
        .select("status, active_version_id, draft_graph")
        .eq("organization_id", orgId)
        .eq("id", pointerId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as EstadoDoFluxo | null) ?? null;
    },

    async desativaFluxo(orgId, pointerId) {
      const { error } = await admin
        .from("followup_flow_pointers")
        .update({ status: "disabled", updated_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .eq("id", pointerId);
      if (error) throw new Error(error.message);
    },

    async soltaRegra(orgId, ruleId, ativa) {
      const { error } = await admin
        .from("automation_rules")
        .update({
          is_active: ativa,
          migrated_to_pointer_id: null,
          migrated_was_active: null,
          last_change_actor_kind: "system",
          last_change_at: new Date().toISOString(),
        })
        .eq("organization_id", orgId)
        .eq("id", ruleId);
      if (error) throw new Error(error.message);
    },
  };
}
