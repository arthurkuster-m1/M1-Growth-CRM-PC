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
  const agora = new Date();
  const ate = new Date(agora.getTime() + 7 * 86_400_000).toISOString();
  const nomeDe = new Map(escolhidos.map((c) => [c.id, c.name]));
  const [{ data: camps }, { data: leads }, { data: agenda }, { data: avisos }] = await Promise.all([
    db
      .from("demand_campaigns")
      .select("organization_id")
      .in("organization_id", ids)
      .eq("status", "ativa")
      .limit(2000),
    db
      .from("crm_leads")
      .select("organization_id")
      .in("organization_id", ids)
      .eq("status", "open")
      .limit(20000),
    db
      .from("calendar_appointments")
      .select("id, organization_id, title, starts_at, ends_at, status, contacts(name)")
      .in("organization_id", ids)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", new Date(agora.getTime() - 3 * 3_600_000).toISOString())
      .lte("starts_at", ate)
      .order("starts_at", { ascending: true })
      .limit(100),
    db
      .from("agent_inbox_items")
      .select("id, organization_id, title, body, severity, created_at")
      .in("organization_id", ids)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const compromissos = (
    (agenda ?? []) as unknown as Array<{
      id: string;
      organization_id: string;
      title: string;
      starts_at: string;
      ends_at: string;
      status: string;
      contacts: { name: string } | { name: string }[] | null;
    }>
  ).map((a) => ({
    id: a.id,
    titulo: a.title,
    inicio: a.starts_at,
    fim: a.ends_at,
    status: a.status,
    cliente: nomeDe.get(a.organization_id) ?? "",
    contato: (Array.isArray(a.contacts) ? a.contacts[0]?.name : a.contacts?.name) ?? "",
  }));
  const alertas = (
    (avisos ?? []) as Array<{
      id: string;
      organization_id: string;
      title: string;
      body: string | null;
      severity: string | null;
      created_at: string;
    }>
  ).map((a) => ({
    id: a.id,
    titulo: a.title,
    corpo: a.body ?? "",
    severidade: a.severity ?? "info",
    cliente: nomeDe.get(a.organization_id) ?? "",
    em: a.created_at,
  }));
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
    <InicioDaAgencia
      nome={primeiroNome}
      agoraIso={agora.toISOString()}
      tarefas={tarefas}
      clientes={clientes}
      compromissos={compromissos}
      alertas={alertas}
    />
  );
}
