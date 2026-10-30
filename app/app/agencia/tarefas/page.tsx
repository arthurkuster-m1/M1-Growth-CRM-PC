import { TagDoCliente } from "@/components/agencia/TagDoCliente";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EmbutidoDoCliente } from "@/components/agencia/EmbutidoDoCliente";
import { SeletorDeClientes } from "@/components/agencia/SeletorDeClientes";
import { clientesDaAgencia, clientesSelecionados } from "@/lib/agencia/acesso";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Modo agência · Tarefas" };

/**
 * MODO AGÊNCIA · Tarefas: a MESMA página de Tarefas de uma empresa — tabela, quadro, linha do tempo,
 * calendário, propriedades, filtros e edição —, uma tabela por cliente, empilhadas.
 */
export default async function TarefasDaAgenciaPage() {
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
          <h1 className="text-2xl font-semibold tracking-tight">{t("Tarefas")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("A página de Tarefas de cada cliente, uma tabela por cliente.")}
          </p>
        </div>
        <SeletorDeClientes
          clientes={todos.map((c) => ({ id: c.id, name: c.name, cor: c.cor }))}
          selecionados={escolhidosIds}
        />
      </header>
      {escolhidos.map((c) => (
        <section key={c.id} aria-label={c.name} className="grid gap-2">
          <h2><TagDoCliente nome={c.name} cor={c.cor} grande /></h2>
          <EmbutidoDoCliente caminho="/app/tarefas" clienteId={c.id} titulo={`${t("Tarefas")} · ${c.name}`} />
        </section>
      ))}
    </div>
  );
}
