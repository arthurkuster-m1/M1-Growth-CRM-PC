"use client";

import { CampoDeNome, CampoDeNovaOpcao } from "@/components/motor/CamposDoEditor";
import { SeletorDeCor } from "@/components/motor/SeletorDeCor";
import { useT } from "@/hooks/i18n/useT";
import type { EdicaoDaOpcao, NovaOpcao } from "@/hooks/tarefas/useOpcoesDeStatus";
import {
  COR_PADRAO_DO_GRUPO,
  type CorDaOpcao,
  type OpcaoDeStatus,
} from "@/lib/tarefas/opcoes-de-status";
import { SITUACOES_DA_TAREFA, type SituacaoDaTarefa } from "@/lib/tarefas/tipos";
import { CaretLeft, Trash } from "@/lib/ui/icons";

interface Props {
  opcoes: readonly OpcaoDeStatus[];
  titulosDosGrupos: Record<SituacaoDaTarefa, string>;
  voltar: () => void;
  aoCriar: (entrada: NovaOpcao) => Promise<unknown>;
  aoEditar: (id: string, entrada: EdicaoDaOpcao) => Promise<unknown>;
  aoApagar: (id: string) => Promise<unknown>;
}

/**
 * Edita as opções de status: renomear, recolorir, mudar de grupo, apagar e adicionar.
 * A regra "cada grupo mantém pelo menos uma opção" é da API; aqui os controles que a
 * violariam já aparecem desligados, para o erro quase nunca precisar acontecer.
 */
export function EditorDeOpcoesDeStatus({
  opcoes,
  titulosDosGrupos,
  voltar,
  aoCriar,
  aoEditar,
  aoApagar,
}: Props) {
  const t = useT();
  const contagemPorGrupo = (grupo: SituacaoDaTarefa) =>
    opcoes.filter((o) => o.grupo === grupo).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={voltar}
          aria-label={t("Voltar")}
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-secondary"
        >
          <CaretLeft size={14} aria-hidden />
        </button>
        <p className="text-sm font-semibold">{t("Editar opções")}</p>
      </div>

      <div className="max-h-80 space-y-3 overflow-y-auto pr-0.5">
        {SITUACOES_DA_TAREFA.map((grupo) => {
          const doGrupo = opcoes.filter((o) => o.grupo === grupo);
          const ultima = contagemPorGrupo(grupo) <= 1;
          return (
            <section key={grupo} aria-label={titulosDosGrupos[grupo]} className="space-y-1.5">
              <p className="px-0.5 text-[11px] font-semibold tracking-wider text-text-subtle uppercase">
                {titulosDosGrupos[grupo]}
              </p>
              {doGrupo.map((opcao) => (
                <div key={`${opcao.id}:${opcao.name}`} className="flex items-center gap-1.5">
                  <SeletorDeCor
                    valor={opcao.color}
                    aoEscolher={(cor: CorDaOpcao) => void aoEditar(opcao.id, { color: cor })}
                  />
                  <CampoDeNome
                    valor={opcao.name}
                    rotulo={t("Nome da opção")}
                    aoSalvar={(nome) => void aoEditar(opcao.id, { name: nome })}
                  />
                  <select
                    value={opcao.grupo}
                    disabled={ultima}
                    title={ultima ? t("Cada grupo precisa de pelo menos uma opção.") : undefined}
                    aria-label={t("Grupo")}
                    onChange={(e) =>
                      void aoEditar(opcao.id, { grupo: e.target.value as SituacaoDaTarefa })
                    }
                    className="h-7 w-[84px] shrink-0 rounded-md border bg-background px-1 text-xs text-muted-foreground disabled:opacity-50"
                  >
                    {SITUACOES_DA_TAREFA.map((g) => (
                      <option key={g} value={g}>
                        {titulosDosGrupos[g]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={ultima}
                    aria-label={t("Apagar opção")}
                    title={
                      ultima ? t("Cada grupo precisa de pelo menos uma opção.") : t("Apagar opção")
                    }
                    onClick={() => void aoApagar(opcao.id)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-error-fg disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  >
                    <Trash size={14} aria-hidden />
                  </button>
                </div>
              ))}
              <CampoDeNovaOpcao
                placeholder={t("Adicionar opção")}
                aoCriar={(nome) =>
                  void aoCriar({ name: nome, grupo, color: COR_PADRAO_DO_GRUPO[grupo] })
                }
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
