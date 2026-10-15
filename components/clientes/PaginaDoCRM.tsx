"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ClientesCRM } from "@/components/clientes/ClientesCRM";
import { VendasCRM } from "@/components/vendas/VendasCRM";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { ROLE_RANK } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const VISOES = ["clientes", "oportunidades", "vendas"] as const;
type Visao = (typeof VISOES)[number];

/**
 * A página CRM: três visões do mesmo negócio.
 *  - Clientes: as pessoas (o lead é o cliente), com o ciclo de vida.
 *  - Oportunidades: os negócios de cada funil/campanha, em quadro ou lista.
 *  - Vendas: os pagamentos e as parcelas.
 * Cada visão tem as próprias visualizações salvas, filtros e colunas (o motor das Tarefas).
 */
export function PaginaDoCRM() {
  const t = useT();
  const caminho = usePathname();
  const parametros = useSearchParams();
  const org = useActiveOrg();
  const role = org?.role ?? "viewer";
  const podeVerVendas = ROLE_RANK[role] >= ROLE_RANK.agent;

  const pedida = parametros.get("visao");
  const visao: Visao =
    VISOES.find((v) => v === pedida && (v !== "vendas" || podeVerVendas)) ?? "clientes";

  const abas: Array<{ id: Visao; rotulo: string }> = [
    { id: "clientes", rotulo: t("Clientes") },
    { id: "oportunidades", rotulo: t("Oportunidades") },
    ...(podeVerVendas ? [{ id: "vendas" as const, rotulo: t("Vendas") }] : []),
  ];

  return (
    <div className="grid grid-cols-1 gap-4">
      <nav
        role="tablist"
        aria-label={t("CRM")}
        className="flex items-center gap-1 border-b [scrollbar-width:none] overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        <span className="mr-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          {t("CRM")}
        </span>
        {abas.map((a) => (
          <Link
            key={a.id}
            role="tab"
            aria-selected={visao === a.id}
            // Cada visão tem os próprios funis e abas: trocar de visão limpa o resto da URL.
            href={a.id === "clientes" ? caminho : `${caminho}?visao=${a.id}`}
            replace
            scroll={false}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              visao === a.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>

      <Suspense fallback={null}>
        {visao === "clientes" ? <ClientesCRM key="clientes" modo="clientes" /> : null}
        {visao === "oportunidades" ? <ClientesCRM key="oportunidades" modo="oportunidades" /> : null}
        {visao === "vendas" ? <VendasCRM key="vendas" /> : null}
      </Suspense>
    </div>
  );
}
