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
import { useEffect, useState } from "react";

import { rotuloDoCanal } from "@/components/marketing/campanhas/rotulos";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { CANAIS_DA_CAMPANHA, type CanalDaCampanha } from "@/lib/marketing/campanhas";
import {
  Archive,
  CaretDown,
  DotsSixVertical,
  Funnel,
  MagnifyingGlass,
  SlidersHorizontal,
} from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface FunilDaBarra {
  id: string;
  nome: string;
  /** Status da campanha dona do funil, quando houver (planejada, ativa, pausada, encerrada). */
  statusDaCampanha: string | null;
  /** Canal da campanha dona do funil, quando houver. */
  canal: string | null;
}

export interface FiltrosDaBarra {
  status: string[];
  canais: string[];
}

interface Props {
  /** Todos os funis, já na ordem escolhida. */
  funis: readonly FunilDaBarra[];
  arquivados: ReadonlySet<string>;
  filtros: FiltrosDaBarra;
  escolhido: string;
  todosId: string;
  /** Esconde o "Todos" (a tela só faz sentido com UM funil). */
  semTodos?: boolean;
  /** O rótulo do "Todos" (Oportunidades usa "Todas"). */
  rotuloTodos?: string;
  podeOrganizar: boolean;
  aoEscolher: (id: string) => void;
  aoReordenar: (ids: string[]) => void;
  aoArquivar: (ids: string[], arquivar: boolean) => void;
  aoFiltrar: (filtros: FiltrosDaBarra) => void;
}

const SENSOR = { activationConstraint: { distance: 6 } };
const STATUS = ["ativa", "planejada", "pausada", "encerrada", "sem_campanha"] as const;

const COR_DO_STATUS: Record<string, string> = {
  ativa: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  planejada: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  pausada: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  encerrada: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  sem_campanha: "bg-secondary text-muted-foreground",
};

function useRotuloDoStatus() {
  const t = useT();
  return (s: string | null) => {
    switch (s) {
      case "ativa":
        return t("Ativa");
      case "planejada":
        return t("Planejada");
      case "pausada":
        return t("Pausada");
      case "encerrada":
        return t("Encerrada");
      default:
        return t("Sem campanha");
    }
  };
}

function EtiquetaDeStatus({ funil }: { funil: FunilDaBarra }) {
  const rotulo = useRotuloDoStatus();
  const chave = funil.statusDaCampanha ?? "sem_campanha";
  return (
    <span
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase",
        COR_DO_STATUS[chave] ?? COR_DO_STATUS.sem_campanha,
      )}
    >
      {rotulo(funil.statusDaCampanha)}
    </span>
  );
}

function Pilula({
  funil,
  ativa,
  arrastavel,
  aoEscolher,
  aoMenu,
}: {
  funil: FunilDaBarra;
  ativa: boolean;
  arrastavel: boolean;
  aoEscolher: () => void;
  aoMenu: (x: number, y: number) => void;
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
      onContextMenu={(e) => {
        e.preventDefault();
        aoMenu(e.clientX, e.clientY);
      }}
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
  arrastavel,
  aoEscolher,
  aoArquivar,
}: {
  funil: FunilDaBarra;
  arquivado: boolean;
  podeOrganizar: boolean;
  arrastavel: boolean;
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
  } = useSortable({ id: funil.id, disabled: !arrastavel });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1 rounded-md px-1 py-1 hover:bg-secondary",
        arquivado && "opacity-70",
        isDragging && "bg-secondary shadow-md",
      )}
    >
      {arrastavel ? (
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
      ) : (
        <span className="w-6 shrink-0" aria-hidden />
      )}
      <button
        type="button"
        onClick={aoEscolher}
        className="min-w-0 flex-1 truncate text-left text-sm"
        title={funil.nome}
      >
        {funil.nome}
      </button>
      {arquivado ? (
        <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
          {t("Arquivado")}
        </span>
      ) : null}
      <EtiquetaDeStatus funil={funil} />
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
          <Archive size={14} weight={arquivado ? "fill" : "regular"} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function alternar<T>(lista: T[], item: T): T[] {
  return lista.includes(item) ? lista.filter((v) => v !== item) : [...lista, item];
}

/**
 * A linha de funis do CRM, enxuta para o dia a dia: mostra só os funis que NÃO estão
 * arquivados e passam nos filtros, na ordem que a pessoa escolheu (arrastar muda a ordem).
 * Botão direito numa pílula arquiva. "Arquivados" troca a linha para só os arquivados — para
 * achar lead de campanha antiga — e "Funis" abre a lista completa com busca, arrastar,
 * arquivar e o status de cada campanha.
 */
export function BarraDeFunis({
  funis,
  arquivados,
  filtros,
  escolhido,
  todosId,
  semTodos = false,
  rotuloTodos,
  podeOrganizar,
  aoEscolher,
  aoReordenar,
  aoArquivar,
  aoFiltrar,
}: Props) {
  const t = useT();
  const rotuloDoStatus = useRotuloDoStatus();
  const sensores = useSensors(useSensor(PointerSensor, SENSOR));
  const [verArquivados, setVerArquivados] = useState(false);
  const [busca, setBusca] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  // O menu do botão direito fecha com Esc, com rolagem e ao clicar fora.
  useEffect(() => {
    if (!menu) return;
    const fechar = () => setMenu(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("click", fechar);
    window.addEventListener("scroll", fechar, true);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("click", fechar);
      window.removeEventListener("scroll", fechar, true);
      window.removeEventListener("keydown", esc);
    };
  }, [menu]);

  const passaNoFiltro = (f: FunilDaBarra) => {
    if (filtros.status.length > 0) {
      const chave = f.statusDaCampanha ?? "sem_campanha";
      if (!filtros.status.includes(chave)) return false;
    }
    if (filtros.canais.length > 0) {
      if (!f.canal || !filtros.canais.includes(f.canal)) return false;
    }
    return true;
  };
  const filtrando = filtros.status.length + filtros.canais.length;

  const ativos = funis.filter((f) => !arquivados.has(f.id));
  const doArquivo = funis.filter((f) => arquivados.has(f.id));
  const mostrados = (verArquivados ? doArquivo : ativos).filter(passaNoFiltro);
  // O funil aberto fica sempre à vista, mesmo arquivado ou filtrado (senão a tela abriria "sem seleção").
  const fixado = funis.find((f) => f.id === escolhido && !mostrados.some((m) => m.id === f.id));
  const naLinha = fixado ? [...mostrados, fixado] : mostrados;

  const pausadas = funis.filter(
    (f) =>
      !arquivados.has(f.id) &&
      (f.statusDaCampanha === "pausada" || f.statusDaCampanha === "encerrada"),
  );

  const termo = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const bate = (f: FunilDaBarra) =>
    termo === "" || f.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(termo);
  // Na lista completa os arquivados vão para o fim, marcados.
  const ativosDaLista = ativos.filter(bate);
  const arquivadosDaLista = doArquivo.filter(bate);

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

  const doMenu = menu ? funis.find((f) => f.id === menu.id) : undefined;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <div
        role="tablist"
        aria-label={t("Funis")}
        // No celular as campanhas ocupam a linha toda; Filtrar, Arquivados e Funis descem.
        className="-mx-1 flex min-w-0 [scrollbar-width:none] items-center gap-1 overflow-x-auto px-1 py-0.5 max-sm:w-[calc(100%+0.5rem)] [&::-webkit-scrollbar]:hidden"
      >
        {semTodos ? null : (
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
            {rotuloTodos ?? t("Todos")}
          </button>
        )}
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
                arrastavel={podeOrganizar && !verArquivados && filtrando === 0}
                aoEscolher={() => aoEscolher(f.id)}
                aoMenu={(x, y) => podeOrganizar && setMenu({ x, y, id: f.id })}
              />
            ))}
          </SortableContext>
        </DndContext>
        {naLinha.length === 0 ? (
          <span className="px-2 text-xs text-muted-foreground">
            {verArquivados
              ? t("Nenhum funil arquivado.")
              : filtrando > 0
                ? t("Nenhum funil combina com os filtros.")
                : t("Nenhum funil ainda.")}
          </span>
        ) : null}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium whitespace-nowrap",
              filtrando > 0
                ? "border-primary bg-primary/10"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <Funnel size={13} aria-hidden />
            {t("Filtrar")}
            {filtrando > 0 ? ` · ${filtrando}` : ""}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(92vw,300px)] p-3">
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Status da campanha")}
          </p>
          <div className="grid gap-0.5">
            {STATUS.map((s) => (
              <label
                key={s}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
              >
                <input
                  type="checkbox"
                  checked={filtros.status.includes(s)}
                  onChange={() => aoFiltrar({ ...filtros, status: alternar(filtros.status, s) })}
                  className="h-4 w-4 accent-primary"
                />
                {rotuloDoStatus(s === "sem_campanha" ? null : s)}
              </label>
            ))}
          </div>
          <p className="mt-3 mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Canal")}
          </p>
          <div className="grid gap-0.5">
            {CANAIS_DA_CAMPANHA.map((c: CanalDaCampanha) => (
              <label
                key={c}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
              >
                <input
                  type="checkbox"
                  checked={filtros.canais.includes(c)}
                  onChange={() => aoFiltrar({ ...filtros, canais: alternar(filtros.canais, c) })}
                  className="h-4 w-4 accent-primary"
                />
                {rotuloDoCanal(t, c)}
              </label>
            ))}
          </div>
          {filtrando > 0 ? (
            <button
              type="button"
              onClick={() => aoFiltrar({ status: [], canais: [] })}
              className="mt-3 h-9 w-full rounded-lg border text-sm font-medium hover:bg-secondary"
            >
              {t("Limpar filtros")}
            </button>
          ) : null}
        </PopoverContent>
      </Popover>

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
        <PopoverContent align="end" className="w-[min(92vw,400px)] p-2">
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
              className="h-8 w-full rounded-xl border bg-background pr-2 pl-8 text-sm outline-hidden focus:border-primary/50"
            />
          </label>
          <div className="mt-2 max-h-72 overflow-y-auto overscroll-contain">
            <DndContext
              sensors={sensores}
              collisionDetection={closestCenter}
              onDragEnd={(e) => terminou(e, ativosDaLista)}
            >
              <SortableContext
                items={ativosDaLista.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {ativosDaLista.map((f) => (
                  <LinhaDoGerenciador
                    key={f.id}
                    funil={f}
                    arquivado={false}
                    podeOrganizar={podeOrganizar}
                    arrastavel={podeOrganizar && termo === ""}
                    aoEscolher={() => aoEscolher(f.id)}
                    aoArquivar={() => aoArquivar([f.id], true)}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {arquivadosDaLista.length > 0 ? (
              <>
                <p className="mt-2 px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("Arquivados")} · {arquivadosDaLista.length}
                </p>
                {arquivadosDaLista.map((f) => (
                  <LinhaDoGerenciador
                    key={f.id}
                    funil={f}
                    arquivado
                    podeOrganizar={podeOrganizar}
                    arrastavel={false}
                    aoEscolher={() => aoEscolher(f.id)}
                    aoArquivar={() => aoArquivar([f.id], false)}
                  />
                ))}
              </>
            ) : null}
            {ativosDaLista.length + arquivadosDaLista.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {t("Nenhum funil encontrado.")}
              </p>
            ) : null}
          </div>
          {podeOrganizar ? (
            <div className="mt-2 grid gap-1.5 border-t pt-2">
              <button
                type="button"
                disabled={pausadas.length === 0}
                onClick={() =>
                  aoArquivar(
                    pausadas.map((f) => f.id),
                    true,
                  )
                }
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-secondary disabled:opacity-40"
              >
                <Archive size={14} aria-hidden />
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
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-secondary disabled:opacity-40"
              >
                {t("Tirar todos do arquivo")}
              </button>
              <p className="px-1 text-[11px] text-muted-foreground">
                {t(
                  "Arquivar só tira o funil da linha de cima: os leads continuam em Todos e a busca os encontra.",
                )}
              </p>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      {menu && doMenu ? (
        <div
          role="menu"
          style={{ left: menu.x, top: menu.y }}
          className="fixed z-50 min-w-48 rounded-xl border bg-popover p-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="max-w-64 truncate px-2 py-1 text-xs text-muted-foreground">{doMenu.nome}</p>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              aoArquivar([doMenu.id], !arquivados.has(doMenu.id));
              setMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary"
          >
            <Archive size={14} aria-hidden />
            {arquivados.has(doMenu.id) ? t("Tirar do arquivo") : t("Arquivar funil")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function LinhaDeSelecao({
  funil,
  marcado,
  arquivado,
  podeOrganizar,
  arrastavel,
  aoMarcar,
  aoArquivar,
}: {
  funil: FunilDaBarra;
  marcado: boolean;
  arquivado: boolean;
  podeOrganizar: boolean;
  arrastavel: boolean;
  aoMarcar: () => void;
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
  } = useSortable({ id: funil.id, disabled: !arrastavel });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-secondary",
        isDragging && "bg-secondary shadow-md",
      )}
    >
      {arrastavel ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={t("Arrastar para mudar a ordem")}
          {...attributes}
          {...listeners}
          className="grid h-8 w-6 shrink-0 cursor-grab touch-none place-items-center text-muted-foreground"
        >
          <DotsSixVertical size={14} aria-hidden />
        </button>
      ) : (
        <span className="w-1 shrink-0" aria-hidden />
      )}
      <label className="flex min-h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={marcado}
          onChange={aoMarcar}
          className="h-4 w-4 shrink-0 accent-primary"
        />
        <span className="min-w-0 flex-1 truncate" title={funil.nome}>
          {funil.nome}
        </span>
      </label>
      <EtiquetaDeStatus funil={funil} />
      {podeOrganizar ? (
        <button
          type="button"
          onClick={aoArquivar}
          aria-label={arquivado ? t("Tirar do arquivo") : t("Arquivar")}
          title={arquivado ? t("Tirar do arquivo") : t("Arquivar")}
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-card",
            arquivado ? "text-primary" : "text-muted-foreground",
          )}
        >
          <Archive size={14} weight={arquivado ? "fill" : "regular"} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

interface PropsDoSeletor {
  funis: readonly FunilDaBarra[];
  arquivados: ReadonlySet<string>;
  filtros: FiltrosDaBarra;
  /** Os funis marcados; vazio = todos. */
  escolhidos: readonly string[];
  podeOrganizar: boolean;
  aoEscolher: (ids: string[]) => void;
  aoReordenar: (ids: string[]) => void;
  aoArquivar: (ids: string[], arquivar: boolean) => void;
  aoFiltrar: (filtros: FiltrosDaBarra) => void;
}

/**
 * O SELETOR DE FUNIS (campanhas): um botão que abre um popup de múltipla seleção — todos, um só ou
 * vários. Os arquivados ficam num toggle dentro do popup, junto do filtro por status e canal e da
 * ordem (arrastar). Substitui a fila de pílulas, que ocupava a tela inteira no celular.
 */
export function SeletorDeFunis({
  funis,
  arquivados,
  filtros,
  escolhidos,
  podeOrganizar,
  aoEscolher,
  aoReordenar,
  aoArquivar,
  aoFiltrar,
}: PropsDoSeletor) {
  const t = useT();
  const rotuloDoStatus = useRotuloDoStatus();
  const sensores = useSensors(useSensor(PointerSensor, SENSOR));
  const [busca, setBusca] = useState("");
  const [arquivadosAbertos, setArquivadosAbertos] = useState(false);
  const [filtroAberto, setFiltroAberto] = useState(false);

  const passaNoFiltro = (f: FunilDaBarra) => {
    if (filtros.status.length > 0 && !filtros.status.includes(f.statusDaCampanha ?? "sem_campanha"))
      return false;
    if (filtros.canais.length > 0 && (!f.canal || !filtros.canais.includes(f.canal))) return false;
    return true;
  };
  const filtrando = filtros.status.length + filtros.canais.length;
  const termo = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const bate = (f: FunilDaBarra) =>
    termo === "" || f.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(termo);

  const ativos = funis.filter((f) => !arquivados.has(f.id));
  const doArquivo = funis.filter((f) => arquivados.has(f.id));
  const ativosDaLista = ativos.filter((f) => passaNoFiltro(f) && bate(f));
  const arquivadosDaLista = doArquivo.filter(bate);
  const pausadas = ativos.filter(
    (f) => f.statusDaCampanha === "pausada" || f.statusDaCampanha === "encerrada",
  );
  const marcados = new Set(escolhidos);

  const alternarFunil = (id: string) =>
    aoEscolher(marcados.has(id) ? escolhidos.filter((x) => x !== id) : [...escolhidos, id]);

  const rotulo =
    escolhidos.length === 0
      ? t("Todas")
      : escolhidos.length === 1
        ? (funis.find((f) => f.id === escolhidos[0])?.nome ?? t("1 funil"))
        : `${escolhidos.length} ${t("funis")}`;

  function terminou(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = ativosDaLista.map((f) => f.id);
    const de = ids.indexOf(String(active.id));
    const para = ids.indexOf(String(over.id));
    if (de < 0 || para < 0) return;
    const fora = funis.map((f) => f.id).filter((id) => !ids.includes(id));
    aoReordenar([...arrayMove(ids, de, para), ...fora]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="seletor-de-funis"
          className={cn(
            "inline-flex h-9 max-w-full min-w-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium whitespace-nowrap",
            escolhidos.length > 0 ? "border-primary bg-primary/10" : "bg-card",
          )}
        >
          <Funnel size={14} className="shrink-0" aria-hidden />
          <span className="text-muted-foreground">{t("Funis")}:</span>
          <span className="truncate">{rotulo}</span>
          <CaretDown size={12} className="shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,400px)] p-2">
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
            className="h-9 w-full rounded-xl border bg-background pr-2 pl-8 text-sm outline-hidden focus:border-primary/50"
          />
        </label>
        <div className="mt-2 max-h-80 overflow-y-auto overscroll-contain">
          <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm font-medium hover:bg-secondary">
            <input
              type="checkbox"
              checked={escolhidos.length === 0}
              onChange={() => aoEscolher([])}
              className="h-4 w-4 accent-primary"
            />
            {t("Todas")}
          </label>
          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={terminou}>
            <SortableContext
              items={ativosDaLista.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              {ativosDaLista.map((f) => (
                <LinhaDeSelecao
                  key={f.id}
                  funil={f}
                  marcado={marcados.has(f.id)}
                  arquivado={false}
                  podeOrganizar={podeOrganizar}
                  arrastavel={podeOrganizar && termo === "" && filtrando === 0}
                  aoMarcar={() => alternarFunil(f.id)}
                  aoArquivar={() => aoArquivar([f.id], true)}
                />
              ))}
            </SortableContext>
          </DndContext>
          {ativosDaLista.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              {t("Nenhum funil encontrado.")}
            </p>
          ) : null}

          {doArquivo.length > 0 ? (
            <div className="mt-1 border-t pt-1">
              <button
                type="button"
                aria-expanded={arquivadosAbertos}
                onClick={() => setArquivadosAbertos((a) => !a)}
                className="flex min-h-9 w-full items-center justify-between rounded-md px-2 text-sm font-medium hover:bg-secondary"
              >
                <span className="inline-flex items-center gap-2">
                  <Archive size={14} aria-hidden />
                  {t("Arquivados")} · {doArquivo.length}
                </span>
                <CaretDown
                  size={12}
                  aria-hidden
                  className={cn("transition-transform", !arquivadosAbertos && "-rotate-90")}
                />
              </button>
              {arquivadosAbertos
                ? arquivadosDaLista.map((f) => (
                    <LinhaDeSelecao
                      key={f.id}
                      funil={f}
                      marcado={marcados.has(f.id)}
                      arquivado
                      podeOrganizar={podeOrganizar}
                      arrastavel={false}
                      aoMarcar={() => alternarFunil(f.id)}
                      aoArquivar={() => aoArquivar([f.id], false)}
                    />
                  ))
                : null}
            </div>
          ) : null}

          <div className="mt-1 border-t pt-1">
            <button
              type="button"
              aria-expanded={filtroAberto}
              onClick={() => setFiltroAberto((a) => !a)}
              className="flex min-h-9 w-full items-center justify-between rounded-md px-2 text-sm font-medium hover:bg-secondary"
            >
              <span className="inline-flex items-center gap-2">
                <SlidersHorizontal size={14} aria-hidden />
                {t("Filtrar por status e canal")}
                {filtrando > 0 ? ` · ${filtrando}` : ""}
              </span>
              <CaretDown
                size={12}
                aria-hidden
                className={cn("transition-transform", !filtroAberto && "-rotate-90")}
              />
            </button>
            {filtroAberto ? (
              <div className="px-2 pb-2">
                <p className="mt-1 mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("Status da campanha")}
                </p>
                <div className="grid gap-0.5">
                  {STATUS.map((s) => (
                    <label
                      key={s}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-secondary"
                    >
                      <input
                        type="checkbox"
                        checked={filtros.status.includes(s)}
                        onChange={() => aoFiltrar({ ...filtros, status: alternar(filtros.status, s) })}
                        className="h-4 w-4 accent-primary"
                      />
                      {rotuloDoStatus(s === "sem_campanha" ? null : s)}
                    </label>
                  ))}
                </div>
                <p className="mt-2 mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("Canal")}
                </p>
                <div className="grid gap-0.5">
                  {CANAIS_DA_CAMPANHA.map((c: CanalDaCampanha) => (
                    <label
                      key={c}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-secondary"
                    >
                      <input
                        type="checkbox"
                        checked={filtros.canais.includes(c)}
                        onChange={() => aoFiltrar({ ...filtros, canais: alternar(filtros.canais, c) })}
                        className="h-4 w-4 accent-primary"
                      />
                      {rotuloDoCanal(t, c)}
                    </label>
                  ))}
                </div>
                {filtrando > 0 ? (
                  <button
                    type="button"
                    onClick={() => aoFiltrar({ status: [], canais: [] })}
                    className="mt-2 h-9 w-full rounded-lg border text-sm font-medium hover:bg-secondary"
                  >
                    {t("Limpar filtros")}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        {podeOrganizar && (pausadas.length > 0 || doArquivo.length > 0) ? (
          <div className="mt-2 grid gap-1.5 border-t pt-2">
            <button
              type="button"
              disabled={pausadas.length === 0}
              onClick={() =>
                aoArquivar(
                  pausadas.map((f) => f.id),
                  true,
                )
              }
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-secondary disabled:opacity-40"
            >
              <Archive size={14} aria-hidden />
              {t("Arquivar funis de campanhas pausadas ou encerradas")}
              {pausadas.length > 0 ? ` (${pausadas.length})` : ""}
            </button>
            <p className="px-1 text-[11px] text-muted-foreground">
              {t("Arquivar só tira o funil da lista de cima: as oportunidades continuam em Todas.")}
            </p>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
