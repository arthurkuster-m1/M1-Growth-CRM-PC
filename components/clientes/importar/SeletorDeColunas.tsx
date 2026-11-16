"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/hooks/i18n/useT";
import { moverColuna, mostrarColuna, ocultarColuna } from "@/lib/leads/ordem-das-colunas";
import {
  CaretDown,
  CaretRight,
  DotsSixVertical,
  Eye,
  EyeSlash,
  Plus,
  SlidersHorizontal,
} from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface ColunaDisponivel {
  id: string;
  rotulo: string;
}

const TIPO_DO_ARRASTO = "application/x-coluna-de-lead";

const GRUPO_DE: Record<string, string> = {
  titulo: "cadastro",
  telefone: "cadastro",
  email: "cadastro",
  nascimento: "cadastro",
  etiquetas: "cadastro",
  descricao: "cadastro",
  data_entrada: "data",
  hora_entrada: "data",
  origem: "origem",
  campanha: "origem",
  conjunto: "origem",
  anuncio: "origem",
  landing_page: "origem",
  posicionamento: "origem",
};

function grupoDe(id: string): string {
  if (id.startsWith("link_")) return "links";
  if (id.startsWith("campo:")) return "campos-do-funil";
  if (id.startsWith("extra:")) return "personalizados";
  return GRUPO_DE[id] ?? "funil-e-venda";
}

/**
 * O botão "Colunas". Em cima, a lista das colunas que estão NA TABELA, uma embaixo da outra:
 * dá para pegar e arrastar qualquer uma para mudar de lugar (a mesma ordem do cabeçalho da
 * tabela) e esconder qualquer uma — Nome, E-mail e Data inclusive. Embaixo, as categorias
 * (Cadastro, Data e horário, Origem, Links…) abrem e fecham como toggles: cada uma lista as
 * colunas dela com um interruptor para mostrar ou esconder. A coluna que entra vai para o fim da
 * tabela e dá para arrastá-la para onde quiser. O que se digitou numa coluna escondida fica guardado.
 */
export function SeletorDeColunas({
  todas,
  visiveis,
  sugeridas,
  aoMudar,
  aoCriarPersonalizada,
}: {
  todas: ColunaDisponivel[];
  visiveis: string[];
  /** Campos personalizados que já existem em outros funis (sugestões de coluna nova). */
  sugeridas: string[];
  aoMudar: (novas: string[]) => void;
  aoCriarPersonalizada: (nome: string) => void;
}) {
  const t = useT();
  const [nova, setNova] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [sobre, setSobre] = useState<string | null>(null);
  const porId = new Map(todas.map((c) => [c.id, c]));
  const lista = visiveis.map((id) => porId.get(id)).filter((c): c is ColunaDisponivel => !!c);

  const GRUPOS: Array<[string, string]> = [
    ["cadastro", t("Cadastro")],
    ["data", t("Data e horário")],
    ["origem", t("Origem")],
    ["funil-e-venda", t("Funil e venda")],
    ["links", t("Links")],
    ["campos-do-funil", t("Campos do funil")],
    ["personalizados", t("Campos personalizados")],
  ];
  const jaTem = new Set(todas.map((c) => c.rotulo.toLowerCase()));
  const sugestoes = sugeridas.filter((r) => !jaTem.has(r.toLowerCase()));

  const alternarGrupo = (g: string) =>
    setAbertos((a) => {
      const n = new Set(a);
      if (n.has(g)) n.delete(g);
      else n.add(g);
      return n;
    });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" data-testid="colunas-da-importacao">
          <SlidersHorizontal size={16} aria-hidden className="mr-1.5" />
          {t("Colunas")} ({lista.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="max-h-[var(--radix-popover-content-available-height)] w-[min(94vw,420px)] overflow-y-auto overscroll-contain p-3"
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Na tabela")} ({lista.length})
          </p>
          <div className="flex gap-3 text-xs">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-40"
              disabled={lista.length === todas.length}
              onClick={() =>
                aoMudar([
                  ...visiveis,
                  ...todas.filter((c) => !visiveis.includes(c.id)).map((c) => c.id),
                ])
              }
            >
              <Eye size={13} aria-hidden />
              {t("Mostrar todas")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-muted-foreground hover:underline disabled:opacity-40"
              disabled={lista.length === 0}
              onClick={() => aoMudar([])}
            >
              <EyeSlash size={13} aria-hidden />
              {t("Ocultar todas")}
            </button>
          </div>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">
          {t(
            "Arraste para mudar a ordem, igual ao cabeçalho da tabela. Qualquer coluna pode ser ocultada. Para importar, deixe o Nome e o Telefone ou o E-mail na tabela.",
          )}
        </p>
        <ul className="mb-4 grid gap-1" data-testid="colunas-na-tabela">
          {lista.length === 0 ? (
            <li className="rounded-lg border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
              {t("Nenhuma coluna na tabela. Abra uma categoria abaixo e ligue as que quer usar.")}
            </li>
          ) : null}
          {lista.map((c) => (
            <li
              key={c.id}
              draggable
              data-coluna={c.id}
              onDragStart={(e) => {
                e.dataTransfer.setData(TIPO_DO_ARRASTO, c.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(TIPO_DO_ARRASTO)) return;
                e.preventDefault();
                setSobre(c.id);
              }}
              onDragLeave={() => setSobre((s) => (s === c.id ? null : s))}
              onDrop={(e) => {
                setSobre(null);
                const movido = e.dataTransfer.getData(TIPO_DO_ARRASTO);
                if (!movido) return;
                e.preventDefault();
                aoMudar(moverColuna(visiveis, movido, c.id));
              }}
              className={cn(
                "flex min-h-9 cursor-grab items-center gap-1.5 rounded-lg bg-secondary/50 pr-1 pl-1.5 text-sm active:cursor-grabbing",
                sobre === c.id && "ring-2 ring-primary/60",
              )}
            >
              <DotsSixVertical size={16} className="shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{c.rotulo}</span>
              <button
                type="button"
                aria-label={`${t("Ocultar")} ${c.rotulo}`}
                title={t("Ocultar")}
                onClick={() => aoMudar(ocultarColuna(visiveis, c.id))}
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
              >
                <EyeSlash size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("Categorias")}
        </p>
        <div className="grid gap-1">
          {GRUPOS.map(([grupo, titulo]) => {
            const doGrupo = todas.filter((c) => grupoDe(c.id) === grupo);
            const sug = grupo === "personalizados" ? sugestoes : [];
            if (doGrupo.length === 0 && sug.length === 0 && grupo !== "personalizados") return null;
            const aberto = abertos.has(grupo);
            const ligadas = doGrupo.filter((c) => visiveis.includes(c.id)).length;
            return (
              <section key={grupo} className="rounded-xl border">
                <button
                  type="button"
                  aria-expanded={aberto}
                  data-testid={`categoria-${grupo}`}
                  onClick={() => alternarGrupo(grupo)}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm font-medium hover:bg-secondary/60"
                >
                  {aberto ? (
                    <CaretDown size={13} aria-hidden />
                  ) : (
                    <CaretRight size={13} aria-hidden />
                  )}
                  <span className="flex-1">{titulo}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {ligadas}/{doGrupo.length}
                  </span>
                </button>
                {aberto ? (
                  <ul className="grid gap-0.5 border-t px-2 py-1.5">
                    {doGrupo.map((c) => {
                      const ligada = visiveis.includes(c.id);
                      return (
                        <li
                          key={c.id}
                          className="flex min-h-8 items-center gap-2 rounded-md px-1.5 text-sm hover:bg-secondary/50"
                        >
                          <span className="min-w-0 flex-1 truncate">{c.rotulo}</span>
                          <Switch
                            checked={ligada}
                            aria-label={c.rotulo}
                            onCheckedChange={(v) =>
                              aoMudar(
                                v ? mostrarColuna(visiveis, c.id) : ocultarColuna(visiveis, c.id),
                              )
                            }
                          />
                        </li>
                      );
                    })}
                    {sug.map((r) => (
                      <li
                        key={`ex:${r}`}
                        className="flex min-h-8 items-center gap-2 rounded-md px-1.5 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{r}</span>
                        <button
                          type="button"
                          onClick={() => aoCriarPersonalizada(r)}
                          className="rounded-full border border-dashed px-2.5 py-0.5 text-xs hover:bg-secondary"
                        >
                          + {t("Adicionar")}
                        </button>
                      </li>
                    ))}
                    {grupo === "personalizados" ? (
                      <li className="mt-1 flex gap-2 px-1.5">
                        <input
                          value={nova}
                          maxLength={60}
                          placeholder={t("Novo campo (ex.: Idade, Faturamento)")}
                          aria-label={t("Nome do novo campo personalizado")}
                          onChange={(e) => setNova(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && nova.trim()) {
                              aoCriarPersonalizada(nova);
                              setNova("");
                            }
                          }}
                          className="h-9 min-w-0 flex-1 rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!nova.trim()}
                          onClick={() => {
                            aoCriarPersonalizada(nova);
                            setNova("");
                          }}
                        >
                          <Plus size={14} weight="bold" aria-hidden className="mr-1" />
                          {t("Criar")}
                        </Button>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </section>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
