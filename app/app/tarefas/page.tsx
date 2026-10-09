import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";

import { TarefasMotorClient } from "./_components/TarefasMotorClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tarefas" };

const FUSO_PADRAO = "America/Sao_Paulo";

/**
 * TAREFAS (tabela estilo Notion) — o primeiro uso do motor de tabelas.
 *
 * É a tela de Tarefas do produto (a tabela `crm_tasks`). A tela antiga, de dentro do CRM
 * (`/app/tasks`), foi apagada: o endereço antigo redireciona para cá (`next.config.ts`).
 *
 * Quem pode o quê, como na tela antiga: `viewer` VÊ; `agent` cria, edita, reordena e
 * apaga; `manager` também edita as opções de status. A tela esconde o que a pessoa não
 * pode fazer — mas quem recusa de verdade são as rotas e as policies do banco.
 */
export default async function TarefasPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  const plataforma = user.is_platform_admin && !user.support;
  const podeEditar = plataforma || ROLE_RANK[activeOrg.role] >= ROLE_RANK.agent;
  const podeConfigurar = plataforma || ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;

  return (
    <TarefasMotorClient
      fuso={user.timezone || FUSO_PADRAO}
      usuarioId={user.id}
      podeEditar={podeEditar}
      podeConfigurar={podeConfigurar}
      agoraIso={new Date().toISOString()}
    />
  );
}
