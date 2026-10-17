"use client";

import { useState } from "react";

import { Etiqueta } from "@/components/motor/Etiqueta";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import { Check, Plus } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface OpcaoDoPopup {
  id: string;
  rotulo: string;
  /** Com cor, a opção aparece como etiqueta colorida (a etapa do funil, por exemplo). */
  cor?: CorDaOpcao;
}

interface Props {
  opcoes: readonly OpcaoDoPopup[];
  valor: string;
  aoEscolher: (id: string) => void;
  /** O que aparece quando nada está escolhido. */
  placeholder?: string;
  /** Rótulo da opção que limpa a escolha (ex.: "Sem campanha"); sem isto não há opção vazia. */
  rotuloVazio?: string;
  desabilitado?: boolean;
  /** Nome acessível; sem ele, vale o `<label>` que envolve o campo. */
  rotulo?: string;
  className?: string;
  /** Permite criar uma opção nova ali mesmo (ex.: uma nova origem). */
  criar?: {
    rotulo: string;
    placeholder: string;
    aoCriar: (nome: string) => Promise<string | null>;
  };
}

/**
 * O seletor em popup (o desenho do seletor de períodos): o campo mostra a escolha e, ao clicar,
 * abre a lista. Substitui o `<select>` do navegador em todos os formulários.
 */
export function SeletorEmPopup({
  opcoes,
  valor,
  aoEscolher,
  placeholder,
  rotuloVazio,
  desabilitado,
  rotulo,
  className,
  criar,
}: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  const atual = opcoes.find((o) => o.id === valor);
  const termo = busca.trim().toLowerCase();
  const visiveis = termo ? opcoes.filter((o) => o.rotulo.toLowerCase().includes(termo)) : opcoes;

  const conteudoDe = (o: OpcaoDoPopup) =>
    o.cor ? <Etiqueta cor={o.cor}>{o.rotulo}</Etiqueta> : <span className="min-w-0">{o.rotulo}</span>;

  const item = (o: OpcaoDoPopup) => (
    <button
      key={o.id}
      type="button"
      onClick={() => {
        aoEscolher(o.id);
        setAberto(false);
      }}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary",
        o.id === valor && "bg-secondary",
      )}
    >
      {conteudoDe(o)}
      {o.id === valor ? <Check size={14} className="shrink-0 text-primary" aria-hidden /> : null}
    </button>
  );

  async function confirmarCriacao() {
    const limpo = nome.trim();
    if (!criar || limpo.length < 2) return;
    setSalvando(true);
    try {
      const id = await criar.aoCriar(limpo);
      if (id) {
        aoEscolher(id);
        setNome("");
        setCriando(false);
        setAberto(false);
      }
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Popover
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (!v) {
          setCriando(false);
          setBusca("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={rotulo}
          disabled={desabilitado}
          className={cn(
            "flex min-h-10 w-full items-center justify-between gap-2 rounded-xl border bg-background px-3 py-1.5 text-left text-sm hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-60",
            className,
          )}
        >
          <span className="min-w-0">
            {atual ? (
              conteudoDe(atual)
            ) : (
              <span className="text-muted-foreground">{placeholder ?? rotuloVazio ?? t("Escolher…")}</span>
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,90vw)] p-1.5">
        {opcoes.length > 8 ? (
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={t("Buscar…")}
            className="mb-1 h-8 w-full rounded-md border bg-background px-2 text-sm outline-hidden focus:border-primary/60"
          />
        ) : null}
        <div className="max-h-64 space-y-0.5 overflow-y-auto">
          {rotuloVazio ? item({ id: "", rotulo: rotuloVazio }) : null}
          {visiveis.map(item)}
          {visiveis.length === 0 && !rotuloVazio ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">{t("Nada encontrado.")}</p>
          ) : null}
        </div>
        {criar ? (
          <div className="mt-1 border-t pt-1">
            {criando ? (
              <div className="space-y-1.5 p-1">
                <input
                  autoFocus
                  value={nome}
                  maxLength={60}
                  onChange={(e) => setNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void confirmarCriacao();
                    }
                  }}
                  placeholder={criar.placeholder}
                  className="h-9 w-full rounded-lg border bg-background px-2 text-sm outline-hidden focus:border-primary/60"
                />
                <button
                  type="button"
                  disabled={salvando || nome.trim().length < 2}
                  onClick={() => void confirmarCriacao()}
                  className="h-8 w-full rounded-lg bg-primary text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {t("Criar e usar")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCriando(true)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
              >
                <Plus size={14} aria-hidden />
                {criar.rotulo}
              </button>
            )}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
