"use client";

import Link from "next/link";

import { useT } from "@/hooks/i18n/useT";
import { FolderSimple } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** As duas "pastas" da Agenda: a página dos compromissos e a das análises. */
export function AbasDaAgenda({ ativa }: { ativa: "agenda" | "analises" }) {
  const t = useT();
  const abas = [
    { id: "agenda", rotulo: t("Agenda"), href: "/app/agenda" },
    { id: "analises", rotulo: t("Análises"), href: "/app/agenda/analises" },
  ] as const;
  return (
    <nav className="mb-3 flex flex-wrap gap-2" aria-label={t("Agenda")}>
      {abas.map((a) => {
        const ligada = a.id === ativa;
        return (
          <Link
            key={a.id}
            href={a.href}
            aria-current={ligada ? "page" : undefined}
            data-testid={`aba-da-agenda-${a.id}`}
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium transition-colors",
              ligada
                ? "border-primary/40 bg-primary/10 text-foreground shadow-xs"
                : "border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            <FolderSimple size={18} weight={ligada ? "fill" : "bold"} aria-hidden />
            {a.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
