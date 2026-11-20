"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { FinancasProvider, useFinancas } from "@/lib/financas/dados";
import { Plus, Warning } from "@/lib/ui/icons";

import { Badge, Button, Page, Skeleton, ToastProvider } from "./kit";

const ABAS = [
  { caminho: "/app/financas", rotulo: "Visão geral" },
  { caminho: "/app/financas/mes", rotulo: "Mês" },
  { caminho: "/app/financas/ano", rotulo: "Ano" },
  { caminho: "/app/financas/faturas", rotulo: "Faturas" },
  { caminho: "/app/financas/lancamentos", rotulo: "Lançamentos" },
  { caminho: "/app/financas/configuracoes", rotulo: "Configurações" },
] as const;

/** Barra de abas das Finanças: no lugar do menu lateral da família, uma pílula "Tabela | Cards"-style no alto. */
function Abas() {
  const pathname = usePathname();
  const router = useRouter();
  const ativa = ABAS.find((a) =>
    a.caminho === "/app/financas" ? pathname === a.caminho : pathname.startsWith(a.caminho),
  )?.caminho;
  return (
    <div className="fi-abas">
      <div className="fi-segmented" role="group" aria-label="Seções das Finanças">
        {ABAS.map((a) => (
          <button
            key={a.caminho}
            type="button"
            aria-pressed={a.caminho === ativa}
            onClick={() => router.push(a.caminho)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <Button
        onClick={() => router.push("/app/financas/lancar")}
        icon={<Plus size={16} weight="bold" aria-hidden />}
        data-testid="lancar"
      >
        Lançar
      </Button>
    </div>
  );
}

/** Só deixa as telas abrirem quando as contas e categorias chegaram (ou diz o que fazer se não). */
function Porteiro({ children }: { children: ReactNode }) {
  const { carregando, erro, faltaMigration } = useFinancas();
  if (carregando) return <Skeleton h={256} />;
  if (faltaMigration) {
    return (
      <Badge tone="warning">
        <Warning size={14} />O banco ainda não recebeu a atualização das Finanças. Peça para
        aplicá-la na VPS.
      </Badge>
    );
  }
  if (erro) {
    return (
      <Badge tone="error">
        <Warning size={14} />
        Não foi possível carregar as Finanças: {erro}
      </Badge>
    );
  }
  return <>{children}</>;
}

/**
 * A casca das Finanças: o visual da família (`.fi-raiz`), o provedor de contas/categorias, os avisos e
 * a barra de abas. As telas moram dentro dela.
 */
export function FinancasCasca({ children }: { children: ReactNode }) {
  return (
    <div
      className="fi-raiz mx-auto w-full max-w-[1800px] p-4 sm:px-8 sm:py-6 2xl:px-12"
      data-testid="financas"
    >
      <FinancasProvider>
        <ToastProvider>
          <div className="fi-pilha">
            <header>
              <h1 className="t-display">Finanças</h1>
              <p className="t-body-sm t-muted">
                Quanto entrou, quanto saiu e quanto sobra — com as vendas entrando sozinhas.
              </p>
            </header>
            <Abas />
            <Suspense fallback={<Skeleton h={256} />}>
              <Porteiro>{children}</Porteiro>
            </Suspense>
          </div>
        </ToastProvider>
      </FinancasProvider>
    </div>
  );
}
