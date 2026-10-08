"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Fragment,
  useId,
  useRef,
  useState,
  type MouseEvent as EventoDeMouse,
  type ReactNode,
} from "react";

import { useCelular } from "@/hooks/motor/useCelular";
import { useT } from "@/hooks/i18n/useT";
import { limitarLargura, type DefinicaoDeColuna } from "@/lib/motor/layout";
import { estadoDoMarcarTodas } from "@/lib/motor/selecao";
import { CaretDown, CaretRight, Check, DotsSixVertical, Minus, Plus } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface ColunaDoMotor<T> extends DefinicaoDeColuna {
  titulo: string;
  icone?: ReactNode;
  celula: (linha: T) => ReactNode;
}

interface Props<T> {
  linhas: readonly T[];
  idDe: (linha: T) => string;
  /** Só as colunas VISÍVEIS, já na ordem e na largura efetivas (ver `resolverColunas`). */
  colunas: readonly ColunaDoMotor<T>[];
  /** Arrastou o cabeçalho `idMovido` para a posição de `idAlvo`. */
  aoMoverColuna?: (idMovido: string, idAlvo: string) => void;
  /** Soltou a alça de largura de uma coluna. */
  aoRedimensionarColuna?: (id: string, largura: number) => void;
  /** O menu que abre no clique do cabeçalho (renomear, ocultar, apagar…). */
  menuDaColuna?: (coluna: ColunaDoMotor<T>, titulo: ReactNode) => ReactNode;
  /** O fim do cabeçalho (o "+" de nova propriedade). */
  fimDoCabecalho?: ReactNode;
  /** `destino` = o índice em que a linha ficou, na lista já sem ela. */
  aoReordenar: (id: string, destino: number) => void;
  podeReordenar: boolean;
  /** Os ids das linhas selecionadas. Sem `aoSelecionar`, a tabela não tem coluna de seleção. */
  selecionadas?: ReadonlySet<string>;
  /** Clicou na caixa de uma linha; `faixa` = Shift apertado (seleciona do último clique até aqui). */
  aoSelecionar?: (id: string, opcoes: { faixa: boolean }) => void;
  /** Clicou na caixa do cabeçalho: marca todas (ou desmarca, se já estavam todas). */
  aoSelecionarTodas?: (marcar: boolean) => void;
  carregando?: boolean;
  /**
   * Agrupamento: as mesmas `linhas`, partidas em blocos com título. `linhas` continua sendo a
   * lista inteira NA ORDEM em que os grupos a mostram (a seleção por faixa depende disso).
   */
  grupos?: readonly { chave: string; titulo: ReactNode; linhas: readonly T[] }[];
  /** O botão "⋯" do fim da linha (menu de ações). */
  acoesDaLinha?: (linha: T) => ReactNode;
  aoCriar?: () => void;
  rotuloDeCriar?: string;
  /** Mostrado quando não há nenhuma linha. */
  vazio?: ReactNode;
  rotuloDaTabela: string;
}

const LARGURA_DA_SELECAO = 32;
const LARGURA_DO_ARRASTE = 32;
const LARGURA_DAS_ACOES = 44;
const LARGURA_DO_FIM = 44;

/** A linha só desliza no eixo vertical, e o cabeçalho só no horizontal, como no Notion. */
const soVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });
const soHorizontal: Modifier = ({ transform }) => ({ ...transform, y: 0 });

/** A caixinha de seleção: some até o mouse chegar na linha — a menos que já haja algo selecionado. */
function CaixaDeSelecao({
  estado,
  rotulo,
  visivel,
  aoClicar,
}: {
  estado: "marcada" | "mista" | "vazia";
  rotulo: string;
  visivel: boolean;
  aoClicar: (e: EventoDeMouse) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={estado === "mista" ? "mixed" : estado === "marcada"}
      aria-label={rotulo}
      onClick={aoClicar}
      className={cn(
        "grid h-5 w-5 place-items-center rounded-md border-2 transition-colors",
        estado === "vazia"
          ? "border-border-strong hover:border-primary"
          : "border-primary bg-primary text-primary-foreground",
        estado === "vazia" &&
          !visivel &&
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
      )}
    >
      {estado === "marcada" ? <Check size={12} weight="bold" aria-hidden /> : null}
      {estado === "mista" ? <Minus size={12} weight="bold" aria-hidden /> : null}
    </button>
  );
}

function LinhaOrdenavel({
  id,
  grade,
  rotuloDoArraste,
  podeReordenar,
  selecionada,
  celulaDeSelecao,
  children,
}: {
  id: string;
  grade: string;
  rotuloDoArraste: string;
  podeReordenar: boolean;
  selecionada: boolean;
  celulaDeSelecao?: ReactNode;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !podeReordenar });

  return (
    <div
      ref={setNodeRef}
      role="row"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        gridTemplateColumns: grade,
      }}
      className={cn(
        "group grid items-center border-b last:border-b-0",
        selecionada ? "bg-accent-soft/50" : "bg-card",
        isDragging && "relative z-10 rounded-lg shadow-lg ring-1 ring-primary/30",
      )}
    >
      {celulaDeSelecao ? (
        <div role="cell" className="grid place-items-center">
          {celulaDeSelecao}
        </div>
      ) : null}
      <div role="cell" className="grid place-items-center">
        {podeReordenar ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={rotuloDoArraste}
            className="grid h-7 w-6 cursor-grab touch-none place-items-center rounded text-text-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-secondary focus-visible:opacity-100 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <DotsSixVertical size={16} weight="bold" aria-hidden />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/**
 * A alça do lado direito do cabeçalho: arrastar muda a largura da coluna, ao vivo, e a
 * escolha só é entregue ao soltar. Pelo teclado, as setas mudam de 10 em 10 px.
 */
function AlcaDeLargura({
  largura,
  rotulo,
  aoArrastar,
  aoConfirmar,
}: {
  largura: number;
  rotulo: string;
  aoArrastar: (largura: number | null) => void;
  aoConfirmar: (largura: number) => void;
}) {
  const inicio = useRef<{ x: number; largura: number } | null>(null);
  const calcular = (clientX: number) =>
    limitarLargura(inicio.current!.largura + clientX - inicio.current!.x);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={rotulo}
      tabIndex={0}
      onPointerDown={(e) => {
        // Sem isto o cabeçalho inteiro interpretaria o gesto como arrastar a coluna.
        e.preventDefault();
        e.stopPropagation();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Sem captura (ponteiro já encerrado, ou evento sintético): o gesto segue pelos
          // eventos que chegam à própria alça.
        }
        inicio.current = { x: e.clientX, largura };
      }}
      onPointerMove={(e) => {
        if (inicio.current) aoArrastar(calcular(e.clientX));
      }}
      onPointerUp={(e) => {
        if (!inicio.current) return;
        const final = calcular(e.clientX);
        inicio.current = null;
        aoArrastar(null);
        aoConfirmar(final);
      }}
      onPointerCancel={() => {
        inicio.current = null;
        aoArrastar(null);
      }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        aoConfirmar(limitarLargura(largura + (e.key === "ArrowRight" ? 10 : -10)));
      }}
      className="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize touch-none select-none after:absolute after:top-1/4 after:right-0.5 after:h-1/2 after:w-px after:bg-border hover:after:bg-primary focus-visible:after:bg-primary"
    />
  );
}

function CabecalhoOrdenavel({
  id,
  movel,
  children,
}: {
  id: string;
  movel: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !movel,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative flex items-center",
        movel && "cursor-grab active:cursor-grabbing",
        isDragging && "z-20 rounded-md bg-card shadow-md ring-1 ring-primary/30",
      )}
      {...(movel ? attributes : {})}
      {...(movel ? listeners : {})}
      // Depois dos espalhamentos: o dnd-kit põe role="button", e a célula do cabeçalho tem
      // de continuar sendo um columnheader para quem usa leitor de tela.
      role="columnheader"
    >
      {children}
    </div>
  );
}

/**
 * A tabela estilo Notion: linhas que se arrastam pelo ícone, colunas que se arrastam
 * pelo cabeçalho e se redimensionam pela borda, células que se editam no lugar.
 * Genérica de propósito — as Tarefas são a primeira a usá-la, e o CRM e os outros módulos
 * entram pela mesma porta (`ColunaDoMotor`).
 *
 * Não busca nem grava nada: recebe as linhas ordenadas e as colunas já resolvidas, e avisa
 * o que a pessoa fez. Quem decide o que fazer (e o que mostrar no meio-tempo) é o dono dos
 * dados.
 */
export function TabelaDoMotor<T>({
  linhas,
  idDe,
  colunas,
  aoMoverColuna,
  aoRedimensionarColuna,
  menuDaColuna,
  fimDoCabecalho,
  aoReordenar,
  podeReordenar,
  selecionadas = new Set<string>(),
  aoSelecionar,
  aoSelecionarTodas,
  carregando = false,
  grupos,
  acoesDaLinha,
  aoCriar,
  rotuloDeCriar,
  vazio,
  rotuloDaTabela,
}: Props<T>) {
  const t = useT();
  const celular = useCelular();
  // Ids estáveis para as duas áreas de arraste: sem eles o dnd-kit numera por um contador
  // global, que difere entre servidor e navegador (aviso de hidratação).
  const idDoMotor = useId();
  const [aoVivo, setAoVivo] = useState<{ id: string; largura: number } | null>(null);

  const larguraDe = (c: ColunaDoMotor<T>) => (aoVivo?.id === c.id ? aoVivo.largura : c.largura);
  const comAcoes = Boolean(acoesDaLinha);
  const comFim = Boolean(fimDoCabecalho);
  const comSelecao = Boolean(aoSelecionar);
  const grade = [
    ...(comSelecao ? [`${LARGURA_DA_SELECAO}px`] : []),
    `${LARGURA_DO_ARRASTE}px`,
    ...colunas.map((c) => `${larguraDe(c)}px`),
    ...(comAcoes || comFim ? [`${comAcoes ? LARGURA_DAS_ACOES : LARGURA_DO_FIM}px`] : []),
  ].join(" ");
  const larguraTotal =
    (comSelecao ? LARGURA_DA_SELECAO : 0) +
    LARGURA_DO_ARRASTE +
    colunas.reduce((soma, c) => soma + larguraDe(c), 0) +
    (comAcoes || comFim ? (comAcoes ? LARGURA_DAS_ACOES : LARGURA_DO_FIM) : 0);

  const sensoresDeLinha = useSensors(
    // 6px de tolerância: um clique tremido num botão de célula não pode virar arraste.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const sensoresDeColuna = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const [recolhidos, setRecolhidos] = useState<ReadonlySet<string>>(() => new Set());
  const blocos = grupos ?? [{ chave: "", titulo: null, linhas }];
  const ids = linhas.map(idDe);
  const estadoDeTodas = estadoDoMarcarTodas(selecionadas, ids);
  const idsDasColunasMoveis = colunas.filter((c) => !c.fixa).map((c) => c.id);

  function aoSoltarLinha({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const destino = ids.indexOf(String(over.id));
    if (destino >= 0) aoReordenar(String(active.id), destino);
  }

  function aoSoltarColuna({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    aoMoverColuna?.(String(active.id), String(over.id));
  }

  // No celular a tabela larga vira uma lista de cartões: nada de deslizar para os lados.
  if (celular) {
    return (
      <div className="flex flex-col gap-2" role="list" aria-label={rotuloDaTabela}>
        {carregando && linhas.length === 0 ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary" />
            ))}
          </div>
        ) : linhas.length === 0 ? (
          <div className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            {vazio}
          </div>
        ) : (
          blocos.map((bloco) => (
            <Fragment key={bloco.chave}>
              {grupos ? (
                <button
                  type="button"
                  aria-expanded={!recolhidos.has(bloco.chave)}
                  onClick={() =>
                    setRecolhidos((atual) => {
                      const proximo = new Set(atual);
                      if (proximo.has(bloco.chave)) proximo.delete(bloco.chave);
                      else proximo.add(bloco.chave);
                      return proximo;
                    })
                  }
                  className="flex w-full items-center gap-2 rounded-xl bg-secondary/50 px-3 py-2 text-left text-sm"
                >
                  {recolhidos.has(bloco.chave) ? (
                    <CaretRight size={12} weight="bold" aria-hidden />
                  ) : (
                    <CaretDown size={12} weight="bold" aria-hidden />
                  )}
                  {bloco.titulo}
                  <span className="text-xs text-muted-foreground">{bloco.linhas.length}</span>
                </button>
              ) : null}
              {recolhidos.has(bloco.chave)
                ? null
                : bloco.linhas.map((linha) => {
                    const [primeira, ...demais] = colunas;
                    return (
                      <div
                        key={idDe(linha)}
                        role="listitem"
                        className="rounded-2xl border bg-card p-3 shadow-sm"
                      >
                        <div className="flex items-start gap-1">
                          <div className="min-w-0 flex-1 text-base font-medium">
                            {primeira?.celula(linha)}
                          </div>
                          {comAcoes ? (
                            <div className="shrink-0">{acoesDaLinha?.(linha)}</div>
                          ) : null}
                        </div>
                        {demais.length > 0 ? (
                          <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5">
                            {demais.map((c) => (
                              <div key={c.id} className="min-w-0">
                                <dt className="flex items-center gap-1 px-2 text-[11px] text-muted-foreground">
                                  {c.icone}
                                  <span className="truncate">{c.titulo}</span>
                                </dt>
                                <dd className="min-w-0">{c.celula(linha)}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                      </div>
                    );
                  })}
            </Fragment>
          ))
        )}
        {aoCriar ? (
          <button
            type="button"
            onClick={aoCriar}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground"
          >
            <Plus size={14} aria-hidden />
            {rotuloDeCriar}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <div role="table" aria-label={rotuloDaTabela} style={{ minWidth: larguraTotal }}>
        <DndContext
          id={`${idDoMotor}-colunas`}
          sensors={sensoresDeColuna}
          collisionDetection={closestCenter}
          modifiers={[soHorizontal]}
          onDragEnd={aoSoltarColuna}
        >
          <SortableContext items={idsDasColunasMoveis} strategy={horizontalListSortingStrategy}>
            <div
              role="row"
              style={{ gridTemplateColumns: grade }}
              className="grid items-stretch border-b bg-secondary/50 text-xs font-medium text-muted-foreground"
            >
              {comSelecao ? (
                <div role="columnheader" className="grid place-items-center">
                  {aoSelecionarTodas ? (
                    <CaixaDeSelecao
                      estado={
                        estadoDeTodas === "todas"
                          ? "marcada"
                          : estadoDeTodas === "algumas"
                            ? "mista"
                            : "vazia"
                      }
                      rotulo={t("Selecionar todas")}
                      visivel
                      aoClicar={() => aoSelecionarTodas(estadoDeTodas !== "todas")}
                    />
                  ) : null}
                </div>
              ) : null}
              <div role="columnheader" aria-hidden />
              {colunas.map((c) => {
                const titulo = (
                  <span className="flex min-w-0 items-center gap-1.5 px-2 py-2.5">
                    {c.icone}
                    <span className="truncate">{c.titulo}</span>
                  </span>
                );
                return (
                  <CabecalhoOrdenavel
                    key={c.id}
                    id={c.id}
                    movel={Boolean(aoMoverColuna) && !c.fixa}
                  >
                    <div className="min-w-0 flex-1">
                      {menuDaColuna ? menuDaColuna(c, titulo) : titulo}
                    </div>
                    {aoRedimensionarColuna ? (
                      <AlcaDeLargura
                        largura={larguraDe(c)}
                        rotulo={`${t("Largura da coluna")}: ${c.titulo}`}
                        aoArrastar={(largura) =>
                          setAoVivo(largura === null ? null : { id: c.id, largura })
                        }
                        aoConfirmar={(largura) => aoRedimensionarColuna(c.id, largura)}
                      />
                    ) : null}
                  </CabecalhoOrdenavel>
                );
              })}
              {comAcoes || comFim ? (
                <div role="columnheader" className="grid place-items-center">
                  {fimDoCabecalho}
                </div>
              ) : null}
            </div>
          </SortableContext>
        </DndContext>

        <div role="rowgroup">
          {carregando && linhas.length === 0 ? (
            <div className="space-y-2 p-3" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-secondary" />
              ))}
            </div>
          ) : linhas.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">{vazio}</div>
          ) : (
            <DndContext
              id={`${idDoMotor}-linhas`}
              sensors={sensoresDeLinha}
              collisionDetection={closestCenter}
              modifiers={[soVertical]}
              onDragEnd={aoSoltarLinha}
            >
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                {blocos.map((bloco) => (
                  <Fragment key={bloco.chave}>
                    {grupos ? (
                      <button
                        type="button"
                        aria-expanded={!recolhidos.has(bloco.chave)}
                        onClick={() =>
                          setRecolhidos((atual) => {
                            const proximo = new Set(atual);
                            if (proximo.has(bloco.chave)) proximo.delete(bloco.chave);
                            else proximo.add(bloco.chave);
                            return proximo;
                          })
                        }
                        className="flex w-full items-center gap-2 border-b bg-secondary/30 px-3 py-2 text-left text-sm"
                      >
                        {recolhidos.has(bloco.chave) ? (
                          <CaretRight size={12} weight="bold" aria-hidden />
                        ) : (
                          <CaretDown size={12} weight="bold" aria-hidden />
                        )}
                        {bloco.titulo}
                        <span className="text-xs text-muted-foreground">{bloco.linhas.length}</span>
                      </button>
                    ) : null}
                    {recolhidos.has(bloco.chave)
                      ? null
                      : bloco.linhas.map((linha) => (
                          <LinhaOrdenavel
                            key={idDe(linha)}
                            id={idDe(linha)}
                            grade={grade}
                            rotuloDoArraste={t("Arrastar para reordenar")}
                            podeReordenar={podeReordenar}
                            selecionada={selecionadas.has(idDe(linha))}
                            celulaDeSelecao={
                              comSelecao ? (
                                <CaixaDeSelecao
                                  estado={selecionadas.has(idDe(linha)) ? "marcada" : "vazia"}
                                  rotulo={t("Selecionar linha")}
                                  visivel={selecionadas.size > 0}
                                  aoClicar={(e) =>
                                    aoSelecionar!(idDe(linha), { faixa: e.shiftKey })
                                  }
                                />
                              ) : undefined
                            }
                          >
                            {colunas.map((c) => (
                              <div key={c.id} role="cell" className="min-w-0 px-0.5 py-1">
                                {c.celula(linha)}
                              </div>
                            ))}
                            {comAcoes || comFim ? (
                              <div role="cell" className="grid place-items-center">
                                {acoesDaLinha?.(linha)}
                              </div>
                            ) : null}
                          </LinhaOrdenavel>
                        ))}
                  </Fragment>
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>

        {aoCriar ? (
          <button
            type="button"
            onClick={aoCriar}
            className="flex w-full items-center gap-2 border-t px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <Plus size={14} aria-hidden />
            {rotuloDeCriar}
          </button>
        ) : null}
      </div>
    </div>
  );
}
