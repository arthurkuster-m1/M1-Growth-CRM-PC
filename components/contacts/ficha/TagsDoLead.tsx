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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { BlocoDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { invalidarCategoriasDeTags, useCategoriasDeTags, useCorDaEtiqueta } from "@/components/tags/CoresDasEtiquetas";
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
  const [novaTag, setNovaTag] = useState("");
  const [agrupar, setAgrupar] = useState(false);
  const [filtro, setFiltro] = useState<string>("");
  const [gerenciando, setGerenciando] = useState(false);
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const tags = contact.tags;
  const idDaCategoria = (tag: string) => categoriaDaTag(tag, config)?.id ?? SEM_CATEGORIA;
  const ordemDasCategorias = [...config.categorias.map((c) => c.id), SEM_CATEGORIA];
  const visiveis = filtro ? tags.filter((x) => idDaCategoria(x) === filtro) : tags;

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
  function ordenarPorCategoria() {
    const ordenadas = [...tags].sort(
      (a, b) =>
        ordemDasCategorias.indexOf(idDaCategoria(a)) - ordemDasCategorias.indexOf(idDaCategoria(b)),
    );
    void gravar(ordenadas);
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
          {podeEditar ? (
            <Button size="sm" variant="outline" onClick={ordenarPorCategoria} disabled={tags.length < 2}>
              {t("Ordenar por categoria")}
            </Button>
          ) : null}
          {podeGerirCategorias ? (
            <Button size="sm" variant="outline" onClick={() => setGerenciando(true)}>
              {t("Categorias")}
            </Button>
          ) : null}
        </div>
      }
    >
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
        <form
          className="mt-3 flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const novas = normalizarTags([novaTag]);
            if (novas.length === 0) return;
            void gravar(normalizarTags([...tags, ...novas]));
            setNovaTag("");
          }}
        >
          <Input
            value={novaTag}
            onChange={(e) => setNovaTag(e.target.value)}
            placeholder={t("Nova tag…")}
            className="h-8 w-44"
          />
          <Button size="sm" type="submit" variant="outline" disabled={!novaTag.trim()}>
            {t("Adicionar")}
          </Button>
        </form>
      ) : null}

      {gerenciando ? (
        <GerenciarCategorias aberto aoFechar={() => setGerenciando(false)} config={config} />
      ) : null}
    </BlocoDaFicha>
  );
}
