import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NavegacaoDoModoAgencia } from "@/components/agencia/NavegacaoDoModoAgencia";
import { SeletorDeClientes } from "@/components/agencia/SeletorDeClientes";
import { TabelaDeCampanhasDaAgencia } from "@/components/agencia/TabelaDeCampanhasDaAgencia";
import { clientesDaAgencia, clientesSelecionados } from "@/lib/agencia/acesso";
import { campanhasDaAgencia } from "@/lib/agencia/campanhas-servidor";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Modo agência · Campanhas" };

/**
 * MODO AGÊNCIA · Campanhas: as campanhas de TODOS os clientes que a pessoa acessa (ou dos que ela
 * escolheu no seletor), agrupadas por cliente, com o que a gestão olha todo dia: quanto falta para
 * acabar, quantos leads, o CPL e quanto da verba já foi.
 */
export default async function CampanhasDaAgenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ encerradas?: string }>;
}) {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  const todos = await clientesDaAgencia(user);
  if (todos.length === 0) redirect("/403");
  const escolhidos = await clientesSelecionados(todos);
  const { encerradas } = await searchParams;
  const incluirEncerradas = encerradas === "1";
  const grupos = await campanhasDaAgencia(escolhidos, incluirEncerradas);
  const t = (s: string) => traduzir(s, user.idioma);
  const escolhidosIds = escolhidos.length === todos.length ? [] : escolhidos.map((c) => c.id);

  return (
    <div className="flex h-full flex-col gap-5 p-4 sm:p-6">
      <NavegacaoDoModoAgencia />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("Modo agência")}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Campanhas")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("As campanhas de todos os clientes: prazo, leads, CPL e verba.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SeletorDeClientes
            clientes={todos.map((c) => ({ id: c.id, name: c.name }))}
            selecionados={escolhidosIds}
          />
          <a
            href={incluirEncerradas ? "/app/agencia/campanhas" : "/app/agencia/campanhas?encerradas=1"}
            className="inline-flex h-10 items-center rounded-xl border px-3 text-sm font-medium hover:bg-secondary"
          >
            {incluirEncerradas ? t("Ocultar encerradas") : t("Mostrar encerradas")}
          </a>
        </div>
      </header>
      <TabelaDeCampanhasDaAgencia grupos={grupos} />
    </div>
  );
}
