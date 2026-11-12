"use client";

import "@blocknote/mantine/style.css";

import {
  BlockNoteSchema,
  defaultBlockSpecs,
  filterSuggestionItems,
  getDefaultSlashMenuItems,
} from "@blocknote/core";
import * as locales from "@blocknote/core/locales";
import {
  SuggestionMenuController,
  createReactBlockSpec,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { createContext, useContext, useMemo, useRef, useState, type MouseEvent } from "react";
import { toast } from "sonner";

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
  blockSpecs: { ...blocosPermitidos, subpagina: criarSubpagina() },
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
      ...getDefaultSlashMenuItems(editor).filter(
        (i) => !["video", "audio", "file"].includes(i.key),
      ),
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

  // Clicar no "papel" abaixo do último bloco coloca o cursor no fim, num parágrafo vazio.
  function clicouNoPapel(e: MouseEvent<HTMLDivElement>) {
    if (!editavel || e.target !== e.currentTarget) return;
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
      <div className="min-h-[60vh] cursor-text pb-32" onClick={clicouNoPapel}>
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
