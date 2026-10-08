"use client";

import { useState, type ReactNode } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/**
 * A barra que aparece, flutuando no pé da tela, quando há linhas selecionadas: quantas são,
 * as ações que valem para todas e o "x" que limpa a seleção.
 *
 * Fixa e não dentro da tabela: com 30 linhas selecionadas a tabela rola, e as ações não
 * podem rolar junto. Sobe 5rem no celular para não ficar atrás da barra de navegação
 * inferior do app.
 */
export function BarraDeSelecao({
  quantidade,
  aoLimpar,
  children,
}: {
  quantidade: number;
  aoLimpar: () => void;
  children: ReactNode;
}) {
  const t = useT();
  if (quantidade === 0) return null;

  return (
    <div
      role="region"
      aria-label={t("Ações para as linhas selecionadas")}
      className="fixed inset-x-0 bottom-20 z-40 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] flex-wrap items-center justify-center gap-1 rounded-2xl border bg-card p-1.5 shadow-xl md:bottom-6"
    >
      <span className="px-3 text-sm font-medium">
        {quantidade} {t(quantidade === 1 ? "selecionada" : "selecionadas")}
      </span>
      <span aria-hidden className="h-5 w-px bg-border" />
      {children}
      <span aria-hidden className="h-5 w-px bg-border" />
      <button
        type="button"
        onClick={aoLimpar}
        aria-label={t("Limpar seleção")}
        title={t("Limpar seleção")}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

/**
 * Uma ação da barra. Sem `children`, é um botão direto (ex.: "Apagar"); com `children`, abre
 * um painel acima da barra para escolher o valor, e `fechar` o recolhe depois de aplicar.
 */
export function AcaoEmMassa({
  rotulo,
  icone,
  destrutivo,
  aoClicar,
  children,
}: {
  rotulo: string;
  icone?: ReactNode;
  destrutivo?: boolean;
  aoClicar?: () => void;
  children?: (fechar: () => void) => ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  const botao = (
    <button
      type="button"
      onClick={aoClicar}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm transition-colors hover:bg-secondary",
        destrutivo ? "text-error-fg" : "text-foreground",
      )}
    >
      {icone}
      {rotulo}
    </button>
  );

  if (!children) return botao;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>{botao}</PopoverTrigger>
      <PopoverContent side="top" align="center" sideOffset={10} className="w-64 p-1.5">
        {children(() => setAberto(false))}
      </PopoverContent>
    </Popover>
  );
}
