"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { useT } from "@/hooks/i18n/useT";
import { LIMITE_DE_PASSOS, padraoDoModelo, type ModeloDeAtendimentoDoTipo } from "@/lib/agenda/modelos-de-atendimento";
import { ROTULO_DO_MODELO } from "@/lib/agenda/atendimentos";
import { apiClient } from "@/lib/api/client";
import { ArrowDown, ArrowUp, Plus, Trash } from "@/lib/ui/icons";

import { BlocoRecolhivel } from "./BlocoRecolhivel";
import { useMatrizDeAtendentes } from "./equipe-hooks";
import { useModelosDeAtendimento } from "./modelos-hooks";

const BLOCOS: Array<{ id: keyof ModeloDeAtendimentoDoTipo["blocos"]; rotulo: string; dica: string }> = [
  { id: "roteiro", rotulo: "Roteiro", dica: "Os passos que o atendente segue, com dica de cada um." },
  { id: "anotacoes", rotulo: "Anotações", dica: "O espaço para escrever o que foi falado." },
  { id: "oportunidade", rotulo: "Oportunidade e venda", dica: "A oportunidade, a venda e as parcelas dentro do compromisso." },
  { id: "ia", rotulo: "Recomendações da IA ao vivo", dica: "Sugestões durante a reunião (em breve)." },
];

function EditorDoTipo({ tipoId, atual, podeEditar }: { tipoId: string; atual: ModeloDeAtendimentoDoTipo; podeEditar: boolean }) {
  const t = useT();
  const qc = useQueryClient();
  const [m, setM] = React.useState<ModeloDeAtendimentoDoTipo>(atual);
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
      }),
    onSuccess: () => {
      toast.success(t("Página de atendimento salva."));
      setSujo(false);
      void qc.invalidateQueries({ queryKey: ["agenda", "modelos-de-atendimento"] });
    },
    onError: showApiError,
  });

  const mover = (i: number, d: -1 | 1) =>
    mudar((x) => {
      const r = [...x.roteiro];
      const j = i + d;
      if (j < 0 || j >= r.length) return x;
      [r[i], r[j]] = [r[j]!, r[i]!];
      return { ...x, roteiro: r };
    });

  return (
    <div className="grid gap-5">
      <div className="grid gap-1 sm:max-w-sm">
        <p className="text-sm font-medium">{t("Modelo da página")}</p>
        <SeletorEmPopup
          rotulo={t("Modelo da página de atendimento")}
          valor={m.modelo}
          desabilitado={!podeEditar}
          opcoes={(["vendas", "padrao"] as const).map((id) => ({ id, rotulo: t(ROTULO_DO_MODELO[id]) }))}
          aoEscolher={(id) => {
            if (id === m.modelo) return;
            // Trocar de modelo traz o padrão dele (blocos e roteiro); dá para ajustar depois.
            setM(padraoDoModelo(id as ModeloDeAtendimentoDoTipo["modelo"]));
            setSujo(true);
          }}
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">{t("O que aparece na página do compromisso")}</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {BLOCOS.map((b) => (
            <li key={b.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-background px-3 py-2">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  disabled={!podeEditar}
                  checked={m.blocos[b.id]}
                  onChange={(e) => mudar((x) => ({ ...x, blocos: { ...x.blocos, [b.id]: e.target.checked } }))}
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

      {m.blocos.roteiro ? (
        <div>
          <p className="mb-2 text-sm font-medium">{t("Roteiro de atendimento")}</p>
          <ol className="grid gap-2">
            {m.roteiro.map((p, i) => (
              <li key={i} className="grid gap-2 rounded-xl border border-border bg-background p-3 sm:grid-cols-[1fr_2fr_auto]">
                <input
                  aria-label={`${t("Título do passo")} ${i + 1}`}
                  value={p.titulo}
                  maxLength={80}
                  disabled={!podeEditar}
                  placeholder={t("Título do passo")}
                  onChange={(e) => mudar((x) => ({ ...x, roteiro: x.roteiro.map((q, k) => (k === i ? { ...q, titulo: e.target.value } : q)) }))}
                  className="h-9 rounded-xl border border-border bg-surface px-3 text-sm"
                />
                <input
                  aria-label={`${t("Dica do passo")} ${i + 1}`}
                  value={p.dica}
                  maxLength={300}
                  disabled={!podeEditar}
                  placeholder={t("Dica: o que fazer ou perguntar")}
                  onChange={(e) => mudar((x) => ({ ...x, roteiro: x.roteiro.map((q, k) => (k === i ? { ...q, dica: e.target.value } : q)) }))}
                  className="h-9 rounded-xl border border-border bg-surface px-3 text-sm"
                />
                {podeEditar ? (
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" aria-label={t("Subir passo")} disabled={i === 0} onClick={() => mover(i, -1)}>
                      <ArrowUp size={16} aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label={t("Descer passo")} disabled={i === m.roteiro.length - 1} onClick={() => mover(i, 1)}>
                      <ArrowDown size={16} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("Remover passo")}
                      onClick={() => mudar((x) => ({ ...x, roteiro: x.roteiro.filter((_, k) => k !== i) }))}
                    >
                      <Trash size={16} aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          {podeEditar && m.roteiro.length < LIMITE_DE_PASSOS ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 gap-1.5 rounded-xl"
              onClick={() => mudar((x) => ({ ...x, roteiro: [...x.roteiro, { titulo: "", dica: "" }] }))}
            >
              <Plus size={14} aria-hidden />
              {t("Adicionar passo")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {podeEditar ? (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" className="rounded-xl" disabled={!sujo} onClick={() => { setM(atual); setSujo(false); }}>
            {t("Descartar")}
          </Button>
          <Button type="button" className="rounded-xl" disabled={!sujo || salvar.isPending} onClick={() => salvar.mutate()}>
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
  if (modelos.isPending || matriz.isPending) return <p className="text-sm text-muted-foreground">{t("Carregando…")}</p>;
  const tipos = matriz.data?.tipos ?? [];
  if (!modelos.data || tipos.length === 0) return null;
  return (
    <div className="grid gap-3" data-testid="paginas-de-atendimento">
      <div>
        <h3 className="text-sm font-semibold">{t("Página de atendimento de cada tipo")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("O que o atendente vê ao abrir o compromisso: o roteiro, as anotações e a venda. Cada tipo pode ter a sua página.")}
        </p>
      </div>
      {tipos.map((tipo) => {
        const atual = modelos.data![tipo.id];
        if (!atual) return null;
        return (
          <BlocoRecolhivel key={tipo.id} titulo={tipo.nome} resumo={t(ROTULO_DO_MODELO[atual.modelo])}>
            <EditorDoTipo tipoId={tipo.id} atual={atual} podeEditar={podeEditar} />
          </BlocoRecolhivel>
        );
      })}
    </div>
  );
}
