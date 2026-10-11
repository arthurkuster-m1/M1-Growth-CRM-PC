"use client";

import { useT } from "@/hooks/i18n/useT";
import {
  ABAS_OPCIONAIS,
  abasDaCampanha,
  opcionaisDaCampanha,
  type AbaDaCampanha,
  type AbaOpcional,
} from "@/lib/marketing/campanhas-abas";
import type { CanalDaCampanha } from "@/lib/marketing/campanhas";
import { Plus } from "@/lib/ui/icons";
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
  escolhidas,
  aba,
  aoEscolher,
  podeEditar,
  aoAdicionar,
}: {
  canal: CanalDaCampanha;
  escolhidas: readonly string[] | null;
  aba: AbaDaCampanha;
  aoEscolher: (a: AbaDaCampanha) => void;
  podeEditar: boolean;
  aoAdicionar: (a: AbaOpcional) => void;
}) {
  const t = useT();
  const ativas = opcionaisDaCampanha(canal, escolhidas);
  const faltam = ABAS_OPCIONAIS.filter((a) => !ativas.includes(a));
  return (
    <nav
      aria-label={t("Subpáginas da campanha")}
      className="flex gap-1 overflow-x-auto rounded-2xl bg-secondary p-1"
    >
      {abasDaCampanha(canal, escolhidas).map((a, i) => (
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
      {podeEditar && faltam.length > 0 ? (
        <details className="relative shrink-0">
          <summary
            aria-label={t("Adicionar página")}
            className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <Plus size={16} weight="bold" aria-hidden />
          </summary>
          <ul className="absolute top-11 right-0 z-20 grid min-w-48 gap-0.5 rounded-xl border bg-card p-1 shadow-lg">
            {faltam.map((a) => (
              <li key={a}>
                <button
                  type="button"
                  onClick={(e) => {
                    (
                      e.currentTarget.closest("details") as HTMLDetailsElement | null
                    )?.removeAttribute("open");
                    aoAdicionar(a);
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap hover:bg-secondary"
                >
                  {rotuloDaAba(t, a)}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </nav>
  );
}
