"use client";

import { useState } from "react";

import type { ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
import type { Tarefa } from "@/lib/tarefas/tipos";
import { Trash } from "@/lib/ui/icons";

interface Props {
  tarefa: Tarefa | null;
  colunas: ColunaDoMotor<Tarefa>[];
  podeEditar: boolean;
  aoSalvarDescricao: (tarefa: Tarefa, texto: string | null) => void;
  aoApagar: (tarefa: Tarefa) => void;
  aoFechar: () => void;
}

/**
 * O PAINEL DA TAREFA — o pop-up que abre ao clicar numa tarefa, em qualquer visualização
 * (como a página da tarefa do Notion). Título grande, uma linha por propriedade e a
 * descrição por baixo.
 *
 * Não tem campo próprio: cada linha é a MESMA célula editável da tabela (`coluna.celula`),
 * então tudo o que se edita lá — status, prioridade, início, prazo, responsável, as
 * propriedades personalizadas — se edita aqui do mesmo jeito, e uma coluna nova da tabela
 * aparece no painel sem tocar neste arquivo.
 */
export function PainelDaTarefa({
  tarefa,
  colunas,
  podeEditar,
  aoSalvarDescricao,
  aoApagar,
  aoFechar,
}: Props) {
  const t = useT();
  const titulo = colunas.find((c) => c.id === "titulo");
  const propriedades = colunas.filter((c) => c.id !== "titulo" && c.id !== "descricao");

  return (
    <Dialog open={tarefa !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-w-xl gap-5 p-5 sm:rounded-2xl sm:p-6">
        {tarefa ? (
          <>
            <DialogTitle className="sr-only">{tarefa.title}</DialogTitle>
            <DialogDescription className="sr-only">{t("Propriedades da tarefa")}</DialogDescription>
            <div className="pr-8 text-xl font-semibold [&_button]:text-xl [&_input]:text-lg">
              {titulo?.celula(tarefa)}
            </div>
            <dl className="grid gap-1">
              {propriedades.map((c) => (
                <div key={c.id} className="grid grid-cols-[7.5rem_1fr] items-center gap-2">
                  <dt className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                    {c.icone}
                    <span className="truncate">{c.titulo}</span>
                  </dt>
                  <dd className="min-w-0">{c.celula(tarefa)}</dd>
                </div>
              ))}
            </dl>
            <Descricao
              key={`${tarefa.id}:${tarefa.description ?? ""}`}
              valor={tarefa.description ?? ""}
              podeEditar={podeEditar}
              aoSalvar={(texto) => aoSalvarDescricao(tarefa, texto)}
            />
            {podeEditar ? (
              <div className="flex justify-end border-t pt-3">
                <button
                  type="button"
                  onClick={() => aoApagar(tarefa)}
                  className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm text-error-fg transition-colors hover:bg-error-bg"
                >
                  <Trash size={14} aria-hidden />
                  {t("Apagar tarefa")}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Descricao({
  valor,
  podeEditar,
  aoSalvar,
}: {
  valor: string;
  podeEditar: boolean;
  aoSalvar: (texto: string | null) => void;
}) {
  const t = useT();
  const [rascunho, setRascunho] = useState(valor);

  return (
    <div>
      <label htmlFor="descricao-da-tarefa" className="mb-1 block text-sm text-muted-foreground">
        {t("Descrição")}
      </label>
      <textarea
        id="descricao-da-tarefa"
        value={rascunho}
        readOnly={!podeEditar}
        maxLength={5000}
        rows={5}
        placeholder={podeEditar ? t("Escreva uma descrição…") : undefined}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={() => {
          const novo = rascunho.trim();
          if (novo !== valor.trim()) aoSalvar(novo === "" ? null : novo);
        }}
        className="w-full resize-y rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}
