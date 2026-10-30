import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CronogramaDaAgencia } from "@/components/agencia/CronogramaDaAgencia";
import { SeletorDeClientes } from "@/components/agencia/SeletorDeClientes";
import { clientesDaAgencia, clientesSelecionados } from "@/lib/agencia/acesso";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Modo agência · Cronograma" };

/**
 * MODO AGÊNCIA · Cronograma e tarefas da semana de todos os clientes: o planejamento semanal da
 * agência numa tela só — escolhe o cliente e edita no lugar (metas, ações, tarefas da semana e a
 * autoavaliação da semana).
 */
export default async function CronogramaDaAgenciaPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const todos = await clientesDaAgencia(user);
  if (todos.length === 0) redirect("/403");
  const escolhidos = await clientesSelecionados(todos);
  const t = (s: string) => traduzir(s, user.idioma);
  const escolhidosIds = escolhidos.length === todos.length ? [] : escolhidos.map((c) => c.id);

  return (
    <div className="flex h-full flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("Modo agência")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Cronograma e tarefas da semana")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("O planejamento semanal de todos os clientes: escolha o cliente e edite no lugar.")}
          </p>
        </div>
        <SeletorDeClientes
          clientes={todos.map((c) => ({ id: c.id, name: c.name }))}
          selecionados={escolhidosIds}
        />
      </header>
      <CronogramaDaAgencia
        clientes={escolhidos.map((c) => ({ id: c.id, name: c.name }))}
        inicial={org.orgId}
      />
    </div>
  );
}
