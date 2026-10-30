import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { InicioDaAgencia } from "@/components/agencia/InicioDaAgencia";
import { clientesDaAgencia, clientesSelecionados } from "@/lib/agencia/acesso";
import { tarefasDaAgencia } from "@/lib/agencia/tarefas-servidor";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Modo agência · Início" };

/**
 * MODO AGÊNCIA · Início: igual ao Início de uma empresa, mas juntando as tarefas de todos os
 * clientes (as marcadas "da agência" e as atribuídas a esta pessoa), com o cliente de cada uma.
 */
export default async function InicioDaAgenciaPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const todos = await clientesDaAgencia(user);
  if (todos.length === 0) redirect("/403");
  const escolhidos = await clientesSelecionados(todos);
  const tarefas = await tarefasDaAgencia(escolhidos, { minhas: user.id });

  const db = createAdminClient();
  const ids = escolhidos.map((c) => c.id);
  const [{ data: camps }, { data: leads }] = await Promise.all([
    db.from("demand_campaigns").select("organization_id").in("organization_id", ids).eq("status", "ativa").limit(2000),
    db.from("crm_leads").select("organization_id").in("organization_id", ids).eq("status", "open").limit(20000),
  ]);
  const conta = (linhas: Array<{ organization_id: string }> | null, id: string) =>
    (linhas ?? []).filter((l) => l.organization_id === id).length;
  const clientes = escolhidos.map((c) => ({
    id: c.id,
    nome: c.name,
    campanhasAtivas: conta(camps, c.id),
    leads: conta(leads, c.id),
  }));
  const primeiroNome = user.full_name?.trim().split(/\s+/)[0] || user.email.split("@")[0] || "";

  return (
    <InicioDaAgencia nome={primeiroNome} agoraIso={new Date().toISOString()} tarefas={tarefas} clientes={clientes} />
  );
}
