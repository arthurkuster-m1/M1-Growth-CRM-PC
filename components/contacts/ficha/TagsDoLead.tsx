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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { BlocoDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { invalidarCategoriasDeTags, useCategoriasDeTags, useCorDaEtiqueta } from "@/components/tags/CoresDasEtiquetas";
import { SeletorDeTagsEmMassa } from "@/components/clientes/SeletorDeTagsEmMassa";
import { ChipDeEtiqueta } from "@/components/tags/ChipDeEtiqueta";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { normalizarTag, normalizarTags } from "@/lib/contacts/tag-normalizada";
import { categoriaDaTag, type CategoriaDeTag, type ConfigDeCategorias } from "@/lib/tags/categorias";
import { chaveDaEtiqueta, PALETA_DE_ETIQUETAS } from "@/lib/tags/cor-da-etiqueta";
import { Plus, Trash, X } from "@/lib/ui/icons";
import type { Contact } from "@/lib/types/contacts";

const SEM_CATEGORIA = "__sem__";

/** Um filtro de tags que a pessoa criou e nomeou. */
interface FiltroDeTags {
  id: string;
  nome: string;
  /** Categorias envolvidas (ids; `__sem__` = sem categoria). Vazio = todas. */
  categorias: string[];
  /** "mostrar" = só as dessas categorias; "esconder" = tudo, menos elas. */
  modo: "mostrar" | "esconder";
  /** A tag precisa conter este texto (sem diferenciar caixa nem acento). */
  texto: string;
}

const CHAVE_DOS_FILTROS = "m1.tags-do-lead.filtros";

function lerFiltrosGuardados(): FiltroDeTags[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE_DOS_FILTROS);
    const lista = bruto ? (JSON.parse(bruto) as unknown) : [];
    if (!Array.isArray(lista)) return [];
    return lista.flatMap((f) => {
      const x = f as Partial<FiltroDeTags>;
      return typeof x.id === "string" && typeof x.nome === "string"
        ? [
            {
              id: x.id,
              nome: x.nome.slice(0, 40),
              categorias: Array.isArray(x.categorias) ? x.categorias.map(String) : [],
              modo: x.modo === "esconder" ? ("esconder" as const) : ("mostrar" as const),
              texto: typeof x.texto === "string" ? x.texto.slice(0, 60) : "",
            },
          ]
        : [];
    });
  } catch {
    return [];
  }
}

const semAcento = (x: string) =>
  x.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** A tag passa pelo filtro? (categoria escolhida ou não; texto contido ou não.) */
function passaNoFiltro(f: FiltroDeTags, idDaCategoria: string, tag: string): boolean {
  const naLista = f.categorias.length === 0 ? true : f.categorias.includes(idDaCategoria);
  const categoriaOk = f.modo === "esconder" ? !(f.categorias.length > 0 && naLista) : naLista;
  const textoOk = f.texto.trim() === "" || semAcento(tag).includes(semAcento(f.texto.trim()));
  return categoriaOk && textoOk;
}

async function gravarConfig(config: ConfigDeCategorias) {
  await apiClient.put("/api/v1/tags/categorias", {
    categorias: config.categorias.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor })),
    tags: config.tags,
  });
}

function ChipArrastavel({
  tag,
  config,
  podeEditar,
  podeGerir,
  aoRenomear,
  aoRemover,
  aoMoverDeCategoria,
}: {
  tag: string;
  config: ConfigDeCategorias;
  podeEditar: boolean;
  podeGerir: boolean;
  aoRenomear: (novo: string) => void;
  aoRemover: () => void;
  aoMoverDeCategoria: (categoriaId: string) => void;
}) {
  const t = useT();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tag,
    disabled: !podeEditar,
  });
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(tag);
  const categoria = categoriaDaTag(tag, config);
  const cor = useCorDaEtiqueta(tag);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      {...attributes}
      {...listeners}
      className="touch-none"
    >
      <Popover
        open={aberto}
        onOpenChange={(a) => {
          setAberto(a);
          if (a) setNome(tag);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            title={categoria ? `${t("Categoria")}: ${categoria.nome}` : t("Sem categoria")}
            className="cursor-grab rounded-full focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-hidden"
          >
            <ChipDeEtiqueta tag={tag} cor={cor} contorno />
          </button>
        </PopoverTrigger>
        {podeEditar ? (
          <PopoverContent align="start" className="w-72 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">{t("Nome da tag")}</p>
            <div className="flex gap-1">
              <Input value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} className="h-8" />
              <Button
                size="sm"
                disabled={!nome.trim() || normalizarTag(nome) === tag}
                onClick={() => {
                  aoRenomear(normalizarTag(nome));
                  setAberto(false);
                }}
              >
                {t("Salvar")}
              </Button>
            </div>
            <p className="mt-3 mb-1 text-xs font-medium text-muted-foreground">{t("Categoria")}</p>
            <select
              className="h-8 w-full rounded-lg border bg-background px-2 text-sm disabled:opacity-60"
              disabled={!podeGerir}
              value={categoria?.id ?? SEM_CATEGORIA}
              onChange={(e) => {
                aoMoverDeCategoria(e.target.value);
                setAberto(false);
              }}
            >
              <option value={SEM_CATEGORIA}>{t("Sem categoria")}</option>
              {config.categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {!podeGerir ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("Só gerentes mudam a categoria de uma tag.")}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => {
                aoRemover();
                setAberto(false);
              }}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-error-fg hover:underline"
            >
              <X size={12} weight="bold" aria-hidden />
              {t("Remover do lead")}
            </button>
          </PopoverContent>
        ) : null}
      </Popover>
    </div>
  );
}

function FiltrosPersonalizados({
  config,
  filtros,
  ativoId,
  aoMudarFiltros,
  aoEscolher,
}: {
  config: ConfigDeCategorias;
  filtros: FiltroDeTags[];
  ativoId: string;
  aoMudarFiltros: (f: FiltroDeTags[]) => void;
  aoEscolher: (id: string) => void;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [modo, setModo] = useState<"mostrar" | "esconder">("mostrar");
  const [texto, setTexto] = useState("");
  const opcoes = [
    ...config.categorias.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor })),
    { id: SEM_CATEGORIA, nome: t("Sem categoria"), cor: "#9ca3af" },
  ];
  const podeCriar = nome.trim() !== "" && (categorias.length > 0 || texto.trim() !== "");

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          {t("Meus filtros")}
          {filtros.length > 0 ? ` (${filtros.length})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        {filtros.length > 0 ? (
          <ul className="mb-3 grid gap-1.5">
            {filtros.map((f) => (
              <li key={f.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    aoEscolher(f.id === ativoId ? "" : f.id);
                    setAberto(false);
                  }}
                  className={`min-w-0 flex-1 truncate rounded-full border-[1.5px] px-3 py-1 text-left text-sm font-medium ${
                    f.id === ativoId ? "border-primary bg-primary/10" : "hover:bg-secondary"
                  }`}
                >
                  {f.nome}
                </button>
                <button
                  type="button"
                  aria-label={`${t("Apagar o filtro")} ${f.nome}`}
                  onClick={() => {
                    aoMudarFiltros(filtros.filter((x) => x.id !== f.id));
                    if (f.id === ativoId) aoEscolher("");
                  }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
                >
                  <Trash size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-xs text-muted-foreground">
            {t("Nenhum filtro seu ainda. Crie um abaixo.")}
          </p>
        )}

        <div className="grid gap-2 border-t pt-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Novo filtro")}
          </p>
          <Input
            value={nome}
            maxLength={40}
            placeholder={t("Nome do filtro (ex.: Só ações)")}
            onChange={(e) => setNome(e.target.value)}
            className="h-8"
          />
          <div className="flex gap-1.5" role="radiogroup" aria-label={t("Modo")}>
            {(
              [
                ["mostrar", t("Mostrar só")],
                ["esconder", t("Esconder")],
              ] as const
            ).map(([v, r]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={modo === v}
                onClick={() => setModo(v)}
                className={`h-8 flex-1 rounded-lg border text-xs font-medium ${
                  modo === v ? "border-primary bg-primary/10" : "hover:bg-secondary"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {opcoes.map((o) => {
              const marcado = categorias.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  aria-pressed={marcado}
                  onClick={() =>
                    setCategorias((a) => (marcado ? a.filter((x) => x !== o.id) : [...a, o.id]))
                  }
                  className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-1 text-xs font-medium"
                  style={{
                    borderColor: marcado ? o.cor : undefined,
                    backgroundColor: marcado ? `color-mix(in srgb, ${o.cor} 16%, transparent)` : undefined,
                  }}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: o.cor }} />
                  {o.nome}
                </button>
              );
            })}
          </div>
          <Input
            value={texto}
            maxLength={60}
            placeholder={t("O nome da tag contém… (opcional)")}
            onChange={(e) => setTexto(e.target.value)}
            className="h-8"
          />
          <Button
            size="sm"
            disabled={!podeCriar}
            onClick={() => {
              const novo: FiltroDeTags = {
                id: `f_${Date.now().toString(36)}`,
                nome: nome.trim(),
                categorias,
                modo,
                texto: texto.trim(),
              };
              aoMudarFiltros([...filtros, novo]);
              aoEscolher(novo.id);
              setNome("");
              setCategorias([]);
              setTexto("");
              setAberto(false);
            }}
          >
            {t("Salvar e aplicar o filtro")}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            {t("Os filtros ficam guardados neste navegador.")}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LinhaDeCategoriaArrastavel({ categoria }: { categoria: CategoriaDeTag }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: categoria.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      {...attributes}
      {...listeners}
      className="flex cursor-grab touch-none items-center gap-2 rounded-xl border border-l-4 bg-card px-3 py-2 text-sm active:cursor-grabbing"
    >
      <span aria-hidden className="text-muted-foreground">
        ⠿
      </span>
      <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: categoria.cor }} />
      <span className="min-w-0 flex-1 truncate font-medium">{categoria.nome}</span>
    </li>
  );
}

/**
 * ORDEM DAS CATEGORIAS: um mini popup com as categorias, para arrastar até a ordem desejada. "Aplicar"
 * ordena as tags do lead por ela; o gerente pode guardar a ordem para todos.
 */
function OrdemDasCategorias({
  config,
  podeGuardar,
  desabilitado,
  aoAplicar,
}: {
  config: ConfigDeCategorias;
  podeGuardar: boolean;
  desabilitado: boolean;
  aoAplicar: (ordem: string[], guardar: boolean) => Promise<void>;
}) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [ordem, setOrdem] = useState<string[]>(() => config.categorias.map((c) => c.id));
  const [guardar, setGuardar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const porId = new Map(config.categorias.map((c) => [c.id, c]));

  return (
    <Popover
      open={aberto}
      onOpenChange={(a) => {
        setAberto(a);
        if (a) setOrdem(config.categorias.map((c) => c.id));
      }}
    >
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={desabilitado}>
          {t("Ordenar por categoria")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          {t("Arraste as categorias para mudar a ordem. As tags do lead seguem essa ordem.")}
        </p>
        <DndContext
          sensors={sensores}
          collisionDetection={closestCenter}
          onDragEnd={(e: DragEndEvent) => {
            const { active, over } = e;
            if (!over || active.id === over.id) return;
            const de = ordem.indexOf(String(active.id));
            const para = ordem.indexOf(String(over.id));
            if (de >= 0 && para >= 0) setOrdem(arrayMove(ordem, de, para));
          }}
        >
          <SortableContext items={ordem} strategy={verticalListSortingStrategy}>
            <ul className="grid gap-1.5">
              {ordem.map((id) => {
                const c = porId.get(id);
                return c ? <LinhaDeCategoriaArrastavel key={id} categoria={c} /> : null;
              })}
            </ul>
          </SortableContext>
        </DndContext>
        <p className="mt-1.5 rounded-xl border border-dashed px-3 py-1.5 text-xs text-muted-foreground">
          {t("Sem categoria")} · {t("sempre por último")}
        </p>
        {podeGuardar ? (
          <label className="mt-3 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={guardar} onChange={(e) => setGuardar(e.target.checked)} />
            {t("Guardar esta ordem para todos")}
          </label>
        ) : null}
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>
            {t("Cancelar")}
          </Button>
          <Button
            size="sm"
            disabled={ocupado}
            onClick={() => {
              setOcupado(true);
              void aoAplicar(ordem, guardar).finally(() => {
                setOcupado(false);
                setAberto(false);
              });
            }}
          >
            {t("Aplicar a ordem")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function GerenciarCategorias({
  aberto,
  aoFechar,
  config,
}: {
  aberto: boolean;
  aoFechar: () => void;
  config: ConfigDeCategorias;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [lista, setLista] = useState<CategoriaDeTag[]>(() => config.categorias.map((c) => ({ ...c })));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await gravarConfig({ categorias: lista, tags: config.tags });
      invalidarCategoriasDeTags(queryClient);
      toast.success(t("Categorias salvas"));
      aoFechar();
    } catch (e) {
      showApiError(e);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Categorias de tags")}</DialogTitle>
          <DialogDescription>
            {t("Cada categoria tem uma cor, e todas as tags dela usam essa cor.")}
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-3">
          {lista.map((c, i) => (
            <li key={c.id} className="rounded-xl border border-l-4 p-3" style={{ borderLeftColor: c.cor }}>
              <div className="flex items-center gap-2">
                <Input
                  value={c.nome}
                  maxLength={40}
                  onChange={(e) =>
                    setLista((a) => a.map((x, k) => (k === i ? { ...x, nome: e.target.value } : x)))
                  }
                  className="h-8"
                />
                {c.padrao ? null : (
                  <button
                    type="button"
                    aria-label={`${t("Apagar")} ${c.nome}`}
                    onClick={() => setLista((a) => a.filter((_, k) => k !== i))}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
                  >
                    <Trash size={14} aria-hidden />
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("Cor")}>
                {PALETA_DE_ETIQUETAS.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    role="radio"
                    aria-checked={c.cor === cor}
                    aria-label={cor}
                    onClick={() =>
                      setLista((a) => a.map((x, k) => (k === i ? { ...x, cor } : x)))
                    }
                    className="size-6 rounded-full border-2"
                    style={{
                      backgroundColor: cor,
                      borderColor: c.cor === cor ? "var(--foreground)" : "transparent",
                    }}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setLista((a) => [
              ...a,
              { id: `c_${Date.now().toString(36)}`, nome: t("Nova categoria"), cor: PALETA_DE_ETIQUETAS[5]! },
            ])
          }
        >
          <Plus size={14} weight="bold" aria-hidden className="mr-1" />
          {t("Nova categoria")}
        </Button>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={aoFechar} disabled={salvando}>
            {t("Cancelar")}
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando || lista.some((c) => !c.nome.trim())}>
            {salvando ? t("Salvando…") : t("Salvar categorias")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * AS TAGS DO LEAD: coloridas pela CATEGORIA (Ação, Tracking, Funil, Qualificação…), editáveis
 * (nome e categoria), na ordem que a equipe quiser (arrastar) ou ordenadas por categoria, e com
 * visão agrupada e filtro por categoria.
 */
export function TagsDoLead({
  contact,
  podeEditar,
  podeGerirCategorias,
}: {
  contact: Contact;
  podeEditar: boolean;
  podeGerirCategorias: boolean;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const config = useCategoriasDeTags();
  const atualizar = useUpdateContact(contact.id);
  const [novasTags, setNovasTags] = useState<string[]>([]);
  const [adicionando, setAdicionando] = useState(false);
  // As tags que já existem na base, para escolher em vez de digitar (as automáticas ficam de fora).
  const existentes = useQuery({
    queryKey: ["tags-existentes"],
    staleTime: 60_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { tags: string[] } }>("/api/v1/tags/existentes")).data.tags,
  });
  const [agrupar, setAgrupar] = useState(false);
  const [filtro, setFiltro] = useState<string>("");
  const [gerenciando, setGerenciando] = useState(false);
  // Filtros personalizados (nome + categorias + texto), guardados neste navegador.
  const [meusFiltros, setMeusFiltros] = useState<FiltroDeTags[]>(() =>
    typeof window === "undefined" ? [] : lerFiltrosGuardados(),
  );
  const [filtroPersonalizadoId, setFiltroPersonalizadoId] = useState("");
  function guardarFiltros(lista: FiltroDeTags[]) {
    setMeusFiltros(lista);
    try {
      window.localStorage.setItem(CHAVE_DOS_FILTROS, JSON.stringify(lista));
    } catch {
      /* sem armazenamento: o filtro vale só nesta tela */
    }
  }
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const tags = contact.tags;
  const idDaCategoria = (tag: string) => categoriaDaTag(tag, config)?.id ?? SEM_CATEGORIA;
  const ordemDasCategorias = [...config.categorias.map((c) => c.id), SEM_CATEGORIA];
  const filtroPersonalizado = meusFiltros.find((f) => f.id === filtroPersonalizadoId) ?? null;
  const visiveis = tags
    .filter((x) => (filtro ? idDaCategoria(x) === filtro : true))
    .filter((x) =>
      filtroPersonalizado ? passaNoFiltro(filtroPersonalizado, idDaCategoria(x), x) : true,
    );

  async function gravar(lista: string[]) {
    try {
      await atualizar.mutateAsync({ tags: lista });
    } catch {
      /* o hook já avisou */
    }
  }
  function aoSoltar(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const de = tags.indexOf(String(active.id));
    const para = tags.indexOf(String(over.id));
    if (de < 0 || para < 0) return;
    void gravar(arrayMove(tags, de, para));
  }
  /** Ordena as tags do lead pela ordem escolhida; o gerente pode guardar a ordem das categorias. */
  async function aplicarOrdemDasCategorias(ordem: string[], guardar: boolean) {
    const ranque = [...ordem, SEM_CATEGORIA];
    const ordenadas = [...tags].sort(
      (a, b) => ranque.indexOf(idDaCategoria(a)) - ranque.indexOf(idDaCategoria(b)),
    );
    await gravar(ordenadas);
    if (guardar && podeGerirCategorias) {
      const porId = new Map(config.categorias.map((c) => [c.id, c]));
      const reordenadas = ordem.flatMap((id) => (porId.has(id) ? [porId.get(id)!] : []));
      try {
        await gravarConfig({ categorias: reordenadas, tags: config.tags });
        invalidarCategoriasDeTags(queryClient);
      } catch (e) {
        showApiError(e);
      }
    }
  }
  async function moverDeCategoria(tag: string, categoriaId: string) {
    const novo: ConfigDeCategorias = { categorias: config.categorias, tags: { ...config.tags } };
    const chave = chaveDaEtiqueta(tag).replace(/:\s*\d+x$/, "").trim();
    if (categoriaId === SEM_CATEGORIA) delete novo.tags[chave];
    else novo.tags[chave] = categoriaId;
    try {
      await gravarConfig(novo);
      invalidarCategoriasDeTags(queryClient);
    } catch (e) {
      showApiError(e);
    }
  }

  const grupos = ordemDasCategorias
    .map((id) => ({
      id,
      categoria: config.categorias.find((c) => c.id === id) ?? null,
      itens: visiveis.filter((x) => idDaCategoria(x) === id),
    }))
    .filter((g) => g.itens.length > 0);

  const chips = (lista: string[]) => (
    <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
      <SortableContext items={lista} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-wrap items-center gap-2">
          {lista.map((tag) => (
            <ChipArrastavel
              key={tag}
              tag={tag}
              config={config}
              podeEditar={podeEditar}
              podeGerir={podeGerirCategorias}
              aoRenomear={(novo) =>
                void gravar(normalizarTags(tags.map((x) => (x === tag ? novo : x))))
              }
              aoRemover={() => void gravar(tags.filter((x) => x !== tag))}
              aoMoverDeCategoria={(id) => void moverDeCategoria(tag, id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );

  return (
    <BlocoDaFicha
      titulo={t("Tags")}
      cor="red"
      acao={
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t("Filtrar por categoria")}
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="h-8 rounded-lg border bg-background px-2 text-xs"
          >
            <option value="">{t("Todas as categorias")}</option>
            {config.categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
            <option value={SEM_CATEGORIA}>{t("Sem categoria")}</option>
          </select>
          <label className="flex items-center gap-1.5 text-xs">
            <input type="checkbox" checked={agrupar} onChange={(e) => setAgrupar(e.target.checked)} />
            {t("Agrupar")}
          </label>
          <FiltrosPersonalizados
            config={config}
            filtros={meusFiltros}
            ativoId={filtroPersonalizadoId}
            aoMudarFiltros={guardarFiltros}
            aoEscolher={setFiltroPersonalizadoId}
          />
          {podeEditar ? (
            <OrdemDasCategorias
              config={config}
              podeGuardar={podeGerirCategorias}
              desabilitado={tags.length < 2}
              aoAplicar={aplicarOrdemDasCategorias}
            />
          ) : null}
          {podeGerirCategorias ? (
            <Button size="sm" variant="outline" onClick={() => setGerenciando(true)}>
              {t("Categorias")}
            </Button>
          ) : null}
        </div>
      }
    >
      {filtroPersonalizado ? (
        <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
          {t("Filtro ativo")}: <strong className="text-foreground">{filtroPersonalizado.nome}</strong>
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => setFiltroPersonalizadoId("")}
          >
            {t("Limpar")}
          </button>
        </p>
      ) : null}
      {tags.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Sem tags.")}</p>
      ) : visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Nenhuma tag nesta categoria.")}</p>
      ) : agrupar ? (
        <div className="grid gap-3">
          {grupos.map((g) => (
            <div key={g.id} className="rounded-xl border border-l-4 p-2.5" style={{ borderLeftColor: g.categoria?.cor }}>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {g.categoria?.nome ?? t("Sem categoria")} · {g.itens.length}
              </p>
              {chips(g.itens)}
            </div>
          ))}
        </div>
      ) : (
        chips(visiveis)
      )}

      {podeEditar ? (
        <Popover open={adicionando} onOpenChange={setAdicionando}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="mt-3">
              <Plus size={14} weight="bold" aria-hidden className="mr-1" />
              {t("Adicionar tag")}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(92vw,420px)] p-3">
            <SeletorDeTagsEmMassa
              existentes={existentes.data ?? []}
              escolhidas={novasTags}
              aoMudar={setNovasTags}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setNovasTags([]);
                  setAdicionando(false);
                }}
              >
                {t("Cancelar")}
              </Button>
              <Button
                size="sm"
                disabled={novasTags.length === 0}
                onClick={() => {
                  void gravar(normalizarTags([...tags, ...novasTags]));
                  setNovasTags([]);
                  setAdicionando(false);
                }}
              >
                {t("Aplicar")}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      {gerenciando ? (
        <GerenciarCategorias aberto aoFechar={() => setGerenciando(false)} config={config} />
      ) : null}
    </BlocoDaFicha>
  );
}
