"use client";

import "@blocknote/mantine/style.css";
import "@/components/anotacoes/editor-de-notas.css";

import {
  BlockNoteSchema,
  defaultBlockSpecs,
  filterSuggestionItems,
  getDefaultSlashMenuItems,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core";
import * as locales from "@blocknote/core/locales";
import {
  SuggestionMenuController,
  createReactBlockSpec,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { toast } from "sonner";

import { ITENS_DOS_BLOCOS_VISUAIS, blocosVisuais } from "@/components/anotacoes/blocos-visuais";
import { useT } from "@/hooks/i18n/useT";
import { ajustarCartoes, cartoesDoDocumento, type Documento } from "@/lib/anotacoes/documento";
import type { ResumoDaNota } from "@/lib/anotacoes/paginas";
import { BASE_DAS_IMAGENS_DO_PAINEL, TAMANHO_MAXIMO_DA_IMAGEM } from "@/lib/marketing/imagens";
import { useTheme } from "@/lib/theme";
import { FileText } from "@/lib/ui/icons";

/** O que o cartão de subpágina precisa saber da árvore (o título e o ícone mudam fora do editor). */
interface ContextoDasSubpaginas {
  paginas: readonly ResumoDaNota[];
  abrir: (id: string) => void;
}
const Contexto = createContext<ContextoDasSubpaginas>({ paginas: [], abrir: () => undefined });

function CartaoDeSubpagina({ pageId }: { pageId: string }) {
  const t = useT();
  const { paginas, abrir } = useContext(Contexto);
  const pagina = paginas.find((p) => p.id === pageId && !p.deleted_at);
  if (!pagina) return null;
  return (
    <button
      type="button"
      contentEditable={false}
      onClick={() => abrir(pageId)}
      className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm shadow-sm hover:bg-secondary"
    >
      {pagina.icon ? (
        <span className="text-lg leading-none">{pagina.icon}</span>
      ) : (
        <FileText size={18} className="text-muted-foreground" aria-hidden />
      )}
      <span className="truncate font-medium">{pagina.title || t("Sem título")}</span>
    </button>
  );
}

const criarSubpagina = createReactBlockSpec(
  { type: "subpagina", propSchema: { pageId: { default: "" } }, content: "none" },
  { render: (props) => <CartaoDeSubpagina pageId={props.block.props.pageId} /> },
);

// O envio de arquivo da agência só guarda imagem: vídeo, áudio e arquivo ficam fora do menu.
const { video: _video, audio: _audio, file: _file, ...blocosPermitidos } = defaultBlockSpecs;
const esquema = BlockNoteSchema.create({
  blockSpecs: { ...blocosPermitidos, subpagina: criarSubpagina(), ...blocosVisuais },
});

async function enviarImagem(file: File): Promise<string> {
  if (file.size > TAMANHO_MAXIMO_DA_IMAGEM) throw new Error("A imagem precisa ter até 5 MB.");
  const form = new FormData();
  form.set("file", file);
  const resposta = await fetch("/api/v1/marketing/imagens", { method: "POST", body: form });
  const corpo = (await resposta.json().catch(() => null)) as {
    data?: { arquivo?: string };
    error?: { message?: string };
  } | null;
  if (!resposta.ok || !corpo?.data?.arquivo) {
    throw new Error(corpo?.error?.message ?? "Erro ao enviar a imagem.");
  }
  return `${BASE_DAS_IMAGENS_DO_PAINEL}${corpo.data.arquivo}`;
}

export interface PropsDoEditorDeNotas {
  /** O conteúdo salvo. Lido UMA vez, ao abrir (use `key={id}` para trocar de página). */
  inicial: Documento;
  editavel: boolean;
  paginas: readonly ResumoDaNota[];
  /** O id da página aberta: as subpáginas dela são as filhas na árvore. */
  paginaId: string;
  aoMudar: (documento: Documento) => void;
  aoAbrir: (id: string) => void;
  /** Cria uma subpágina nesta página e devolve o id (ou nulo se falhou). */
  aoCriarSubpagina: () => Promise<string | null>;
  /** O cartão foi tirado do texto: a subpágina vai para a lixeira. */
  aoRemoverSubpagina: (id: string) => void;
  /** A ordem dos cartões mudou: a barra lateral segue a mesma ordem. */
  aoReordenarSubpaginas: (ids: string[]) => void;
  /** Dentro de um cartão (Início): sem a folga de tela cheia embaixo. */
  compacto?: boolean;
}

/**
 * O EDITOR DE ANOTAÇÕES, no estilo Notion: a página é um papel em branco — clique em qualquer lugar
 * e escreva; "/" abre o menu de blocos e o "+" na lateral da linha faz o mesmo; a alça arrasta
 * blocos. As SUBPÁGINAS são blocos (cartões) dentro do texto, na ordem que você arrastar.
 *
 * O documento é o do BlockNote, guardado como veio (`lib/anotacoes/documento.ts`).
 */
export default function EditorDeNotas({
  inicial,
  editavel,
  paginas,
  paginaId,
  aoMudar,
  aoAbrir,
  aoCriarSubpagina,
  aoRemoverSubpagina,
  aoReordenarSubpaginas,
  compacto = false,
}: PropsDoEditorDeNotas) {
  const t = useT();
  const { resolvedTheme } = useTheme();

  // As filhas vivas desta página, na ordem da árvore: o documento é ajustado a elas ao abrir.
  const conteudo = useMemo(() => {
    const filhas = paginas
      .filter((p) => p.parent_id === paginaId && !p.deleted_at)
      .sort((a, b) => a.position - b.position)
      .map((p) => p.id);
    return ajustarCartoes(inicial, filhas);
    // Só ao abrir: depois, quem manda no documento é quem está digitando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const editor = useCreateBlockNote(
    {
      schema: esquema,
      dictionary: locales.pt,
      initialContent: conteudo.length ? (conteudo as never) : undefined,
      uploadFile: async (file) => {
        try {
          return await enviarImagem(file);
        } catch (erro) {
          toast.error(erro instanceof Error ? erro.message : t("Erro ao enviar a imagem."));
          throw erro;
        }
      },
    },
    [],
  );

  const [cartoesIniciais] = useState(() => cartoesDoDocumento(conteudo));
  const anteriores = useRef<string[]>(cartoesIniciais);
  const ordemAplicada = useRef<string>(JSON.stringify(cartoesIniciais));

  function aoAlterar() {
    const documento = editor.document as unknown as Documento;
    aoMudar(documento);
    const atuais = cartoesDoDocumento(documento);
    // Cartão que sumiu do texto = subpágina para a lixeira (arrastar só muda de lugar, não some).
    for (const id of anteriores.current) if (!atuais.includes(id)) aoRemoverSubpagina(id);
    anteriores.current = atuais;
    const ordem = JSON.stringify(atuais);
    if (ordem !== ordemAplicada.current) {
      ordemAplicada.current = ordem;
      aoReordenarSubpaginas(atuais);
    }
  }

  function itensDoMenu(consulta: string) {
    const itens = [
      ...getDefaultSlashMenuItems(editor)
        .filter((i) => !["video", "audio", "file"].includes(i.key))
        // A tabela já nasce com a primeira linha como cabeçalho destacado.
        .map((i) =>
          i.key === "table"
            ? {
                ...i,
                onItemClick: () => {
                  const linha = () => ({ cells: ["", "", ""] });
                  insertOrUpdateBlockForSlashMenu(editor, {
                    type: "table",
                    content: {
                      type: "tableContent",
                      headerRows: 1,
                      rows: [linha(), linha(), linha()],
                    },
                  } as never);
                },
              }
            : i,
        ),
      ...ITENS_DOS_BLOCOS_VISUAIS.map((b) => ({
        key: b.tipo,
        title: t(b.titulo),
        subtext: t(b.descricao),
        aliases: b.aliases,
        group: t("Blocos visuais"),
        icon: <FileText size={18} aria-hidden />,
        onItemClick: () => {
          insertOrUpdateBlockForSlashMenu(editor, { type: b.tipo } as never);
        },
      })),
      {
        key: "subpagina",
        title: t("Subpágina"),
        subtext: t("Uma página dentro desta, como um cartão."),
        aliases: ["subpagina", "pagina", "page", "nova"],
        group: t("Páginas"),
        icon: <FileText size={18} aria-hidden />,
        onItemClick: async () => {
          const atual = editor.getTextCursorPosition().block;
          const id = await aoCriarSubpagina();
          if (!id) return;
          const vazio =
            atual.type === "paragraph" &&
            Array.isArray(atual.content) &&
            atual.content.length === 0;
          const cartao = [{ type: "subpagina" as const, props: { pageId: id } }];
          if (vazio) editor.replaceBlocks([atual], cartao as never);
          else editor.insertBlocks(cartao as never, atual, "after");
        },
      },
    ];
    return filterSuggestionItems(itens, consulta);
  }

  // ── Seleção de várias linhas ──────────────────────────────────────────────────────────────────
  // Vale de dois jeitos: arrastar o mouse no espaço em branco (retângulo) e arrastar por cima de
  // vários blocos escrevendo. Nos dois, os blocos inteiros ficam pintados e Delete/Ctrl+C/arrastar
  // valem para todos (a seleção é a do próprio editor).
  const papel = useRef<HTMLDivElement | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [retangulo, setRetangulo] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const arrastou = useRef(false);

  useEffect(
    () =>
      editor.onSelectionChange(() => {
        const ids = editor.getSelection()?.blocks.map((b) => b.id) ?? [];
        setSelecionados((atual) =>
          ids.length > 1
            ? JSON.stringify(atual) === JSON.stringify(ids)
              ? atual
              : ids
            : atual.length
              ? []
              : atual,
        );
      }),
    [editor],
  );

  function comecouArrasto(e: MouseEvent<HTMLDivElement>) {
    const caixa = papel.current;
    if (!editavel || !caixa || e.button !== 0) return;
    // Dentro do texto (ou de um botão/menu) o mouse segue escolhendo o texto, como sempre.
    if ((e.target as HTMLElement).closest(".bn-inline-content, button, a, input, [role='menu']"))
      return;
    e.preventDefault();
    const base = caixa.getBoundingClientRect();
    const x0 = e.clientX;
    const y0 = e.clientY;
    arrastou.current = false;

    const mover = (ev: globalThis.MouseEvent) => {
      if (!arrastou.current && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      arrastou.current = true;
      const esquerda = Math.min(x0, ev.clientX);
      const topo = Math.min(y0, ev.clientY);
      const largura = Math.abs(ev.clientX - x0);
      const altura = Math.abs(ev.clientY - y0);
      setRetangulo({ x: esquerda - base.left, y: topo - base.top, w: largura, h: altura });
      const dentro = [...caixa.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]")].filter(
        (el) => {
          const r = el.getBoundingClientRect();
          return (
            r.right > esquerda &&
            r.left < esquerda + largura &&
            r.bottom > topo &&
            r.top < topo + altura
          );
        },
      );
      // Só os blocos mais externos tocados: o filho vai junto com o pai.
      const raizes = dentro.filter((el) => !dentro.some((o) => o !== el && o.contains(el)));
      const ids = raizes.map((el) => el.dataset.id!).filter(Boolean);
      setSelecionados(ids.length > 1 ? ids : []);
      if (ids.length > 1) editor.setSelection(ids[0]!, ids[ids.length - 1]!);
    };
    const soltar = () => {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
      setRetangulo(null);
    };
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  }

  // Clicar no "papel" abaixo do último bloco coloca o cursor no fim, num parágrafo vazio.
  function clicouNoPapel(e: MouseEvent<HTMLDivElement>) {
    if (!editavel || e.target !== e.currentTarget) return;
    if (arrastou.current) {
      arrastou.current = false;
      return;
    }
    const blocos = editor.document;
    const ultimo = blocos[blocos.length - 1];
    if (!ultimo) return;
    const vazio =
      ultimo.type === "paragraph" && Array.isArray(ultimo.content) && ultimo.content.length === 0;
    if (vazio) {
      editor.setTextCursorPosition(ultimo, "end");
    } else {
      const [novo] = editor.insertBlocks([{ type: "paragraph" }], ultimo, "after");
      if (novo) editor.setTextCursorPosition(novo, "end");
    }
    editor.focus();
  }

  return (
    <Contexto.Provider value={{ paginas, abrir: aoAbrir }}>
      <div
        ref={papel}
        className={`relative cursor-text ${compacto ? "min-h-40 pb-8" : "min-h-[60vh] pb-32"} ${selecionados.length > 1 ? "notas-varios-selecionados" : ""}`}
        onClick={clicouNoPapel}
        onMouseDown={comecouArrasto}
      >
        {selecionados.length > 1 ? (
          <style>
            {selecionados
              .filter((id) => /^[\w-]+$/.test(id))
              .map(
                (id) =>
                  `.bn-block-outer[data-id="${id}"]>.bn-block{background:rgb(100 160 255 / .18);border-radius:4px}`,
              )
              .join("")}
          </style>
        ) : null}
        {retangulo ? (
          <div
            className="notas-retangulo"
            style={{ left: retangulo.x, top: retangulo.y, width: retangulo.w, height: retangulo.h }}
          />
        ) : null}
        <BlockNoteView
          editor={editor}
          editable={editavel}
          theme={resolvedTheme}
          slashMenu={false}
          onChange={aoAlterar}
        >
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (consulta) => itensDoMenu(consulta)}
          />
        </BlockNoteView>
      </div>
    </Contexto.Provider>
  );
}
