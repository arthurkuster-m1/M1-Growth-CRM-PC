/**
 * O QUE O BANCO GUARDA DO GUIA (G2): o perfil do cliente e as marcações à mão. Server-only, lê pelo
 * client de SESSÃO (a RLS vale). O catálogo e o diagnóstico NÃO são guardados: saem do código.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { perfilDaLinha } from "./perfil";
import { prazoDaTarefa } from "./plano";
import type {
  EntradaDoHistorico,
  ItemDoPlano,
  PerfilGravado,
  RegistroManual,
  SituacaoDaTarefa,
} from "./tipos";

export interface GuiaGuardado {
  perfil: PerfilGravado | null;
  manuais: Record<string, RegistroManual>;
  tarefas: Record<string, string>;
  /** Os passos escolhidos para o plano, em qualquer ordem (`visaoDoPlano` ordena). */
  plano: ItemDoPlano[];
  /** `false` quando o banco ainda não recebeu a migration 0703 (o resto do Guia segue funcionando). */
  planoDisponivel: boolean;
}

/** Postgres 42P01 / cache do PostgREST sem a tabela: a migration 0702 ainda não foi aplicada. */
export const faltaMigrationDoGuia = (e: { code?: string; message?: string } | null | undefined) =>
  !!e &&
  (e.code === "42P01" ||
    e.code === "PGRST205" ||
    /guia_perfil|guia_passos|schema cache|does not exist/i.test(e.message ?? ""));

export class GuiaSemMigration extends Error {
  constructor() {
    super("guia_sem_migration");
  }
}

const COLUNAS_BASE = "passo_id,estado,motivo,marcado_em,task_id";
const COLUNAS_DO_PLANO = `${COLUNAS_BASE},no_plano,lado,responsavel_id,prazo,ordem`;

export async function lerGuardado(supabase: SupabaseClient, orgId: string): Promise<GuiaGuardado> {
  const lerPerfil = () =>
    supabase.from("guia_perfil").select("*").eq("organization_id", orgId).maybeSingle();
  const lerPassos = (colunas: string) =>
    supabase.from("guia_passos").select(colunas).eq("organization_id", orgId);

  const [p, completo] = await Promise.all([lerPerfil(), lerPassos(COLUNAS_DO_PLANO)]);
  let m: { data: unknown[] | null; error: { code?: string; message?: string } | null } = completo;
  let planoDisponivel = true;
  // Banco com a 0702 mas sem a 0703: as colunas do plano não existem. Cai para as colunas da G2.
  if (completo.error && faltaMigrationDoGuia(completo.error) && !p.error) {
    const base = await lerPassos(COLUNAS_BASE);
    if (!base.error) {
      m = base;
      planoDisponivel = false;
    }
  }
  const erro = p.error ?? m.error;
  if (erro) {
    if (faltaMigrationDoGuia(erro)) throw new GuiaSemMigration();
    throw erro;
  }
  const manuais: Record<string, RegistroManual> = {};
  const tarefas: Record<string, string> = {};
  const plano: ItemDoPlano[] = [];
  for (const l of (m.data ?? []) as unknown as {
    passo_id: string;
    estado: "feito" | "dispensado" | null;
    motivo: string | null;
    marcado_em: string | null;
    task_id: string | null;
    no_plano?: boolean;
    lado?: "agencia" | "cliente" | null;
    responsavel_id?: string | null;
    prazo?: string | null;
    ordem?: number | string;
  }[]) {
    if (l.no_plano) {
      plano.push({
        passoId: l.passo_id,
        lado: l.lado ?? null,
        responsavelId: l.responsavel_id ?? null,
        prazo: l.prazo ?? null,
        ordem: Number(l.ordem ?? 0),
        tarefaId: l.task_id,
      });
    }
    if (l.estado) {
      manuais[l.passo_id] = {
        estado: l.estado,
        ...(l.motivo ? { motivo: l.motivo } : {}),
        ...(l.marcado_em ? { em: l.marcado_em } : {}),
      };
    }
    if (l.task_id) tarefas[l.passo_id] = l.task_id;
  }
  return {
    perfil: p.data ? perfilDaLinha(p.data as Record<string, unknown>) : null,
    manuais,
    tarefas,
    plano,
    planoDisponivel,
  };
}

/** A situação das tarefas ligadas aos passos (de `crm_tasks`); vazio se a leitura falhar. */
export async function lerTarefasDoPlano(
  supabase: SupabaseClient,
  orgId: string,
  ids: readonly string[],
): Promise<Record<string, SituacaoDaTarefa>> {
  if (ids.length === 0) return {};
  const r = await supabase
    .from("crm_tasks")
    .select("id,status,due_date")
    .eq("organization_id", orgId)
    .in("id", [...ids]);
  if (r.error) return {};
  return Object.fromEntries(
    ((r.data ?? []) as { id: string; status: string; due_date: string | null }[]).map((t) => [
      t.id,
      { status: t.status, prazo: prazoDaTarefa(t.due_date) },
    ]),
  );
}

/** As últimas mudanças do plano e das marcações; vazio se a leitura falhar. */
export async function lerHistorico(
  supabase: SupabaseClient,
  orgId: string,
  limite = 20,
): Promise<EntradaDoHistorico[]> {
  const r = await supabase
    .from("guia_historico")
    .select("id,passo_id,acao,detalhe,feito_por,feito_em")
    .eq("organization_id", orgId)
    .order("feito_em", { ascending: false })
    .limit(limite);
  if (r.error) return [];
  return ((r.data ?? []) as Record<string, unknown>[]).map((l) => ({
    id: l.id as string,
    passoId: (l.passo_id as string | null) ?? null,
    acao: l.acao as EntradaDoHistorico["acao"],
    detalhe: (l.detalhe as Record<string, unknown>) ?? {},
    feitoPor: (l.feito_por as string | null) ?? null,
    feitoEm: l.feito_em as string,
  }));
}

/**
 * Anota no histórico do Guia. Melhor esforço: o histórico nunca derruba a ação que ele descreve
 * (a ação já aconteceu), mas a falha fica no log.
 */
export async function registrarHistorico(
  supabase: SupabaseClient,
  e: {
    orgId: string;
    userId: string;
    acao: EntradaDoHistorico["acao"];
    passoId?: string | null;
    detalhe?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("guia_historico").insert({
    organization_id: e.orgId,
    passo_id: e.passoId ?? null,
    acao: e.acao,
    detalhe: e.detalhe ?? {},
    feito_por: e.userId,
  });
  if (error) {
    const { logger } = await import("@/lib/logger");
    logger.warn("[guia.historico] não foi possível anotar", {
      orgId: e.orgId,
      acao: e.acao,
      erro: error.message,
    });
  }
}
