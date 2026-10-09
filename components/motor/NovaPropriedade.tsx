"use client";

import { useState } from "react";

import { iconeDoTipo, rotuloDoTipo } from "@/components/motor/tipos-de-propriedade";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { TIPOS_DE_PROPRIEDADE, type TipoDePropriedade } from "@/lib/tarefas/propriedades";
import { Plus } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * O "+" no fim do cabeçalho: dá nome e escolhe o tipo de uma propriedade nova. O tipo não
 * muda depois de criado — por isso é a única hora em que se escolhe.
 */
export function NovaPropriedade({
  aoCriar,
}: {
  aoCriar: (entrada: { name: string; type: TipoDePropriedade }) => Promise<unknown>;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoDePropriedade>("text");
  const [criando, setCriando] = useState(false);

  async function criar() {
    const name = nome.trim();
    if (!name || criando) return;
    setCriando(true);
    try {
      await aoCriar({ name, type: tipo });
      setNome("");
      setTipo("text");
      setAberto(false);
    } catch {
      // O hook já mostrou o erro (nome repetido, limite…); o painel continua aberto.
    } finally {
      setCriando(false);
    }
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("Nova propriedade")}
          title={t("Nova propriedade")}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Plus size={14} weight="bold" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 p-3">
        <input
          value={nome}
          autoFocus
          maxLength={60}
          placeholder={t("Nome da propriedade")}
          aria-label={t("Nome da propriedade")}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void criar();
          }}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm outline-hidden focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-text-subtle uppercase">
            {t("Tipo")}
          </p>
          <div className="grid grid-cols-2 gap-1">
            {TIPOS_DE_PROPRIEDADE.map((valor) => (
              <button
                key={valor}
                type="button"
                aria-pressed={tipo === valor}
                onClick={() => setTipo(valor)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary",
                  tipo === valor && "border-primary/60 bg-accent-soft font-medium text-foreground",
                )}
              >
                <span className="text-muted-foreground">{iconeDoTipo(valor)}</span>
                <span className="truncate">{rotuloDoTipo(t, valor)}</span>
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          disabled={!nome.trim() || criando}
          onClick={() => void criar()}
          className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("Criar propriedade")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
