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
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent as EventoDeCopia,
  type KeyboardEvent as EventoDeTecla,
  type MouseEvent as EventoDeMouse,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { useCelular } from "@/hooks/motor/useCelular";
import { useT } from "@/hooks/i18n/useT";
import { agruparDesfazer } from "@/lib/motor/desfazer";
import { limitarLargura, type DefinicaoDeColuna } from "@/lib/motor/layout";
import {
  alvosDaColagem,
  dentroDaFaixa,
  faixaDa,
  LIMITE_DE_CELULAS_POR_COLAGEM,
  lerColagem,
  montarTsv,
  moverFoco,
  type Posicao,
  type Selecao,
} from "@/lib/motor/planilha";
import { estadoDoMarcarTodas } from "@/lib/motor/selecao";
import {
  CaretDown,
  CaretRight,
  CaretUp,
  Check,
  DotsSixVertical,
  Minus,
  Plus,
} from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface ColunaDoMotor<T> extends DefinicaoDeColuna {
  titulo: string;
  icone?: ReactNode;
  celula: (linha: T) => ReactNode;
  /** O total da coluna (soma, média, contagem…), na linha de totais do fim da tabela. */
  total?: (linhas: readonly T[]) => ReactNode;
  /**
   * Modo planilha: colar um texto nesta célula (e apagar, com texto vazio). Sem isto a coluna só
   * pode ser selecionada e copiada. Devolva a promessa da gravação (o Ctrl+Z junta a faixa toda).
   */
  colar?: (linha: T, texto: string) => void | Promise<unknown>;
  /** O texto desta célula ao copiar; sem ele, vale o texto que a célula mostra. */
  texto?: (linha: T) => string;
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
  /**
   * Clicar no título da coluna ordena por ela (crescente, decrescente, nada). `ordenacao` é a
   * ordem atual (para a seta); `colunasOrdenaveis` diz quais colunas têm campo para ordenar.
   */
  aoOrdenarPor?: (colunaId: string) => void;
  ordenacao?: readonly { campo: string; direcao: "asc" | "desc" }[];
  colunasOrdenaveis?: ReadonlySet<string>;
  /** O "+" no título de cada grupo: cria uma linha já com o valor do grupo (`chave`). */
  aoCriarNoGrupo?: (chave: string) => void;
  rotuloDeCriarNoGrupo?: string;
  rotuloDeCriar?: string;
  /** Mostrado quando não há nenhuma linha. */
  vazio?: ReactNode;
  rotuloDaTabela: string;
  /**
   * MODO PLANILHA (estilo Excel): clicar numa célula a seleciona, arrastar (ou Shift+clique/setas)
   * seleciona uma faixa; Ctrl+C copia, Ctrl+V cola (um valor sobre a faixa preenche tudo), Delete
   * apaga, Enter edita. Só as colunas com `colar` aceitam o que se cola.
   */
  planilha?: boolean;
}

const LARGURA_DA_SELECAO = 32;
const LARGURA_DA_SELECAO_NO_CELULAR = 44;
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
  semAlca,
  children,
}: {
  id: string;
  grade: string;
  /** Celular: sem a coluna da alça (arrastar linha com o dedo brigaria com a rolagem). */
  semAlca?: boolean;
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
        "group grid min-h-12 items-center border-b last:border-b-0 md:min-h-0",
        selecionada ? "bg-accent-soft/50" : "bg-card",
        isDragging && "relative z-10 rounded-lg shadow-lg ring-1 ring-primary/30",
      )}
    >
      {celulaDeSelecao ? (
        <div role="cell" className="grid place-items-center">
          {celulaDeSelecao}
        </div>
      ) : null}
      {semAlca ? null : (
        <div role="cell" className="grid place-items-center">
          {podeReordenar ? (
            <button
              ref={setActivatorNodeRef}
              type="button"
              aria-label={rotuloDoArraste}
              className="grid h-7 w-6 cursor-grab touch-none place-items-center rounded-md text-text-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:bg-secondary focus-visible:opacity-100 active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <DotsSixVertical size={16} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>
      )}
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
  larga = false,
}: {
  /** No celular a alça é mais larga (alvo de toque). */
  larga?: boolean;
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
      className={cn(
        "absolute top-0 right-0 z-10 h-full cursor-col-resize touch-none select-none after:absolute after:top-1/4 after:right-0.5 after:h-1/2 after:w-px after:bg-border hover:after:bg-primary focus-visible:after:bg-primary",
        larga ? "w-6 after:w-0.5 after:bg-muted-foreground/50" : "w-2",
      )}
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
  aoOrdenarPor,
  ordenacao,
  colunasOrdenaveis,
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
  aoCriarNoGrupo,
  rotuloDeCriarNoGrupo,
  rotuloDeCriar,
  vazio,
  rotuloDaTabela,
  planilha = false,
}: Props<T>) {
  const t = useT();
  const celular = useCelular();
  // Ids estáveis para as duas áreas de arraste: sem eles o dnd-kit numera por um contador
  // global, que difere entre servidor e navegador (aviso de hidratação).
  const idDoMotor = useId();
  const [aoVivo, setAoVivo] = useState<{ id: string; largura: number } | null>(null);
  // A largura que a pessoa acabou de soltar: vale até a tela devolver a preferência gravada. Sem
  // isto a coluna "pulava" de volta para a largura antiga no intervalo entre soltar a alça e a
  // gravação chegar — e, se a gravação falhasse, a escolha parecia não ter sido feita.
  const [soltada, setSoltada] = useState<{ id: string; largura: number } | null>(null);
  useEffect(() => {
    if (!soltada) return;
    if (colunas.some((c) => c.id === soltada.id && c.largura === soltada.largura)) {
      setSoltada(null);
      return;
    }
    const prazo = setTimeout(() => setSoltada(null), 4000);
    return () => clearTimeout(prazo);
  }, [soltada, colunas]);

  // Celular: colunas mais estreitas (cabem mais na tela). A tabela inteira desliza junto,
  // título inclusive — nada fica preso à esquerda, como no Notion.
  const LARGURA_MAXIMA_NO_CELULAR = 176;
  const LARGURA_DO_TITULO_NO_CELULAR = 184;
  // A largura que a pessoa escolheu (arrastando a alça) vale em TODA coluna, o título inclusive —
  // antes o título voltava para a largura padrão do celular ao soltar a alça. Sem escolha, o
  // celular usa o padrão estreito (o título um pouco mais largo).
  const larguraDe = (c: ColunaDoMotor<T>) =>
    aoVivo?.id === c.id
      ? aoVivo.largura
      : soltada?.id === c.id
        ? soltada.largura
        : !celular || (c as { larguraPersonalizada?: boolean }).larguraPersonalizada
          ? c.largura
          : c.fixa || c.semOcultar
            ? LARGURA_DO_TITULO_NO_CELULAR
            : Math.min(c.largura, LARGURA_MAXIMA_NO_CELULAR);
  const comAcoes = Boolean(acoesDaLinha);
  const comFim = Boolean(fimDoCabecalho);
  const comSelecao = Boolean(aoSelecionar);
  const larguraDaSelecao = celular ? LARGURA_DA_SELECAO_NO_CELULAR : LARGURA_DA_SELECAO;
  const comAlca = !celular;
  const grade = [
    ...(comSelecao ? [`${larguraDaSelecao}px`] : []),
    ...(comAlca ? [`${LARGURA_DO_ARRASTE}px`] : []),
    // Sobrando espaço (tela larga, zoom menor), as colunas crescem juntas, na proporção da largura
    // de cada uma — a tabela ocupa a página inteira, como no Notion.
    ...colunas.map((c) => `minmax(${larguraDe(c)}px, ${larguraDe(c)}fr)`),
    ...(comAcoes || comFim ? [`${comAcoes ? LARGURA_DAS_ACOES : LARGURA_DO_FIM}px`] : []),
  ].join(" ");
  const larguraTotal =
    (comSelecao ? larguraDaSelecao : 0) +
    (comAlca ? LARGURA_DO_ARRASTE : 0) +
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

  // ── modo planilha ───────────────────────────────────────────────────────────────────────────
  const raiz = useRef<HTMLDivElement | null>(null);
  const [sel, setSel] = useState<Selecao | null>(null);
  const arrastando = useRef(false);
  const [arrastandoVisual, setArrastandoVisual] = useState(false);
  useEffect(() => {
    if (!planilha) return;
    const soltar = () => {
      arrastando.current = false;
      setArrastandoVisual(false);
    };
    document.addEventListener("mouseup", soltar);
    return () => document.removeEventListener("mouseup", soltar);
  }, [planilha]);
  // A seleção só vale enquanto a célula existe (filtrou, apagou, escondeu a coluna…).
  const faixa = (() => {
    if (!planilha || !sel) return null;
    const f = faixaDa(sel);
    return f.l2 < linhas.length && f.c2 < colunas.length ? f : null;
  })();
  const limites = { linhas: linhas.length, colunas: colunas.length };

  const celulaEl = (l: number, c: number) =>
    raiz.current?.querySelector<HTMLElement>(`[data-pl="${l}"][data-pc="${c}"]`) ?? null;
  const textoDaCelula = (l: number, c: number): string => {
    const linha = linhas[l];
    const coluna = colunas[c];
    if (!linha || !coluna) return "";
    if (coluna.texto) return coluna.texto(linha);
    const bruto = (celulaEl(l, c)?.textContent ?? "").replace(/\s+/g, " ").trim();
    return bruto === "—" ? "" : bruto;
  };
  const textoDaFaixa = (): string => {
    if (!faixa) return "";
    const matriz: string[][] = [];
    for (let l = faixa.l1; l <= faixa.l2; l++) {
      const linha: string[] = [];
      for (let c = faixa.c1; c <= faixa.c2; c++) linha.push(textoDaCelula(l, c));
      matriz.push(linha);
    }
    return montarTsv(matriz);
  };

  /** Grava um valor em cada alvo (as colunas sem `colar` ficam de fora) e junta o Ctrl+Z. */
  async function aplicar(alvos: { l: number; c: number; valor: string }[], rotulo: string) {
    if (alvos.length > LIMITE_DE_CELULAS_POR_COLAGEM) {
      toast.error(
        `${t("Dá para mudar até")} ${LIMITE_DE_CELULAS_POR_COLAGEM} ${t("células por vez.")}`,
      );
      return;
    }
    let feitas = 0;
    let semEdicao = 0;
    const tarefas: Promise<unknown>[] = [];
    for (const a of alvos) {
      const linha = linhas[a.l];
      const coluna = colunas[a.c];
      if (!linha || !coluna) continue;
      if (!coluna.colar) {
        semEdicao += 1;
        continue;
      }
      feitas += 1;
      tarefas.push(Promise.resolve(coluna.colar(linha, a.valor)).catch(() => undefined));
    }
    await agruparDesfazer(rotulo, () => Promise.all(tarefas));
    if (feitas > 0) {
      toast.success(
        `${feitas} ${feitas === 1 ? t("célula atualizada") : t("células atualizadas")}${
          semEdicao > 0 ? ` · ${semEdicao} ${t("sem edição, ignoradas")}` : ""
        }. ${t("Ctrl+Z desfaz.")}`,
      );
    } else if (semEdicao > 0) {
      toast.message(t("Essas colunas não aceitam edição por aqui."));
    }
  }

  function aoPressionarCelula(e: EventoDeMouse, p: Posicao) {
    if (!planilha || e.button !== 0) return;
    const interativo = (e.target as HTMLElement).closest(
      "input, textarea, select, button, a, [role='combobox'], [contenteditable='true']",
    );
    setSel((atual) =>
      e.shiftKey && atual ? { ancora: atual.ancora, foco: p } : { ancora: p, foco: p },
    );
    arrastando.current = true;
    // Sem um controle clicado, o foco vai para a tabela (é ela que ouve as setas e o Ctrl+C/V).
    if (!interativo) raiz.current?.focus({ preventScroll: true });
  }
  function aoEntrarNaCelula(p: Posicao) {
    if (!planilha || !arrastando.current) return;
    setArrastandoVisual(true);
    setSel((atual) => (atual ? { ancora: atual.ancora, foco: p } : atual));
  }

  function aoTeclar(e: EventoDeTecla<HTMLDivElement>) {
    if (!planilha || !sel || !faixa) return;
    const alvo = e.target as HTMLElement;
    // Janelas e menus (portais) não são da tabela; campos de texto são de quem está digitando.
    if (!raiz.current?.contains(alvo)) return;
    if (alvo.closest("input, textarea, select, [contenteditable='true']")) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "PageUp",
        "PageDown",
      ].includes(k)
    ) {
      e.preventDefault();
      const foco = moverFoco(sel.foco, k, limites, mod);
      setSel({ ancora: e.shiftKey ? sel.ancora : foco, foco });
      requestAnimationFrame(() =>
        celulaEl(foco.l, foco.c)?.scrollIntoView({ block: "nearest", inline: "nearest" }),
      );
      return;
    }
    if (k === "Escape") {
      setSel(null);
      return;
    }
    if (mod && k.toLowerCase() === "a") {
      e.preventDefault();
      setSel({
        ancora: { l: 0, c: 0 },
        foco: { l: limites.linhas - 1, c: limites.colunas - 1 },
      });
      return;
    }
    if (k === "Delete" || k === "Backspace") {
      e.preventDefault();
      const alvos = [];
      for (let l = faixa.l1; l <= faixa.l2; l++)
        for (let c = faixa.c1; c <= faixa.c2; c++) alvos.push({ l, c, valor: "" });
      void aplicar(alvos, t("Apagar células"));
      return;
    }
    if (k === "Enter" || k === "F2") {
      const controle = celulaEl(sel.foco.l, sel.foco.c)?.querySelector<HTMLElement>(
        "input, textarea, select, button, [role='combobox']",
      );
      if (controle && alvo !== controle) {
        e.preventDefault();
        controle.click();
        controle.focus();
      }
    }
  }

  function aoCopiar(e: EventoDeCopia<HTMLDivElement>, cortar: boolean) {
    if (!planilha || !faixa || !raiz.current?.contains(e.target as Node)) return;
    if ((e.target as HTMLElement).closest("input, textarea, [contenteditable='true']")) return;
    e.clipboardData.setData("text/plain", textoDaFaixa());
    e.preventDefault();
    if (cortar) {
      const alvos = [];
      for (let l = faixa.l1; l <= faixa.l2; l++)
        for (let c = faixa.c1; c <= faixa.c2; c++) alvos.push({ l, c, valor: "" });
      void aplicar(alvos, t("Recortar células"));
    }
  }

  function aoColar(e: EventoDeCopia<HTMLDivElement>) {
    if (!planilha || !faixa || !raiz.current?.contains(e.target as Node)) return;
    if ((e.target as HTMLElement).closest("input, textarea, [contenteditable='true']")) return;
    const texto = e.clipboardData.getData("text/plain");
    if (texto === "") return;
    e.preventDefault();
    const alvos = alvosDaColagem(lerColagem(texto), faixa, limites);
    if (alvos.length === 0) return;
    const ultima = alvos[alvos.length - 1]!;
    void aplicar(alvos, t("Colar células"));
    // A seleção passa a cobrir o que foi colado.
    setSel({ ancora: { l: faixa.l1, c: faixa.c1 }, foco: { l: ultima.l, c: ultima.c } });
  }

  const posicaoDaLinha = new Map<string, number>();
  linhas.forEach((l, i) => {
    const id = idDe(l);
    if (!posicaoDaLinha.has(id)) posicaoDaLinha.set(id, i);
  });

  const [recolhidos, setRecolhidos] = useState<ReadonlySet<string>>(() => new Set());
  const blocos = grupos ?? [{ chave: "", titulo: null, linhas }];
  // Único: agrupando por campo de vários valores, a mesma linha aparece em mais de um grupo.
  const ids = [...new Set(linhas.map(idDe))];
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

  return (
    <div
      ref={raiz}
      tabIndex={planilha ? -1 : undefined}
      onKeyDown={aoTeclar}
      onCopy={(e) => aoCopiar(e, false)}
      onCut={(e) => aoCopiar(e, true)}
      onPaste={aoColar}
      className={cn(
        "[container-type:inline-size] -mx-4 overflow-x-auto overscroll-x-contain border-y bg-card outline-hidden sm:mx-0 sm:rounded-[22px] sm:border",
        arrastandoVisual && "select-none",
      )}
    >
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
              className="grid items-stretch border-b bg-secondary/50 text-xs font-bold text-muted-foreground"
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
              {comAlca ? <div role="columnheader" aria-hidden /> : null}
              {colunas.map((c) => {
                const ordenavel = Boolean(aoOrdenarPor) && Boolean(colunasOrdenaveis?.has(c.id));
                const direcao = ordenacao?.[0]?.campo === c.id ? ordenacao[0]!.direcao : null;
                const titulo = ordenavel ? (
                  <button
                    type="button"
                    onClick={() => aoOrdenarPor?.(c.id)}
                    aria-label={`${t("Ordenar por")} ${c.titulo}`}
                    title={t("Clique para ordenar")}
                    className="flex w-full min-w-0 items-center gap-1.5 px-2 py-2.5 text-left hover:text-foreground"
                  >
                    {c.icone}
                    <span className="truncate">{c.titulo}</span>
                    {direcao ? (
                      direcao === "asc" ? (
                        <CaretUp
                          size={12}
                          weight="bold"
                          className="shrink-0 text-primary"
                          aria-hidden
                        />
                      ) : (
                        <CaretDown
                          size={12}
                          weight="bold"
                          className="shrink-0 text-primary"
                          aria-hidden
                        />
                      )
                    ) : null}
                  </button>
                ) : (
                  <span className="flex min-w-0 items-center gap-1.5 px-2 py-2.5">
                    {c.icone}
                    <span className="truncate">{c.titulo}</span>
                  </span>
                );
                return (
                  <CabecalhoOrdenavel
                    key={c.id}
                    id={c.id}
                    movel={Boolean(aoMoverColuna) && !c.fixa && !celular}
                  >
                    <div className="min-w-0 flex-1">
                      {menuDaColuna ? menuDaColuna(c, titulo) : titulo}
                    </div>
                    {aoRedimensionarColuna ? (
                      <AlcaDeLargura
                        larga={celular}
                        largura={larguraDe(c)}
                        rotulo={`${t("Largura da coluna")}: ${c.titulo}`}
                        aoArrastar={(largura) =>
                          setAoVivo(largura === null ? null : { id: c.id, largura })
                        }
                        aoConfirmar={(largura) => {
                          setSoltada({ id: c.id, largura });
                          aoRedimensionarColuna(c.id, largura);
                        }}
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
            // Fica sempre no centro do que o usuário está vendo (a tabela larga rola para o lado).
            <div className="sticky left-0 w-[100cqw] max-w-full px-4 py-10 text-center text-sm text-muted-foreground">
              {vazio}
            </div>
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
                      <div className="flex items-center border-b bg-secondary/30">
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
                          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm"
                        >
                          {recolhidos.has(bloco.chave) ? (
                            <CaretRight size={12} weight="bold" aria-hidden />
                          ) : (
                            <CaretDown size={12} weight="bold" aria-hidden />
                          )}
                          {bloco.titulo}
                          <span className="text-xs text-muted-foreground">
                            {bloco.linhas.length}
                          </span>
                        </button>
                        {aoCriarNoGrupo ? (
                          <button
                            type="button"
                            aria-label={rotuloDeCriarNoGrupo}
                            title={rotuloDeCriarNoGrupo}
                            onClick={() => aoCriarNoGrupo(bloco.chave)}
                            className="mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          >
                            <Plus size={14} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {recolhidos.has(bloco.chave)
                      ? null
                      : bloco.linhas.map((linha) => (
                          <LinhaOrdenavel
                            key={idDe(linha)}
                            id={idDe(linha)}
                            grade={grade}
                            rotuloDoArraste={t("Arrastar para reordenar")}
                            podeReordenar={podeReordenar && comAlca}
                            semAlca={!comAlca}
                            selecionada={selecionadas.has(idDe(linha))}
                            celulaDeSelecao={
                              comSelecao ? (
                                <CaixaDeSelecao
                                  estado={selecionadas.has(idDe(linha)) ? "marcada" : "vazia"}
                                  rotulo={t("Selecionar linha")}
                                  visivel={celular || selecionadas.size > 0}
                                  aoClicar={(e) =>
                                    aoSelecionar!(idDe(linha), { faixa: e.shiftKey })
                                  }
                                />
                              ) : undefined
                            }
                          >
                            {colunas.map((c, ci) => {
                              const li = posicaoDaLinha.get(idDe(linha)) ?? 0;
                              const dentro = dentroDaFaixa(faixa, li, ci);
                              const noFoco = Boolean(sel && sel.foco.l === li && sel.foco.c === ci);
                              return (
                                <div
                                  key={c.id}
                                  role="cell"
                                  data-pl={planilha ? li : undefined}
                                  data-pc={planilha ? ci : undefined}
                                  aria-selected={planilha ? dentro : undefined}
                                  onMouseDown={
                                    planilha
                                      ? (e) => aoPressionarCelula(e, { l: li, c: ci })
                                      : undefined
                                  }
                                  onMouseEnter={
                                    planilha ? () => aoEntrarNaCelula({ l: li, c: ci }) : undefined
                                  }
                                  className={cn(
                                    "min-w-0 overflow-x-clip px-0.5 py-1",
                                    dentro && "bg-primary/10",
                                    dentro && noFoco && "ring-2 ring-primary/60 ring-inset",
                                  )}
                                >
                                  {c.celula(linha)}
                                </div>
                              );
                            })}
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

        {linhas.length > 0 && colunas.some((c) => c.total) ? (
          <div
            role="row"
            aria-label={t("Totais")}
            style={{ gridTemplateColumns: grade }}
            className="grid items-center border-t-2 bg-secondary/60 text-sm font-semibold"
          >
            {comSelecao ? <div role="cell" /> : null}
            {comAlca ? <div role="cell" /> : null}
            {colunas.map((c) => (
              <div key={c.id} role="cell" className="min-w-0 px-0.5 py-2">
                {c.total ? c.total(linhas) : null}
              </div>
            ))}
            {comAcoes || comFim ? <div role="cell" /> : null}
          </div>
        ) : null}

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
