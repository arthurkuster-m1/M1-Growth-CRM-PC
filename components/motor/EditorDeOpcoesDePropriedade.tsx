"use client";

import { CampoDeNome, CampoDeNovaOpcao } from "@/components/motor/CamposDoEditor";
import { SeletorDeCor } from "@/components/motor/SeletorDeCor";
import { useT } from "@/hooks/i18n/useT";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import type { OpcaoDePropriedade } from "@/lib/tarefas/propriedades";
import { CaretLeft, Trash } from "@/lib/ui/icons";

/** As cores que uma opção nova recebe, em rodízio — para as primeiras não nascerem todas cinzas. */
const CORES_EM_RODIZIO: readonly CorDaOpcao[] = [
  "blue",
  "green",
  "orange",
  "purple",
  "pink",
  "yellow",
  "red",
  "brown",
];

/**
 * Edita as opções de uma propriedade de seleção (renomear, recolorir, apagar, adicionar).
 * Cada gesto entrega a lista INTEIRA já atualizada em `aoMudar` — é como a rota a recebe, e
 * é o que deixa "apagar uma opção" e "renomear outra" não se atropelarem.
 */
export function EditorDeOpcoesDePropriedade({
  opcoes,
  aoMudar,
  voltar,
}: {
  opcoes: readonly OpcaoDePropriedade[];
  aoMudar: (novas: OpcaoDePropriedade[]) => void;
  voltar: () => void;
}) {
  const t = useT();

  const alterar = (id: string, mudanca: Partial<OpcaoDePropriedade>) =>
    aoMudar(opcoes.map((o) => (o.id === id ? { ...o, ...mudanca } : o)));

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

      <div className="max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
        {opcoes.length === 0 ? (
          <p className="px-1 py-1 text-xs text-text-subtle">{t("Nenhuma opção ainda.")}</p>
        ) : null}
        {opcoes.map((opcao) => (
          <div key={`${opcao.id}:${opcao.name}`} className="flex items-center gap-1.5">
            <SeletorDeCor
              valor={opcao.color}
              aoEscolher={(color) => alterar(opcao.id, { color })}
            />
            <CampoDeNome
              valor={opcao.name}
              rotulo={t("Nome da opção")}
              aoSalvar={(name) => alterar(opcao.id, { name })}
            />
            <button
              type="button"
              aria-label={t("Apagar opção")}
              title={t("Apagar opção")}
              onClick={() => aoMudar(opcoes.filter((o) => o.id !== opcao.id))}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-error-fg"
            >
              <Trash size={14} aria-hidden />
            </button>
          </div>
        ))}
        <CampoDeNovaOpcao
          placeholder={t("Adicionar opção")}
          aoCriar={(name) =>
            aoMudar([
              ...opcoes,
              {
                id: crypto.randomUUID(),
                name,
                color: CORES_EM_RODIZIO[opcoes.length % CORES_EM_RODIZIO.length]!,
              },
            ])
          }
        />
      </div>
    </div>
  );
}
