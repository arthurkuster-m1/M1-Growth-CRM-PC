import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardsDaAgencia } from "@/components/agencia/DashboardsDaAgencia";
import { SeletorDeClientes } from "@/components/agencia/SeletorDeClientes";
import { clientesDaAgencia, clientesSelecionados } from "@/lib/agencia/acesso";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Modo agência · Dashboards" };

/** MODO AGÊNCIA · Dashboards de qualquer cliente, com troca rápida entre eles. */
export default async function DashboardsDaAgenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ painel?: string }>;
}) {
  const { painel } = await searchParams;
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const todos = await clientesDaAgencia(user);
  if (todos.length === 0) redirect("/403");
  const escolhidos = await clientesSelecionados(todos);
  const t = (s: string) => traduzir(s, user.idioma);
  const escolhidosIds = escolhidos.length === todos.length ? [] : escolhidos.map((c) => c.id);

  return (
    <div className="flex h-full flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("Modo agência")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Dashboards")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Troque de cliente na hora, sem entrar no perfil de cada um.")}
          </p>
        </div>
        <SeletorDeClientes
          clientes={todos.map((c) => ({ id: c.id, name: c.name, cor: c.cor }))}
          selecionados={escolhidosIds}
        />
      </header>
      <DashboardsDaAgencia
        clientes={escolhidos.map((c) => ({ id: c.id, name: c.name }))}
        inicial={org.orgId}
        painelInicial={painel}
      />
    </div>
  );
}
