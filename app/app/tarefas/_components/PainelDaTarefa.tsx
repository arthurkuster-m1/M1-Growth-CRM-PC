"use client";

import { useEffect, useRef, useState } from "react";

import { EditorDeBlocos } from "@/components/editor/EditorDeBlocos";
import { escreverBlocos, LIMITE_DA_DESCRICAO, lerBlocos, type Bloco } from "@/lib/tarefas/blocos";

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
  /**
   * Modo "Nova tarefa": a tarefa é um RASCUNHO que ainda não existe no banco. O título vira um
   * campo simples, a descrição vale a cada tecla e o rodapé troca "Apagar" por "Criar tarefa".
   */
  nova?: {
    aoCriar: () => void;
    aoMudarTitulo: (titulo: string) => void;
  };
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
  nova,
}: Props) {
  const t = useT();
  const titulo = colunas.find((c) => c.id === "titulo");
  const propriedades = colunas.filter(
    (c) => c.id !== "titulo" && c.id !== "descricao" && !(nova && c.id === "criada"),
  );

  return (
    <Dialog open={tarefa !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-w-2xl gap-5 overflow-x-hidden p-5 sm:rounded-2xl sm:p-6 [&>*]:min-w-0">
        {tarefa ? (
          <>
            <DialogTitle className="sr-only">{nova ? t("Nova tarefa") : tarefa.title}</DialogTitle>
            <DialogDescription className="sr-only">{t("Propriedades da tarefa")}</DialogDescription>
            {nova ? (
              <div className="min-w-0 pr-8">
                <p className="mb-1 text-xs font-semibold tracking-wider text-text-subtle uppercase">
                  {t("Nova tarefa")}
                </p>
                <input
                  autoFocus
                  value={tarefa.title}
                  maxLength={255}
                  placeholder={t("Título da tarefa")}
                  aria-label={t("Título da tarefa")}
                  onChange={(e) => nova.aoMudarTitulo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      nova.aoCriar();
                    }
                  }}
                  className="w-full rounded-xl border bg-background px-3 py-2 text-xl font-semibold outline-hidden placeholder:font-normal focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </div>
            ) : (
              <div className="min-w-0 pr-8 text-xl font-semibold [overflow-wrap:anywhere] [&_button]:text-xl [&_input]:text-lg">
                {titulo?.celula(tarefa)}
              </div>
            )}
            <dl className="grid gap-1">
              {propriedades.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2 max-sm:grid-cols-[6rem_minmax(0,1fr)]"
                >
                  <dt className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                    {c.icone}
                    <span className="truncate">{c.titulo}</span>
                  </dt>
                  <dd className="min-w-0">{c.celula(tarefa)}</dd>
                </div>
              ))}
            </dl>
            <Descricao
              key={tarefa.id}
              valor={tarefa.description ?? ""}
              podeEditar={podeEditar}
              aoSalvar={(texto) => aoSalvarDescricao(tarefa, texto)}
              aCadaTecla={nova !== undefined}
            />
            {nova ? (
              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={aoFechar}
                  className="inline-flex h-10 items-center rounded-xl border px-4 text-sm font-medium hover:bg-secondary"
                >
                  {t("Cancelar")}
                </button>
                <button
                  type="button"
                  onClick={nova.aoCriar}
                  className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-[var(--color-accent-hover)]"
                >
                  {t("Criar tarefa")}
                </button>
              </div>
            ) : podeEditar ? (
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
  aCadaTecla = false,
}: {
  valor: string;
  podeEditar: boolean;
  aoSalvar: (texto: string | null) => void;
  /** No rascunho da tarefa nova, o texto vale a cada tecla: não há "sair do campo" para salvar. */
  aCadaTecla?: boolean;
}) {
  const t = useT();
  const [blocos, setBlocos] = useState(() => lerBlocos(valor));
  const [grandeDemais, setGrandeDemais] = useState(false);
  const pendente = useRef<string | null | undefined>(undefined);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const salvar = useRef(aoSalvar);
  useEffect(() => {
    salvar.current = aoSalvar;
  });

  const gravar = () => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    if (pendente.current === undefined) return;
    const texto = pendente.current;
    pendente.current = undefined;
    salvar.current(texto);
  };
  // Fechar o painel (ou trocar de tarefa) não perde o que ainda não foi gravado.
  useEffect(() => () => gravar(), []);

  const mudar = (novos: Bloco[]) => {
    setBlocos(novos);
    const texto = escreverBlocos(novos);
    if (texto !== null && texto.length > LIMITE_DA_DESCRICAO) {
      setGrandeDemais(true);
      return;
    }
    setGrandeDemais(false);
    pendente.current = texto;
    if (aCadaTecla) return gravar();
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(gravar, 700);
  };

  return (
    <div onBlur={(e) => !aCadaTecla && !e.currentTarget.contains(e.relatedTarget) && gravar()}>
      <p className="mb-1 block text-sm text-muted-foreground">{t("Descrição")}</p>
      <div className="rounded-xl border bg-background px-2 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
        <EditorDeBlocos blocos={blocos} aoMudar={mudar} podeEditar={podeEditar} />
      </div>
      {grandeDemais ? (
        <p role="alert" className="mt-1 text-xs text-error-fg">
          {t("A descrição ficou grande demais — as últimas alterações não foram salvas.")}
        </p>
      ) : null}
    </div>
  );
}
