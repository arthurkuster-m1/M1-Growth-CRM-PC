"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { Archive, DotsSixVertical, MagnifyingGlass, SlidersHorizontal } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface FunilDaBarra {
  id: string;
  nome: string;
  /** Status da campanha dona do funil, quando houver (planejada, ativa, pausada, encerrada). */
  statusDaCampanha: string | null;
}

interface Props {
  /** Todos os funis, já na ordem escolhida. */
  funis: readonly FunilDaBarra[];
  arquivados: ReadonlySet<string>;
  escolhido: string;
  todosId: string;
  podeOrganizar: boolean;
  aoEscolher: (id: string) => void;
  aoReordenar: (ids: string[]) => void;
  aoArquivar: (ids: string[], arquivar: boolean) => void;
}

const SENSOR = { activationConstraint: { distance: 6 } };

function Pilula({
  funil,
  ativa,
  arrastavel,
  aoEscolher,
}: {
  funil: FunilDaBarra;
  ativa: boolean;
  arrastavel: boolean;
  aoEscolher: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: funil.id,
    disabled: !arrastavel,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={aoEscolher}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="tab"
      aria-selected={ativa}
      className={cn(
        "h-8 max-w-60 shrink-0 truncate rounded-lg border px-3 text-sm font-medium whitespace-nowrap transition-colors",
        isDragging && "z-10 opacity-70 shadow-md",
        ativa
          ? "border-primary bg-primary/10 text-foreground"
          : "bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {funil.nome}
    </button>
  );
}

function LinhaDoGerenciador({
  funil,
  arquivado,
  podeOrganizar,
  aoEscolher,
  aoArquivar,
}: {
  funil: FunilDaBarra;
  arquivado: boolean;
  podeOrganizar: boolean;
  aoEscolher: () => void;
  aoArquivar: () => void;
}) {
  const t = useT();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: funil.id, disabled: !podeOrganizar });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1 rounded-md px-1 py-1 hover:bg-secondary",
        isDragging && "bg-secondary shadow-md",
      )}
    >
      {podeOrganizar ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={t("Arrastar para mudar a ordem")}
          {...attributes}
          {...listeners}
          className="grid h-7 w-6 shrink-0 cursor-grab touch-none place-items-center text-muted-foreground"
        >
          <DotsSixVertical size={14} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        onClick={aoEscolher}
        className="min-w-0 flex-1 truncate text-left text-sm"
        title={funil.nome}
      >
        {funil.nome}
      </button>
      {funil.statusDaCampanha && funil.statusDaCampanha !== "ativa" ? (
        <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase">
          {funil.statusDaCampanha}
        </span>
      ) : null}
      {podeOrganizar ? (
        <button
          type="button"
          onClick={aoArquivar}
          aria-label={arquivado ? t("Tirar do arquivo") : t("Arquivar")}
          title={arquivado ? t("Tirar do arquivo") : t("Arquivar")}
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-card",
            arquivado ? "text-primary" : "text-muted-foreground",
          )}
        >
          <Archive size={14} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/**
 * A linha de funis do CRM, enxuta para o dia a dia: mostra só os funis que NÃO estão
 * arquivados, na ordem que a pessoa escolheu (arrastar muda a ordem). "Arquivados" troca a
 * linha para só os arquivados — para achar lead de campanha antiga — e "Organizar" abre a
 * lista completa com busca, arrastar, arquivar e "arquivar as campanhas pausadas".
 */
export function BarraDeFunis({
  funis,
  arquivados,
  escolhido,
  todosId,
  podeOrganizar,
  aoEscolher,
  aoReordenar,
  aoArquivar,
}: Props) {
  const t = useT();
  const sensores = useSensors(useSensor(PointerSensor, SENSOR));
  const [verArquivados, setVerArquivados] = useState(false);
  const [busca, setBusca] = useState("");

  const ativos = funis.filter((f) => !arquivados.has(f.id));
  const doArquivo = funis.filter((f) => arquivados.has(f.id));
  const mostrados = verArquivados ? doArquivo : ativos;
  // O funil aberto fica sempre à vista, mesmo arquivado (senão a tela abriria "sem seleção").
  const fixado = funis.find((f) => f.id === escolhido && !mostrados.some((m) => m.id === f.id));
  const naLinha = fixado ? [...mostrados, fixado] : mostrados;

  const pausadas = funis.filter(
    (f) =>
      !arquivados.has(f.id) &&
      (f.statusDaCampanha === "pausada" || f.statusDaCampanha === "encerrada"),
  );

  const termo = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const doGerenciador = funis.filter(
    (f) =>
      termo === "" || f.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(termo),
  );

  function terminou(e: DragEndEvent, lista: readonly FunilDaBarra[]) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = lista.map((f) => f.id);
    const de = ids.indexOf(String(active.id));
    const para = ids.indexOf(String(over.id));
    if (de < 0 || para < 0) return;
    // Só reordena o que está na tela; o resto mantém o lugar relativo.
    const novaLista = arrayMove(ids, de, para);
    const fora = funis.map((f) => f.id).filter((id) => !ids.includes(id));
    aoReordenar([...novaLista, ...fora]);
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div
        role="tablist"
        aria-label={t("Funis")}
        className="-mx-1 flex min-w-0 [scrollbar-width:none] items-center gap-1 overflow-x-auto px-1 py-0.5 [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          role="tab"
          aria-selected={escolhido === todosId}
          onClick={() => aoEscolher(todosId)}
          className={cn(
            "h-8 shrink-0 rounded-lg border px-3 text-sm font-medium whitespace-nowrap transition-colors",
            escolhido === todosId
              ? "border-primary bg-primary/10 text-foreground"
              : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {t("Todos")}
        </button>
        <DndContext
          sensors={sensores}
          collisionDetection={closestCenter}
          onDragEnd={(e) => terminou(e, naLinha)}
        >
          <SortableContext
            items={naLinha.map((f) => f.id)}
            strategy={horizontalListSortingStrategy}
          >
            {naLinha.map((f) => (
              <Pilula
                key={f.id}
                funil={f}
                ativa={f.id === escolhido}
                arrastavel={podeOrganizar && !verArquivados}
                aoEscolher={() => aoEscolher(f.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {naLinha.length === 0 ? (
          <span className="px-2 text-xs text-muted-foreground">
            {verArquivados ? t("Nenhum funil arquivado.") : t("Nenhum funil ainda.")}
          </span>
        ) : null}
      </div>

      {doArquivo.length > 0 || verArquivados ? (
        <button
          type="button"
          aria-pressed={verArquivados}
          onClick={() => setVerArquivados((v) => !v)}
          className={cn(
            "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap",
            verArquivados
              ? "border-primary bg-primary/10"
              : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          <Archive size={13} aria-hidden />
          {t("Arquivados")} · {doArquivo.length}
        </button>
      ) : null}

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground hover:text-foreground"
          >
            <SlidersHorizontal size={13} aria-hidden />
            {t("Funis")}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(92vw,360px)] p-2">
          <label className="relative block">
            <span className="sr-only">{t("Buscar funil")}</span>
            <MagnifyingGlass
              size={14}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={t("Buscar funil")}
              className="h-8 w-full rounded-lg border bg-background pr-2 pl-8 text-sm outline-hidden focus:border-primary/50"
            />
          </label>
          <div className="mt-2 max-h-72 overflow-y-auto">
            <DndContext
              sensors={sensores}
              collisionDetection={closestCenter}
              onDragEnd={(e) => terminou(e, funis)}
            >
              <SortableContext
                items={doGerenciador.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {doGerenciador.map((f) => (
                  <LinhaDoGerenciador
                    key={f.id}
                    funil={f}
                    arquivado={arquivados.has(f.id)}
                    podeOrganizar={podeOrganizar && termo === ""}
                    aoEscolher={() => aoEscolher(f.id)}
                    aoArquivar={() => aoArquivar([f.id], !arquivados.has(f.id))}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {doGerenciador.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {t("Nenhum funil encontrado.")}
              </p>
            ) : null}
          </div>
          {podeOrganizar ? (
            <div className="mt-2 flex flex-col gap-1 border-t pt-2">
              <button
                type="button"
                disabled={pausadas.length === 0}
                onClick={() =>
                  aoArquivar(
                    pausadas.map((f) => f.id),
                    true,
                  )
                }
                className="rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary disabled:opacity-40"
              >
                {t("Arquivar funis de campanhas pausadas ou encerradas")}
                {pausadas.length > 0 ? ` (${pausadas.length})` : ""}
              </button>
              <button
                type="button"
                disabled={doArquivo.length === 0}
                onClick={() =>
                  aoArquivar(
                    doArquivo.map((f) => f.id),
                    false,
                  )
                }
                className="rounded-md px-2 py-1.5 text-left text-xs hover:bg-secondary disabled:opacity-40"
              >
                {t("Tirar todos do arquivo")}
              </button>
              <p className="px-2 text-[11px] text-muted-foreground">
                {t(
                  "Arquivar só tira o funil da linha de cima: os leads continuam em Todos e a busca os encontra.",
                )}
              </p>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
