"use client";

import type { ReactNode } from "react";

import { AcaoEmMassa } from "@/components/motor/BarraDeSelecao";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { useT } from "@/hooks/i18n/useT";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { Trash } from "@/lib/ui/icons";

export interface GrupoDeAcao {
  rotulo: string;
  icone?: ReactNode;
  opcoes: Array<{ id: string; rotulo: string; cor: CorDaOpcao }>;
  /** Aplica a opção escolhida a todos os itens selecionados. */
  aplicar: (ids: string[], opcao: string) => void | Promise<void>;
}

/**
 * As ações da barra de edição em massa das coleções da campanha: uma lista de valores por
 * propriedade (ex.: Status) e "Apagar". Escolher aplica a TODOS os selecionados.
 */
export function AcoesDaColecao({
  ids,
  limpar,
  grupos,
  apagar,
  nomeDoItem,
}: {
  ids: string[];
  limpar: () => void;
  grupos: GrupoDeAcao[];
  apagar: (ids: string[]) => void | Promise<void>;
  /** Plural, para a confirmação: "landing pages", "criativos"… */
  nomeDoItem: string;
}) {
  const t = useT();
  return (
    <>
      {grupos.map((g) => (
        <AcaoEmMassa key={g.rotulo} rotulo={g.rotulo} icone={g.icone}>
          {(fechar) => (
            <div>
              {g.opcoes.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={async () => {
                    await g.aplicar(ids, o.id);
                    fechar();
                  }}
                  className="flex w-full rounded-md px-2 py-1.5 hover:bg-secondary"
                >
                  <Etiqueta ponto cor={o.cor}>
                    {o.rotulo}
                  </Etiqueta>
                </button>
              ))}
            </div>
          )}
        </AcaoEmMassa>
      ))}
      <AcaoEmMassa
        rotulo={t("Apagar")}
        icone={<Trash size={14} aria-hidden />}
        destrutivo
        aoClicar={async () => {
          if (
            !window.confirm(
              `${t("Apagar")} ${ids.length} ${nomeDoItem}? ${t("Isso não pode ser desfeito.")}`,
            )
          ) {
            return;
          }
          await apagar(ids);
          limpar();
        }}
      />
    </>
  );
}
