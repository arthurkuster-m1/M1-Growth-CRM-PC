"use client";

import { useState } from "react";

import { AcaoEmMassa, BarraDeSelecao } from "@/components/motor/BarraDeSelecao";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { useT } from "@/hooks/i18n/useT";
import { deCampoLocal } from "@/lib/motor/datas-do-campo";
import type { MudancasEmMassa } from "@/lib/tarefas/edicao-em-massa";
import type { CorDaOpcao, OpcaoDeStatus } from "@/lib/tarefas/opcoes-de-status";
import {
  SITUACOES_DA_TAREFA,
  type PrioridadeDaTarefa,
  type SituacaoDaTarefa,
  type Tarefa,
} from "@/lib/tarefas/tipos";
import { CalendarBlank, Flag, Tag, Trash, UserCircle } from "@/lib/ui/icons";

interface Props {
  quantidade: number;
  opcoesDeStatus: readonly OpcaoDeStatus[];
  titulosDosGrupos: Record<SituacaoDaTarefa, string>;
  prioridades: readonly { id: PrioridadeDaTarefa; rotulo: string; cor: CorDaOpcao }[];
  membros: readonly { id: string; nome: string }[];
  fuso: string;
  /** Aplica a mudança a TODAS as selecionadas. `local` é o que a tela mostra enquanto o servidor responde. */
  aoAplicar: (mudancas: MudancasEmMassa, local?: Partial<Tarefa>) => void;
  aoApagar: () => void;
  aoLimpar: () => void;
}

const ITEM = "flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary";

/** O prazo em massa: escolhe o dia e a hora e aplica; ou limpa o prazo de todas. */
function PainelDePrazo({
  fuso,
  fechar,
  aoAplicar,
}: {
  fuso: string;
  fechar: () => void;
  aoAplicar: Props["aoAplicar"];
}) {
  const t = useT();
  const [valor, setValor] = useState("");

  return (
    <div className="space-y-2 p-1.5">
      <input
        type="datetime-local"
        aria-label={t("Prazo")}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={!deCampoLocal(valor, fuso)}
          onClick={() => {
            const due_date = deCampoLocal(valor, fuso);
            if (!due_date) return;
            aoAplicar({ due_date }, { due_date });
            fechar();
          }}
          className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("Aplicar")}
        </button>
        <button
          type="button"
          onClick={() => {
            aoAplicar({ due_date: null }, { due_date: null });
            fechar();
          }}
          className="rounded-lg border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {t("Limpar prazo")}
        </button>
      </div>
    </div>
  );
}

/** As ações da barra de seleção das Tarefas: status, prioridade, responsável, prazo e apagar. */
export function AcoesEmMassa({
  quantidade,
  opcoesDeStatus,
  titulosDosGrupos,
  prioridades,
  membros,
  fuso,
  aoAplicar,
  aoApagar,
  aoLimpar,
}: Props) {
  const t = useT();

  return (
    <BarraDeSelecao quantidade={quantidade} aoLimpar={aoLimpar}>
      <AcaoEmMassa rotulo={t("Status")} icone={<Tag size={14} aria-hidden />}>
        {(fechar) => (
          <div className="max-h-64 overflow-y-auto">
            {SITUACOES_DA_TAREFA.map((grupo) => {
              const doGrupo = opcoesDeStatus.filter((o) => o.grupo === grupo);
              if (doGrupo.length === 0) return null;
              return (
                <div key={grupo} className="pb-1">
                  <p className="px-2 pt-1.5 pb-0.5 text-[11px] font-semibold tracking-wider text-text-subtle uppercase">
                    {titulosDosGrupos[grupo]}
                  </p>
                  {doGrupo.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className={ITEM}
                      onClick={() => {
                        aoAplicar(
                          { status_option_id: o.id },
                          { status_option_id: o.id, status: o.grupo },
                        );
                        fechar();
                      }}
                    >
                      <Etiqueta cor={o.color}>{o.name}</Etiqueta>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </AcaoEmMassa>

      <AcaoEmMassa rotulo={t("Prioridade")} icone={<Flag size={14} aria-hidden />}>
        {(fechar) =>
          prioridades.map((p) => (
            <button
              key={p.id}
              type="button"
              className={ITEM}
              onClick={() => {
                aoAplicar({ priority: p.id }, { priority: p.id });
                fechar();
              }}
            >
              <Etiqueta cor={p.cor}>{p.rotulo}</Etiqueta>
            </button>
          ))
        }
      </AcaoEmMassa>

      <AcaoEmMassa rotulo={t("Responsável")} icone={<UserCircle size={14} aria-hidden />}>
        {(fechar) => (
          <div className="max-h-64 overflow-y-auto">
            <button
              type="button"
              className={`${ITEM} text-muted-foreground`}
              onClick={() => {
                aoAplicar({ assigned_to: null }, { assigned_to: null });
                fechar();
              }}
            >
              {t("Ninguém")}
            </button>
            {membros.map((m) => (
              <button
                key={m.id}
                type="button"
                className={ITEM}
                onClick={() => {
                  aoAplicar({ assigned_to: m.id }, { assigned_to: m.id });
                  fechar();
                }}
              >
                <span className="truncate">{m.nome}</span>
              </button>
            ))}
          </div>
        )}
      </AcaoEmMassa>

      <AcaoEmMassa rotulo={t("Prazo")} icone={<CalendarBlank size={14} aria-hidden />}>
        {(fechar) => <PainelDePrazo fuso={fuso} fechar={fechar} aoAplicar={aoAplicar} />}
      </AcaoEmMassa>

      <AcaoEmMassa
        rotulo={t("Apagar")}
        icone={<Trash size={14} aria-hidden />}
        destrutivo
        aoClicar={aoApagar}
      />
    </BarraDeSelecao>
  );
}
