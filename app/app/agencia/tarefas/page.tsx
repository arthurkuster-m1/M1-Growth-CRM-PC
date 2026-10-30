import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SeletorDeClientes } from "@/components/agencia/SeletorDeClientes";
import { TarefasDaAgencia } from "@/components/agencia/TarefasDaAgencia";
import { clientesDaAgencia, clientesSelecionados } from "@/lib/agencia/acesso";
import { tarefasDaAgencia } from "@/lib/agencia/tarefas-servidor";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Modo agência · Tarefas" };

/**
 * MODO AGÊNCIA · Tarefas: tudo o que as tarefas da semana dos clientes escolhidos marcam como
 * "da agência", numa lista só, com o cliente de cada uma.
 */
export default async function TarefasDaAgenciaPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const todos = await clientesDaAgencia(user);
  if (todos.length === 0) redirect("/403");
  const escolhidos = await clientesSelecionados(todos);
  const tarefas = await tarefasDaAgencia(escolhidos);
  const t = (s: string) => traduzir(s, user.idioma);
  const escolhidosIds = escolhidos.length === todos.length ? [] : escolhidos.map((c) => c.id);

  return (
    <div className="flex h-full flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("Modo agência")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Tarefas da agência")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("As tarefas da semana de todos os clientes que são da agência, com o cliente de cada uma.")}
          </p>
        </div>
        <SeletorDeClientes
          clientes={todos.map((c) => ({ id: c.id, name: c.name }))}
          selecionados={escolhidosIds}
        />
      </header>
      <TarefasDaAgencia tarefas={tarefas} />
    </div>
  );
}
