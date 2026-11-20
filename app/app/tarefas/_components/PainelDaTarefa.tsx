"use client";

import { useEffect, useRef, useState } from "react";

import { EditorDeBlocos } from "@/components/editor/EditorDeBlocos";
import { escreverBlocos, LIMITE_DA_DESCRICAO, lerBlocos, type Bloco } from "@/lib/tarefas/blocos";

import type { ColunaDoMotor } from "@/components/motor/TabelaDoMotor";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useT } from "@/hooks/i18n/useT";
import type { Tarefa } from "@/lib/tarefas/tipos";
import { Trash } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

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
 * O PAINEL DA TAREFA — a página lateral que abre ao clicar numa tarefa, em qualquer
 * visualização (como o "peek" do Notion): sai da direita, larga o bastante para escrever. Título
 * grande, uma linha por propriedade e a descrição por baixo, com a maior parte da altura. Só o
 * miolo rola; o título e o rodapé (Criar / Apagar) ficam sempre à vista.
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
    (c) =>
      c.id !== "titulo" &&
      c.id !== "descricao" &&
      !(nova && (c.id === "criada" || c.id === "tempo")),
  );

  return (
    <Sheet open={tarefa !== null} onOpenChange={(aberto) => !aberto && aoFechar()}>
      {/* A tarefa já está aberta: o botão "Abrir" da linha da tabela fica escondido aqui dentro. */}
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:w-[46rem] sm:max-w-[94vw] [&>*]:min-w-0"
      >
        {tarefa ? (
          <>
            <SheetTitle className="sr-only">{nova ? t("Nova tarefa") : tarefa.title}</SheetTitle>
            <SheetDescription className="sr-only">{t("Propriedades da tarefa")}</SheetDescription>
            <div className="shrink-0 px-4 pt-5 pb-3 sm:px-8 sm:pt-7">
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
                    className="w-full rounded-xl border bg-card px-3 py-2 text-xl font-semibold outline-hidden placeholder:font-normal focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              ) : (
                <div className="min-w-0 pr-8 text-2xl font-semibold [overflow-wrap:anywhere] [&_[data-abrir-tarefa]]:hidden [&_button]:text-2xl [&_input]:text-xl">
                  {titulo?.celula(tarefa)}
                </div>
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto px-4 pb-6 sm:px-8">
              <dl className="grid shrink-0 gap-1">
                {propriedades.map((c) => (
                  <div
                    key={c.id}
                    className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-2 max-sm:grid-cols-[6rem_minmax(0,1fr)]"
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
            </div>
            {nova ? (
              <div className="flex shrink-0 justify-end gap-2 border-t px-4 py-3 sm:px-8">
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
              <div className="flex shrink-0 justify-end border-t px-4 py-3 sm:px-8">
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
      </SheetContent>
    </Sheet>
  );
}

/** Põe o cursor no fim do último bloco de texto da caixa (o clique no espaço vazio embaixo). */
function focarOUltimoBloco(caixa: HTMLElement) {
  const blocos = caixa.querySelectorAll<HTMLElement>("[data-bloco]");
  const ultimo = blocos[blocos.length - 1];
  if (!ultimo) return;
  ultimo.focus();
  if (ultimo instanceof HTMLTextAreaElement || ultimo instanceof HTMLInputElement) {
    const fim = ultimo.value.length;
    ultimo.setSelectionRange(fim, fim);
  }
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
    <div
      className="flex min-h-[18rem] flex-1 flex-col"
      onBlur={(e) => !aCadaTecla && !e.currentTarget.contains(e.relatedTarget) && gravar()}
    >
      <p className="mb-1 block text-sm text-muted-foreground">{t("Descrição")}</p>
      <div
        // O espaço vazio da caixa também é "campo": clicar nele leva o cursor ao fim do texto.
        onClick={(e) =>
          e.target === e.currentTarget && podeEditar && focarOUltimoBloco(e.currentTarget)
        }
        className={cn(
          "min-h-0 flex-1 rounded-xl border bg-card px-3 py-3 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20",
          podeEditar && "cursor-text",
        )}
      >
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
