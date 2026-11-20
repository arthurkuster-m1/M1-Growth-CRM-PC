/**
 * O QUE O BANCO GUARDA DO GUIA (G2): o perfil do cliente e as marcações à mão. Server-only, lê pelo
 * client de SESSÃO (a RLS vale). O catálogo e o diagnóstico NÃO são guardados: saem do código.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { perfilDaLinha } from "./perfil";
import type { PerfilGravado, RegistroManual } from "./tipos";

export interface GuiaGuardado {
  perfil: PerfilGravado | null;
  manuais: Record<string, RegistroManual>;
  tarefas: Record<string, string>;
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

export async function lerGuardado(supabase: SupabaseClient, orgId: string): Promise<GuiaGuardado> {
  const [p, m] = await Promise.all([
    supabase.from("guia_perfil").select("*").eq("organization_id", orgId).maybeSingle(),
    supabase
      .from("guia_passos")
      .select("passo_id,estado,motivo,marcado_em,task_id")
      .eq("organization_id", orgId),
  ]);
  const erro = p.error ?? m.error;
  if (erro) {
    if (faltaMigrationDoGuia(erro)) throw new GuiaSemMigration();
    throw erro;
  }
  const manuais: Record<string, RegistroManual> = {};
  const tarefas: Record<string, string> = {};
  for (const l of (m.data ?? []) as {
    passo_id: string;
    estado: "feito" | "dispensado" | null;
    motivo: string | null;
    marcado_em: string | null;
    task_id: string | null;
  }[]) {
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
  };
}
