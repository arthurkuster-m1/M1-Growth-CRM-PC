"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { useT } from "@/hooks/i18n/useT";
import { EditorVisualDeBlocos } from "@/components/marketing/EditorVisualDeBlocos";
import {
  blocosDoModelo,
  padraoDoModelo,
  type ModeloDeAtendimentoDoTipo,
} from "@/lib/agenda/modelos-de-atendimento";
import { randomId } from "@/lib/random-id";
import { ROTULO_DO_MODELO } from "@/lib/agenda/atendimentos";
import { apiClient } from "@/lib/api/client";

import { BlocoRecolhivel } from "./BlocoRecolhivel";
import { useMatrizDeAtendentes } from "./equipe-hooks";
import { useModelosDeAtendimento } from "./modelos-hooks";

const BLOCOS: Array<{
  id: keyof ModeloDeAtendimentoDoTipo["blocos"];
  rotulo: string;
  dica: string;
}> = [
  { id: "anotacoes", rotulo: "Anotações", dica: "O espaço para escrever o que foi falado." },
  {
    id: "oportunidade",
    rotulo: "Oportunidade e venda",
    dica: "A oportunidade, a venda e as parcelas dentro do compromisso.",
  },
  {
    id: "ia",
    rotulo: "Recomendações da IA ao vivo",
    dica: "Sugestões durante a reunião (em breve).",
  },
];

/**
 * O roteiro vive DENTRO do editor de blocos: o que antes era uma lista de passos com checkbox separado
 * passa a ser os próprios blocos do modelo. Sem modelo de blocos gravado, o editor já abre com os
 * blocos que saem do roteiro padrão do tipo.
 */
function comBlocos(m: ModeloDeAtendimentoDoTipo): ModeloDeAtendimentoDoTipo {
  return m.blocos_do_modelo ? m : { ...m, blocos_do_modelo: blocosDoModelo(m, randomId) };
}

function EditorDoTipo({
  tipoId,
  atual,
  podeEditar,
}: {
  tipoId: string;
  atual: ModeloDeAtendimentoDoTipo;
  podeEditar: boolean;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [m, setM] = React.useState<ModeloDeAtendimentoDoTipo>(() => comBlocos(atual));
  const [sujo, setSujo] = React.useState(false);
  const mudar = (f: (x: ModeloDeAtendimentoDoTipo) => ModeloDeAtendimentoDoTipo) => {
    setM((x) => f(x));
    setSujo(true);
  };
  const salvar = useMutation({
    mutationFn: async () =>
      apiClient.put("/api/v1/agenda/modelos-de-atendimento", {
        event_type_id: tipoId,
        modelo: m.modelo,
        blocos: m.blocos,
        roteiro: m.roteiro.filter((p) => p.titulo.trim() !== ""),
        ...(m.blocos_do_modelo ? { blocos_do_modelo: m.blocos_do_modelo } : {}),
      }),
    onSuccess: () => {
      toast.success(t("Página de atendimento salva."));
      setSujo(false);
      void qc.invalidateQueries({ queryKey: ["agenda", "modelos-de-atendimento"] });
    },
    onError: showApiError,
  });

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <div className="grid gap-1 sm:max-w-sm">
        <p className="text-sm font-medium">{t("Modelo da página")}</p>
        <SeletorEmPopup
          rotulo={t("Modelo da página de atendimento")}
          valor={m.modelo}
          desabilitado={!podeEditar}
          opcoes={(["vendas", "padrao"] as const).map((id) => ({
            id,
            rotulo: t(ROTULO_DO_MODELO[id]),
          }))}
          aoEscolher={(id) => {
            if (id === m.modelo) return;
            // Trocar de modelo traz o padrão dele (blocos e roteiro); dá para ajustar depois.
            setM(comBlocos(padraoDoModelo(id as ModeloDeAtendimentoDoTipo["modelo"])));
            setSujo(true);
          }}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t("O que aparece na página do compromisso")}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {BLOCOS.map((b) => (
            <li key={b.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-card px-3 py-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  disabled={!podeEditar}
                  checked={m.blocos[b.id]}
                  onChange={(e) =>
                    mudar((x) => ({ ...x, blocos: { ...x.blocos, [b.id]: e.target.checked } }))
                  }
                />
                <span className="text-sm">
                  <span className="font-medium">{t(b.rotulo)}</span>
                  <span className="block text-xs text-muted-foreground">{t(b.dica)}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0">
        <p className="mb-1 text-sm font-medium">{t("Roteiro e modelo da página")}</p>
        <p className="mb-2 text-xs text-muted-foreground">
          {t(
            "O roteiro de atendimento fica aqui dentro: escreva os passos, perguntas e anotações como blocos. A página do compromisso já abre com este modelo; cada compromisso pode adaptá-lo, mas a adaptação vale só para ele.",
          )}
        </p>
        <div className="min-w-0 overflow-x-hidden">
          <EditorVisualDeBlocos
            blocos={m.blocos_do_modelo ?? []}
            aoMudar={(novos) => podeEditar && mudar((x) => ({ ...x, blocos_do_modelo: novos }))}
            novoId={randomId}
            rotulos={{ antes: t("Antes"), depois: t("Depois"), abrirLink: t("Abrir link") }}
          />
        </div>
        {podeEditar ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 rounded-xl"
            onClick={() => {
              setM((x) => comBlocos({ ...padraoDoModelo(x.modelo), blocos: x.blocos }));
              setSujo(true);
            }}
          >
            {t("Restaurar o modelo padrão")}
          </Button>
        ) : null}
      </div>

      {podeEditar ? (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className="rounded-xl"
            disabled={!sujo}
            onClick={() => {
              setM(comBlocos(atual));
              setSujo(false);
            }}
          >
            {t("Descartar")}
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={!sujo || salvar.isPending}
            onClick={() => salvar.mutate()}
          >
            {t("Salvar página de atendimento")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** A página de atendimento de CADA tipo: um bloco que abre para editar o modelo, os blocos e o roteiro. */
export function EditorDasPaginasDeAtendimento({ podeEditar }: { podeEditar: boolean }) {
  const t = useT();
  const modelos = useModelosDeAtendimento();
  const matriz = useMatrizDeAtendentes();
  if (modelos.isPending || matriz.isPending)
    return <p className="text-sm text-muted-foreground">{t("Carregando…")}</p>;
  const tipos = matriz.data?.tipos ?? [];
  if (!modelos.data || tipos.length === 0) return null;
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3" data-testid="paginas-de-atendimento">
      <div>
        <h3 className="text-sm font-semibold">{t("Página de atendimento de cada tipo")}</h3>
        <p className="text-xs text-muted-foreground">
          {t(
            "O que o atendente vê ao abrir o compromisso: o roteiro (dentro do editor de blocos), as anotações e a venda. Cada tipo pode ter a sua página.",
          )}
        </p>
      </div>
      {tipos.map((tipo) => {
        const atual = modelos.data![tipo.id];
        if (!atual) return null;
        return (
          <BlocoRecolhivel
            key={tipo.id}
            titulo={tipo.nome}
            resumo={t(ROTULO_DO_MODELO[atual.modelo])}
          >
            <EditorDoTipo tipoId={tipo.id} atual={atual} podeEditar={podeEditar} />
          </BlocoRecolhivel>
        );
      })}
    </div>
  );
}
