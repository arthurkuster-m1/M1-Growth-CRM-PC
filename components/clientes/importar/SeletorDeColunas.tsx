"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { ArrowDown, ArrowUp, Eye, EyeSlash, Plus, SlidersHorizontal } from "@/lib/ui/icons";

export interface ColunaDisponivel {
  id: string;
  rotulo: string;
}

/** Nas colunas que a pessoa não pode esconder (o nome do lead). */
const SEMPRE = "titulo";

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
 * O botão "Colunas": escolher quais colunas aparecem na tabela (selecionar), esconder as que não
 * se usa (o que já foi digitado nelas fica guardado e volta ao mostrar de novo) e mudar a ordem.
 * O nome do lead está sempre aqui; telefone e e-mail podem sair, mas um dos dois precisa ficar
 * (é por eles que o CRM acha a pessoa).
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
  const porId = new Map(todas.map((c) => [c.id, c]));
  const lista = visiveis.map((id) => porId.get(id)).filter((c): c is ColunaDisponivel => !!c);
  const escondidas = todas.filter((c) => !visiveis.includes(c.id));

  const mover = (id: string, passo: -1 | 1) => {
    const i = visiveis.indexOf(id);
    const j = i + passo;
    // O nome fica na frente.
    if (i < 1 || j < 1 || j >= visiveis.length) return;
    const novo = [...visiveis];
    [novo[i], novo[j]] = [novo[j]!, novo[i]!];
    aoMudar(novo);
  };
  const esconder = (id: string) => {
    if (id === SEMPRE) return;
    const resto = visiveis.filter((x) => x !== id);
    // Sem telefone e sem e-mail não há como achar a pessoa.
    if (!resto.includes("telefone") && !resto.includes("email")) return;
    aoMudar(resto);
  };
  const ultimoDeContato = (id: string) =>
    (id === "telefone" || id === "email") &&
    !visiveis.some((x) => x !== id && (x === "telefone" || x === "email"));

  const GRUPOS: Array<[string, string]> = [
    ["cadastro", t("Cadastro")],
    ["data", t("Data e horário")],
    ["origem", t("Origem")],
    ["funil-e-venda", t("Funil e venda")],
    ["links", t("Links")],
    ["campos-do-funil", t("Campos do funil")],
    ["personalizados", t("Campos personalizados")],
  ];
  const chip = "rounded-full border px-2.5 py-0.5 text-xs hover:bg-secondary";
  const jaTem = new Set(todas.map((c) => c.rotulo.toLowerCase()));
  const sugestoes = sugeridas.filter((r) => !jaTem.has(r.toLowerCase()));

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
        className="max-h-[var(--radix-popover-content-available-height)] w-[min(94vw,440px)] overflow-y-auto overscroll-contain p-3"
      >
        <p className="mb-2 text-xs text-muted-foreground">
          {t(
            "Mostre, esconda e reordene as colunas. O nome está sempre aqui; telefone ou e-mail, pelo menos um. O que você digitou numa coluna escondida fica guardado.",
          )}
        </p>
        <ul className="mb-3 grid gap-1">
          {lista.map((c, i) => {
            const fixa = c.id === SEMPRE;
            return (
              <li
                key={c.id}
                className="flex min-h-9 items-center gap-1 rounded-lg bg-secondary/50 pr-1 pl-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{c.rotulo}</span>
                {fixa ? (
                  <span className="pr-2 text-xs text-muted-foreground">{t("sempre")}</span>
                ) : (
                  <>
                    <button
                      type="button"
                      aria-label={`${t("Subir")} ${c.rotulo}`}
                      disabled={i <= 1}
                      onClick={() => mover(c.id, -1)}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-card disabled:opacity-30"
                    >
                      <ArrowUp size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`${t("Descer")} ${c.rotulo}`}
                      disabled={i === lista.length - 1}
                      onClick={() => mover(c.id, 1)}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-card disabled:opacity-30"
                    >
                      <ArrowDown size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label={`${t("Ocultar")} ${c.rotulo}`}
                      title={
                        ultimoDeContato(c.id)
                          ? t(
                              "Precisa ficar: sem telefone e sem e-mail não dá para achar a pessoa.",
                            )
                          : t("Ocultar")
                      }
                      disabled={ultimoDeContato(c.id)}
                      onClick={() => esconder(c.id)}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30"
                    >
                      <EyeSlash size={14} aria-hidden />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("Colunas escondidas")} ({escondidas.length})
            </p>
            {escondidas.length > 0 ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                onClick={() => aoMudar([...visiveis, ...escondidas.map((c) => c.id)])}
              >
                <Eye size={13} aria-hidden />
                {t("Mostrar todas")}
              </button>
            ) : null}
          </div>
          {GRUPOS.map(([grupo, titulo]) => {
            const doGrupo = escondidas.filter((c) => grupoDe(c.id) === grupo);
            const sug = grupo === "personalizados" ? sugestoes : [];
            if (doGrupo.length === 0 && sug.length === 0) return null;
            return (
              <div key={grupo} className="grid gap-1.5">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {titulo}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {doGrupo.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => aoMudar([...visiveis, c.id])}
                      className={chip}
                    >
                      + {c.rotulo}
                    </button>
                  ))}
                  {sug.map((r) => (
                    <button
                      key={`ex:${r}`}
                      type="button"
                      onClick={() => aoCriarPersonalizada(r)}
                      className={`${chip} border-dashed`}
                    >
                      + {r}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="mt-1 flex gap-2">
            <input
              value={nova}
              maxLength={60}
              placeholder={t("Novo campo personalizado (ex.: Idade, Faturamento)")}
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
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
