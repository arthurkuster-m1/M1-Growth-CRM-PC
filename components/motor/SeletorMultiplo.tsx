"use client";

import { useState, type ReactNode } from "react";

import { Etiqueta } from "@/components/motor/Etiqueta";
import type { OpcaoDoSeletor } from "@/components/motor/SeletorDeOpcao";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { Check } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Props {
  opcoes: readonly OpcaoDoSeletor[];
  /** Os ids marcados. Id que não existe mais nas opções é ignorado na tela. */
  valorIds: readonly string[];
  aoMudar: (ids: string[]) => void;
  podeEditar: boolean;
  rotulo: string;
  /** Editor de opções (só para quem pode configurar); ver `SeletorDeOpcao`. */
  renderizarEditor?: (voltar: () => void) => ReactNode;
}

/**
 * A "seleção múltipla" do Notion: a célula mostra todas as etiquetas marcadas; abrir o painel
 * liga e desliga cada opção SEM fechar — é comum marcar três de uma vez.
 */
export function SeletorMultiplo({
  opcoes,
  valorIds,
  aoMudar,
  podeEditar,
  rotulo,
  renderizarEditor,
}: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);

  const marcadas = opcoes.filter((o) => valorIds.includes(o.id));

  const alternar = (id: string) =>
    aoMudar(valorIds.includes(id) ? valorIds.filter((x) => x !== id) : [...valorIds, id]);

  return (
    <Popover
      open={aberto}
      onOpenChange={(valor) => {
        setAberto(valor);
        if (!valor) setEditando(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!podeEditar}
          aria-label={rotulo}
          className={cn(
            "flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md px-2 py-1 text-left",
            podeEditar && "hover:bg-secondary",
          )}
        >
          {marcadas.length === 0 ? (
            <span className="text-sm text-text-subtle">{t("Vazio")}</span>
          ) : (
            marcadas.map((o) => (
              <Etiqueta key={o.id} cor={o.cor}>
                {o.rotulo}
              </Etiqueta>
            ))
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        {editando && renderizarEditor ? (
          renderizarEditor(() => setEditando(false))
        ) : (
          <>
            <div className="max-h-72 space-y-0.5 overflow-y-auto">
              {opcoes.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-text-subtle">{t("Nenhuma opção ainda.")}</p>
              ) : null}
              {opcoes.map((o) => {
                const ligada = valorIds.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="checkbox"
                    aria-checked={ligada}
                    onClick={() => alternar(o.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary",
                      ligada && "bg-secondary",
                    )}
                  >
                    <Etiqueta cor={o.cor}>{o.rotulo}</Etiqueta>
                    {ligada ? <Check size={14} className="text-primary" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
            {renderizarEditor ? (
              <div className="mt-1 border-t pt-1">
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  {t("Editar opções")}
                </button>
              </div>
            ) : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
