"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/hooks/i18n/useT";
import { SlidersHorizontal } from "@/lib/ui/icons";

export interface PropriedadeDoMenu {
  id: string;
  titulo: string;
  /** O título não pode ser escondido: sem ele a linha perde o nome. */
  fixa?: boolean;
  visivel: boolean;
}

/** "Propriedades": o painel que liga e desliga as colunas da tabela. */
export function MenuDePropriedades({
  propriedades,
  aoAlternar,
}: {
  propriedades: readonly PropriedadeDoMenu[];
  aoAlternar: (id: string) => void;
}) {
  const t = useT();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-xl border bg-card px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <SlidersHorizontal size={16} aria-hidden />
          {t("Propriedades")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="mb-2 text-xs font-semibold tracking-wider text-text-subtle uppercase">
          {t("Mostrar na tabela")}
        </p>
        <ul className="space-y-1">
          {propriedades.map((p) => {
            const ligada = p.fixa || p.visivel;
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 py-1 text-sm">
                <span className={p.fixa ? "text-muted-foreground" : undefined}>{p.titulo}</span>
                <Switch
                  checked={ligada}
                  disabled={p.fixa}
                  aria-label={p.titulo}
                  onCheckedChange={() => aoAlternar(p.id)}
                />
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
