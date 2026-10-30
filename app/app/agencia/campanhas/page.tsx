import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EmbutidoDoCliente } from "@/components/agencia/EmbutidoDoCliente";
import { OrigemDosLeads } from "@/components/agencia/OrigemDosLeads";
import { SeletorDeClientes } from "@/components/agencia/SeletorDeClientes";
import { clientesDaAgencia, clientesSelecionados } from "@/lib/agencia/acesso";
import { origemDosLeads } from "@/lib/agencia/campanhas";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Modo agência · Campanhas" };

/**
 * MODO AGÊNCIA · Campanhas: a MESMA página de Campanhas de uma empresa — com as mesmas visualizações,
 * propriedades, filtros e edição —, uma tabela por cliente, empilhadas. Cada cliente é a página real
 * aberta "dentro" dele (`EmbutidoDoCliente`).
 */
export default async function CampanhasDaAgenciaPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const todos = await clientesDaAgencia(user);
  if (todos.length === 0) redirect("/403");
  const escolhidos = await clientesSelecionados(todos);
  const t = (s: string) => traduzir(s, user.idioma);
  const escolhidosIds = escolhidos.length === todos.length ? [] : escolhidos.map((c) => c.id);
  const { data: orgs } = await createAdminClient()
    .from("organizations")
    .select("id, settings")
    .in("id", escolhidos.map((c) => c.id));
  const origemDe = new Map(
    ((orgs ?? []) as Array<{ id: string; settings: unknown }>).map((o) => [o.id, origemDosLeads(o.settings)]),
  );

  return (
    <div className="flex h-full flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("Modo agência")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Campanhas")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("A página de Campanhas de cada cliente, uma tabela por cliente.")}
          </p>
        </div>
        <SeletorDeClientes
          clientes={todos.map((c) => ({ id: c.id, name: c.name }))}
          selecionados={escolhidosIds}
        />
      </header>
      {escolhidos.map((c) => (
        <section key={c.id} aria-label={c.name} className="grid gap-2">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{c.name}</h2>
            <OrigemDosLeads clienteId={c.id} nome={c.name} origem={origemDe.get(c.id) ?? "crm"} />
          </header>
          <EmbutidoDoCliente caminho="/app/marketing/geracao-de-demanda" clienteId={c.id} titulo={`${t("Campanhas")} · ${c.name}`} />
        </section>
      ))}
    </div>
  );
}
