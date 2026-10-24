"use client";

import { useT } from "@/hooks/i18n/useT";
import {
  opcionaisPermitidas,
  abasDaCampanha,
  opcionaisDaCampanha,
  type AbaDaCampanha,
  type AbaOpcional,
} from "@/lib/marketing/campanhas-abas";
import type { CanalDaCampanha } from "@/lib/marketing/campanhas";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Trash } from "@/lib/ui/icons";
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
    case "cadencia":
      return t("Cadência");
    case "extracao":
      return t("Extração de leads");
    case "disparos":
      return t("Disparos");
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
  aoRemover,
}: {
  canal: CanalDaCampanha;
  escolhidas: readonly string[] | null;
  aba: AbaDaCampanha;
  aoEscolher: (a: AbaDaCampanha) => void;
  podeEditar: boolean;
  aoAdicionar: (a: AbaOpcional) => void;
  aoRemover: (a: AbaOpcional) => void;
}) {
  const t = useT();
  const ativas = opcionaisDaCampanha(canal, escolhidas);
  const faltam = opcionaisPermitidas(canal).filter((a) => !ativas.includes(a));
  return (
    <div className="relative flex min-w-0 items-center gap-1 rounded-2xl bg-secondary p-1">
      <nav
        aria-label={t("Subpáginas da campanha")}
        className="flex min-w-0 flex-1 [scrollbar-width:none] gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden"
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
      </nav>
      {podeEditar ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("Páginas da campanha")}
              className="grid h-10 w-10 shrink-0 grid-cols-1 place-items-center rounded-xl text-muted-foreground hover:bg-card hover:text-foreground"
            >
              <Plus size={16} weight="bold" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="grid w-64 grid-cols-1 gap-3 p-2">
            {faltam.length > 0 ? (
              <div className="grid grid-cols-1 gap-0.5">
                <p className="px-2 pt-1 text-xs font-semibold tracking-wider text-text-subtle uppercase">
                  {t("Adicionar página")}
                </p>
                {faltam.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => aoAdicionar(a)}
                    className="flex h-9 items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-secondary"
                  >
                    <Plus size={14} aria-hidden />
                    {rotuloDaAba(t, a)}
                  </button>
                ))}
              </div>
            ) : null}
            {ativas.length > 0 ? (
              <div className="grid grid-cols-1 gap-0.5">
                <p className="px-2 pt-1 text-xs font-semibold tracking-wider text-text-subtle uppercase">
                  {t("Tirar página")}
                </p>
                {ativas.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => aoRemover(a)}
                    className="flex h-9 items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-secondary hover:text-error-fg"
                  >
                    <Trash size={14} aria-hidden />
                    {rotuloDaAba(t, a)}
                  </button>
                ))}
                <p className="px-2 pt-1 text-xs text-muted-foreground">
                  {t("Os dados da página ficam guardados e voltam se você adicioná-la de novo.")}
                </p>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
