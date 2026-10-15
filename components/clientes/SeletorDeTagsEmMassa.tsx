"use client";

import { useState } from "react";

import { ChipDeEtiqueta } from "@/components/tags/ChipDeEtiqueta";
import { useCategoriasDeTags } from "@/components/tags/CoresDasEtiquetas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/i18n/useT";
import { normalizarTag } from "@/lib/contacts/tag-normalizada";
import { categoriaDaTag } from "@/lib/tags/categorias";
import { Plus, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const SEM_CATEGORIA = "__sem__";

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

  const todas = [...new Set([...existentes, ...escolhidas])].sort((a, b) => a.localeCompare(b));
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

  function adicionarNova() {
    const tag = normalizarTag(nova);
    if (!tag) return;
    if (!marcadas.has(tag)) aoMudar([...escolhidas, tag]);
    setNova("");
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
        className="flex items-center gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          adicionarNova();
        }}
      >
        <Input
          value={nova}
          maxLength={60}
          onChange={(e) => setNova(e.target.value)}
          placeholder={t("Nova tag…")}
          className="h-9"
        />
        <Button type="submit" size="sm" variant="outline" disabled={!nova.trim()}>
          <Plus size={14} weight="bold" aria-hidden className="mr-1" />
          {t("Adicionar")}
        </Button>
      </form>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{t("Tags existentes")}</p>
          {todas.length > 8 ? (
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
