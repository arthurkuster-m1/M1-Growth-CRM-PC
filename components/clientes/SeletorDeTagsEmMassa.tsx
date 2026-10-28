"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";

import { ChipDeEtiqueta } from "@/components/tags/ChipDeEtiqueta";
import { invalidarCategoriasDeTags, useCategoriasDeTags } from "@/components/tags/CoresDasEtiquetas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useActiveOrg } from "@/hooks/auth/AuthProvider";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { ROLE_RANK } from "@/lib/auth/types";
import { normalizarTag } from "@/lib/contacts/tag-normalizada";
import { categoriaDaTag, tagEhAutomatica } from "@/lib/tags/categorias";
import { chaveDaEtiqueta, PALETA_DE_ETIQUETAS } from "@/lib/tags/cor-da-etiqueta";
import { Plus, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const SEM_CATEGORIA = "__sem__";
const NOVA_CATEGORIA = "__nova__";
/** As categorias que o sistema preenche sozinho: nenhuma tag digitada à mão entra nelas. */
const CATEGORIAS_DO_SISTEMA: ReadonlySet<string> = new Set(["acao", "tracking", "funil", "qualificacao"]);

/**
 * Escolher tags para aplicar em vários leads, no mesmo jeito da ficha do lead: as tags já
 * existentes agrupadas por CATEGORIA e pintadas como etiquetas (clique marca e desmarca), mais o
 * campo "Nova tag…". O que está marcado aparece no topo, pronto para aplicar.
 */
export function SeletorDeTagsEmMassa({
  existentes,
  escolhidas,
  aoMudar,
}: {
  existentes: readonly string[];
  escolhidas: readonly string[];
  aoMudar: (tags: string[]) => void;
}) {
  const t = useT();
  const config = useCategoriasDeTags();
  const [nova, setNova] = useState("");
  const [busca, setBusca] = useState("");

  const marcadas = new Set(escolhidas);
  const alternar = (tag: string) =>
    aoMudar(marcadas.has(tag) ? escolhidas.filter((x) => x !== tag) : [...escolhidas, tag]);

  // Tag de rastreio, funil, ação e MQL é do sistema: não se escolhe nem se cria à mão.
  const manuais = existentes.filter((x) => !tagEhAutomatica(x, config));
  const todas = [...new Set([...manuais, ...escolhidas])].sort((a, b) => a.localeCompare(b));
  const termo = busca.trim().toLowerCase();
  const visiveis = termo ? todas.filter((x) => x.toLowerCase().includes(termo)) : todas;

  const idDaCategoria = (tag: string) => categoriaDaTag(tag, config)?.id ?? SEM_CATEGORIA;
  const grupos = [...config.categorias.map((c) => c.id), SEM_CATEGORIA]
    .map((id) => ({
      id,
      categoria: config.categorias.find((c) => c.id === id) ?? null,
      itens: visiveis.filter((x) => idDaCategoria(x) === id),
    }))
    .filter((g) => g.itens.length > 0);

  const [aviso, setAviso] = useState<string | null>(null);
  // Escolher (ou criar) a categoria da tag nova, na hora de criá-la — só quem gerencia as categorias.
  const org = useActiveOrg();
  const podeGerirCategorias = ROLE_RANK[org?.role ?? "viewer"] >= ROLE_RANK.manager;
  const queryClient = useQueryClient();
  const [categoriaDaNova, setCategoriaDaNova] = useState(SEM_CATEGORIA);
  const [nomeDaCategoria, setNomeDaCategoria] = useState("");
  const [corDaCategoria, setCorDaCategoria] = useState<string>(PALETA_DE_ETIQUETAS[4]!);
  const categoriasManuais = config.categorias.filter((c) => !CATEGORIAS_DO_SISTEMA.has(c.id));

  const textoNovo = normalizarTag(nova);
  const sugestoes = textoNovo
    ? todas.filter((x) => x.toLowerCase().includes(textoNovo) && !marcadas.has(x)).slice(0, 8)
    : [];
  const jaExiste = todas.includes(textoNovo);

  async function adicionarNova() {
    const tag = normalizarTag(nova);
    if (!tag) return;
    if (tagEhAutomatica(tag, config)) {
      setAviso(
        t(
          "Essa tag é criada pelo sistema (origem, funil, ação ou MQL) e não pode ser adicionada à mão.",
        ),
      );
      return;
    }
    setAviso(null);
    if (podeGerirCategorias && !jaExiste && categoriaDaNova !== SEM_CATEGORIA) {
      const criando = categoriaDaNova === NOVA_CATEGORIA;
      const nome = nomeDaCategoria.trim();
      if (criando && !nome) {
        setAviso(t("Dê um nome para a nova categoria."));
        return;
      }
      const id = criando ? `c_${Date.now().toString(36)}` : categoriaDaNova;
      const categorias = criando ? [...config.categorias, { id, nome, cor: corDaCategoria }] : config.categorias;
      try {
        await apiClient.put("/api/v1/tags/categorias", {
          categorias: categorias.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor })),
          tags: { ...config.tags, [chaveDaEtiqueta(tag)]: id },
        });
        invalidarCategoriasDeTags(queryClient);
      } catch (e) {
        showApiError(e);
        return;
      }
    }
    if (!marcadas.has(tag)) aoMudar([...escolhidas, tag]);
    setNova("");
    setNomeDaCategoria("");
    setCategoriaDaNova(SEM_CATEGORIA);
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <p className="text-xs font-medium text-muted-foreground">{t("Tags a aplicar")}</p>
        {escolhidas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Escolha abaixo ou crie uma nova.")}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {escolhidas.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => alternar(tag)}
                aria-label={`${t("Tirar")} ${tag}`}
                className="rounded-full"
              >
                <ChipDeEtiqueta tag={tag} contorno>
                  <X size={11} weight="bold" aria-hidden className="ml-1.5" />
                </ChipDeEtiqueta>
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void adicionarNova();
        }}
      >
        <div className="flex items-center gap-1.5">
          <Input
            value={nova}
            maxLength={60}
            onChange={(e) => {
              setNova(e.target.value);
              setAviso(null);
            }}
            placeholder={t("Buscar ou criar tag…")}
            className="h-9"
          />
          <Button type="submit" size="sm" variant="outline" disabled={!nova.trim()}>
            <Plus size={14} weight="bold" aria-hidden className="mr-1" />
            {jaExiste ? t("Usar") : t("Criar")}
          </Button>
        </div>

        {sugestoes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 rounded-xl border bg-muted/30 p-2">
            {sugestoes.map((tag) => (
              <button key={tag} type="button" onClick={() => alternar(tag)} className="rounded-full">
                <ChipDeEtiqueta tag={tag} contorno />
              </button>
            ))}
          </div>
        ) : null}

        {textoNovo && !jaExiste && podeGerirCategorias ? (
          <div className="grid gap-2 rounded-xl border p-2.5">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              {t("Categoria da nova tag")}
              <select
                value={categoriaDaNova}
                onChange={(e) => setCategoriaDaNova(e.target.value)}
                className="h-9 rounded-xl border bg-card px-2 text-sm text-foreground"
              >
                <option value={SEM_CATEGORIA}>{t("Sem categoria")}</option>
                {categoriasManuais.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
                <option value={NOVA_CATEGORIA}>{t("+ Nova categoria…")}</option>
              </select>
            </label>
            {categoriaDaNova === NOVA_CATEGORIA ? (
              <div className="grid gap-2">
                <Input
                  value={nomeDaCategoria}
                  maxLength={40}
                  onChange={(e) => setNomeDaCategoria(e.target.value)}
                  placeholder={t("Nome da categoria")}
                  className="h-9"
                />
                <div className="flex flex-wrap gap-1.5">
                  {PALETA_DE_ETIQUETAS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      aria-pressed={corDaCategoria === c}
                      onClick={() => setCorDaCategoria(c)}
                      className={cn(
                        "size-6 rounded-full border",
                        corDaCategoria === c && "outline-2 outline-offset-2 outline-primary",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </form>

      {aviso ? <p className="text-xs text-error-fg">{aviso}</p> : null}

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{t("Tags existentes")}</p>
          {todas.length > 0 ? (
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={t("Buscar…")}
              className="h-8 w-40"
            />
          ) : null}
        </div>
        <div className="grid max-h-64 gap-2.5 overflow-y-auto pr-1">
          {grupos.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("Nenhuma tag ainda.")}</p>
          ) : (
            grupos.map((g) => (
              <div
                key={g.id}
                className="rounded-xl border border-l-4 p-2.5"
                style={g.categoria ? { borderLeftColor: g.categoria.cor } : undefined}
              >
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {g.categoria?.nome ?? t("Sem categoria")} · {g.itens.length}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {g.itens.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={marcadas.has(tag)}
                      onClick={() => alternar(tag)}
                      className={cn(
                        "rounded-full outline-offset-2 transition-opacity",
                        marcadas.has(tag)
                          ? "outline-2 outline-primary"
                          : "opacity-80 hover:opacity-100",
                      )}
                    >
                      <ChipDeEtiqueta tag={tag} contorno />
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
