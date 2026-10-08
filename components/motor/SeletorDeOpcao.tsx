"use client";

import { useState, type ReactNode } from "react";

import { Etiqueta } from "@/components/motor/Etiqueta";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { Check } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface OpcaoDoSeletor {
  id: string;
  rotulo: string;
  cor: CorDaOpcao;
  /** Chave do grupo, quando a lista é dividida em seções (ex.: os grupos do status). */
  grupo?: string;
}

interface Props {
  opcoes: readonly OpcaoDoSeletor[];
  valorId: string | undefined;
  aoEscolher: (id: string) => void;
  podeEditar: boolean;
  /** O que a célula mostra fechada (normalmente a `Etiqueta` do valor atual). */
  children: ReactNode;
  /** Rótulo de acessibilidade do botão (ex.: "Status da tarefa"). */
  rotulo: string;
  /** Título de cada seção, na ordem em que aparecem. Sem isto a lista é plana. */
  secoes?: ReadonlyArray<{ grupo: string; titulo: string }>;
  /**
   * Editor de opções. Quando passado, o rodapé ganha "Editar opções" e o painel troca
   * a lista por este conteúdo; `voltar` retorna à lista.
   */
  renderizarEditor?: (voltar: () => void) => ReactNode;
}

/**
 * O seletor do Notion: a célula mostra a etiqueta atual e, ao clicar, abre a lista de
 * opções coloridas. Serve para status, prioridade e qualquer coluna de "seleção".
 */
export function SeletorDeOpcao({
  opcoes,
  valorId,
  aoEscolher,
  podeEditar,
  children,
  rotulo,
  secoes,
  renderizarEditor,
}: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);

  const item = (opcao: OpcaoDoSeletor) => (
      <button
        key={opcao.id}
        type="button"
        onClick={() => {
          aoEscolher(opcao.id);
          setAberto(false);
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-secondary",
          opcao.id === valorId && "bg-secondary",
        )}
      >
        <Etiqueta cor={opcao.cor}>{opcao.rotulo}</Etiqueta>
        {opcao.id === valorId ? <Check size={14} className="text-primary" aria-hidden /> : null}
      </button>
  );

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
            "flex w-full items-center rounded-md px-2 py-1.5 text-left",
            podeEditar && "hover:bg-secondary",
          )}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        {editando && renderizarEditor ? (
          renderizarEditor(() => setEditando(false))
        ) : (
          <>
            <div className="max-h-72 space-y-0.5 overflow-y-auto">
              {secoes
                ? secoes.map(({ grupo, titulo }) => {
                    const doGrupo = opcoes.filter((o) => o.grupo === grupo);
                    if (doGrupo.length === 0) return null;
                    return (
                      <div key={grupo} className="pb-1">
                        <p className="px-2 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-subtle">
                          {titulo}
                        </p>
                        {doGrupo.map(item)}
                      </div>
                    );
                  })
                : opcoes.map(item)}
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
