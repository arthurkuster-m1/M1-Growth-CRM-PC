"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useUser } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";

/** As telas do modo agência, lado a lado. Cresce a cada fase (dashboards, tarefas…). */
const TELAS: ReadonlyArray<{ href: string; rotulo: string; soSuperAdmin?: boolean }> = [
  { href: "/app/agencia/campanhas", rotulo: "Campanhas" },
  { href: "/app/agencia/cronograma", rotulo: "Cronograma e semana" },
  { href: "/app/agencia/dashboards", rotulo: "Dashboards" },
  { href: "/app/agencia/tarefas", rotulo: "Tarefas" },
  { href: "/app/agencia/equipe", rotulo: "Equipe e clientes", soSuperAdmin: true },
];

export function NavegacaoDoModoAgencia() {
  const t = useT();
  const atual = usePathname();
  const user = useUser();
  const ehSuperAdmin = user.is_platform_admin && !user.support;
  return (
    <nav aria-label={t("Modo agência")} className="flex flex-wrap gap-1.5">
      {TELAS.filter((tela) => !tela.soSuperAdmin || ehSuperAdmin).map((tela) => (
        <Link
          key={tela.href}
          href={tela.href}
          aria-current={atual === tela.href ? "page" : undefined}
          className={cn(
            "inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors",
            atual === tela.href
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-foreground hover:bg-secondary/70",
          )}
        >
          {t(tela.rotulo)}
        </Link>
      ))}
    </nav>
  );
}
