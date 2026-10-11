"use client";

import { useT } from "@/hooks/i18n/useT";
import { abasDoCanal, type AbaDaCampanha } from "@/lib/marketing/campanhas-abas";
import type { CanalDaCampanha } from "@/lib/marketing/campanhas";
import { cn } from "@/lib/utils";

function rotuloDaAba(t: (s: string) => string, a: AbaDaCampanha): string {
  switch (a) {
    case "cadastro":
      return t("Cadastro");
    case "visao":
      return t("Visão geral");
    case "dia":
      return t("Dia a dia");
    case "landing":
      return t("Landing pages");
    case "criativos":
      return t("Criativos");
    case "abordagem":
      return t("Abordagem");
    case "funil":
      return t("Funil de conversão");
  }
}

/** As subpáginas da campanha, numeradas, na ordem em que a agência trabalha. */
export function AbasDaCampanha({
  canal,
  aba,
  aoEscolher,
}: {
  canal: CanalDaCampanha;
  aba: AbaDaCampanha;
  aoEscolher: (a: AbaDaCampanha) => void;
}) {
  const t = useT();
  return (
    <nav
      aria-label={t("Subpáginas da campanha")}
      className="flex gap-1 overflow-x-auto rounded-2xl bg-secondary p-1"
    >
      {abasDoCanal(canal).map((a, i) => (
        <button
          key={a}
          type="button"
          aria-current={aba === a ? "page" : undefined}
          onClick={() => aoEscolher(a)}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium whitespace-nowrap transition-colors",
            aba === a
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="text-xs text-text-subtle tabular-nums">
            {String(i + 1).padStart(2, "0")}
          </span>
          {rotuloDaAba(t, a)}
        </button>
      ))}
    </nav>
  );
}
