"use client";

import { useState, type ReactNode } from "react";

import { useT } from "@/hooks/i18n/useT";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TipoDeVisualizacao } from "@/lib/motor/visualizacoes";
import {
  CalendarDots,
  CaretDown,
  ChartBar,
  Copy,
  Kanban,
  PencilSimple,
  Plus,
  Rows,
  Trash,
} from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface AbaDeVisualizacao {
  id: string;
  nome: string;
  tipo: TipoDeVisualizacao;
}

interface Props {
  abas: AbaDeVisualizacao[];
  ativaId: string;
  /** A aba de fábrica ("Tabela"): não se renomeia, não se apaga. */
  idDaPadrao: string;
  podeEditar: boolean;
  aoEscolher: (id: string) => void;
  aoCriar: (nome: string, tipo: TipoDeVisualizacao) => void;
  aoRenomear: (id: string, nome: string) => void;
  aoTrocarTipo: (id: string, tipo: TipoDeVisualizacao) => void;
  aoDuplicar: (id: string) => void;
  aoApagar: (id: string) => void;
}

export const ICONE_DO_TIPO: Record<TipoDeVisualizacao, ReactNode> = {
  tabela: <Rows size={14} aria-hidden />,
  kanban: <Kanban size={14} aria-hidden />,
  calendario: <CalendarDots size={14} aria-hidden />,
  timeline: <ChartBar size={14} aria-hidden />,
};

const TIPOS: TipoDeVisualizacao[] = ["tabela", "kanban", "calendario", "timeline"];

/** Os nomes dos tipos, como a tela os mostra. Fora do componente para o `t()` ficar literal. */
function useRotuloDoTipo() {
  const t = useT();
  return (tipo: TipoDeVisualizacao) =>
    tipo === "tabela"
      ? t("Tabela")
      : tipo === "kanban"
        ? t("Quadro")
        : tipo === "calendario"
          ? t("Calendário")
          : t("Linha do tempo");
}

/**
 * As ABAS de visualização, no jeito do Notion: uma pílula por visualização, a ativa em
 * destaque, e um "+" que abre "Nova visualização" (nome + tipo). A fila rola para o lado
 * dentro dela mesma — a página nunca ganha barra de rolagem horizontal.
 */
export function AbasDeVisualizacao({
  abas,
  ativaId,
  idDaPadrao,
  podeEditar,
  aoEscolher,
  aoCriar,
  aoRenomear,
  aoTrocarTipo,
  aoDuplicar,
  aoApagar,
}: Props) {
  const t = useT();
  const rotuloDoTipo = useRotuloDoTipo();
  const [novaAberta, setNovaAberta] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoDeVisualizacao>("tabela");
  const [renomeandoId, setRenomeandoId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");

  function criar() {
    aoCriar(nome.trim() || rotuloDoTipo(tipo), tipo);
    setNovaAberta(false);
    setNome("");
    setTipo("tabela");
  }

  return (
    <div
      role="tablist"
      aria-label={t("Visualizações")}
      className="-mx-1 flex min-w-0 [scrollbar-width:none] items-center gap-1 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden"
    >
      {abas.map((aba) => {
        const ativa = aba.id === ativaId;
        const comMenu = podeEditar && aba.id !== idDaPadrao;
        if (renomeandoId === aba.id) {
          return (
            <input
              key={aba.id}
              autoFocus
              value={rascunho}
              maxLength={60}
              aria-label={t("Nome da visualização")}
              onChange={(e) => setRascunho(e.target.value)}
              onBlur={() => {
                const novo = rascunho.trim();
                if (novo && novo !== aba.nome) aoRenomear(aba.id, novo);
                setRenomeandoId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setRascunho(aba.nome);
                  setRenomeandoId(null);
                }
              }}
              className="h-8 w-40 shrink-0 rounded-lg border border-primary/50 bg-background px-2 text-sm ring-2 ring-primary/20 outline-none"
            />
          );
        }
        return (
          <div
            key={aba.id}
            className={cn(
              "flex h-8 shrink-0 items-center rounded-lg text-sm transition-colors",
              ativa
                ? "bg-secondary font-medium text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <button
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => aoEscolher(aba.id)}
              className={cn(
                "flex h-8 max-w-48 items-center gap-1.5 rounded-lg pl-2.5",
                comMenu && ativa ? "pr-1" : "pr-2.5",
              )}
            >
              {ICONE_DO_TIPO[aba.tipo]}
              <span className="truncate">{aba.nome}</span>
            </button>
            {comMenu && ativa ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("Opções da visualização")}
                    className="grid h-8 w-7 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    <CaretDown size={12} weight="bold" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuItem
                    className="gap-2"
                    onSelect={() => {
                      setRascunho(aba.nome);
                      setRenomeandoId(aba.id);
                    }}
                  >
                    <PencilSimple size={14} aria-hidden />
                    {t("Renomear")}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onSelect={() => aoDuplicar(aba.id)}>
                    <Copy size={14} aria-hidden />
                    {t("Duplicar")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {TIPOS.filter((x) => x !== aba.tipo).map((x) => (
                    <DropdownMenuItem
                      key={x}
                      className="gap-2"
                      onSelect={() => aoTrocarTipo(aba.id, x)}
                    >
                      {ICONE_DO_TIPO[x]}
                      {t("Ver como")} {rotuloDoTipo(x)}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="gap-2 text-error-fg"
                    onSelect={() => aoApagar(aba.id)}
                  >
                    <Trash size={14} aria-hidden />
                    {t("Apagar")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        );
      })}

      {podeEditar ? (
        <Popover open={novaAberta} onOpenChange={setNovaAberta}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("Nova visualização")}
              title={t("Nova visualização")}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Plus size={16} weight="bold" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[min(92vw,320px)] p-3">
            <p className="mb-2 text-sm font-semibold">{t("Nova visualização")}</p>
            <input
              value={nome}
              maxLength={60}
              placeholder={rotuloDoTipo(tipo)}
              aria-label={t("Nome da visualização")}
              onChange={(e) => setNome(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") criar();
              }}
              className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
            <div
              className="mt-2 grid grid-cols-2 gap-1.5"
              role="radiogroup"
              aria-label={t("Tipo de visualização")}
            >
              {TIPOS.map((x) => (
                <button
                  key={x}
                  type="button"
                  role="radio"
                  aria-checked={tipo === x}
                  onClick={() => setTipo(x)}
                  className={cn(
                    "flex h-10 items-center gap-2 rounded-xl border px-3 text-sm transition-colors",
                    tipo === x ? "border-primary bg-primary/10 font-medium" : "hover:bg-secondary",
                  )}
                >
                  {ICONE_DO_TIPO[x]}
                  {rotuloDoTipo(x)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={criar}
              className="mt-3 h-9 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              {t("Criar visualização")}
            </button>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
