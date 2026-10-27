"use client";

import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";

/**
 * O TÍTULO DA OPORTUNIDADE — um campo só, com o mesmo desenho onde quer que apareça (o popup da
 * oportunidade/venda e as seções Oportunidade e Venda da página do compromisso). É o mesmo dado
 * (`name` da venda): editar em qualquer lugar muda em todos.
 */
export function TituloDaOportunidade({
  valor,
  aoMudar,
  aoSair,
  placeholder,
  desabilitado,
  className,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  /** Ao sair do campo (a página do compromisso grava aqui; o popup grava no "Salvar"). */
  aoSair?: () => void;
  placeholder?: string;
  desabilitado?: boolean;
  className?: string;
}) {
  const t = useT();
  return (
    <input
      value={valor}
      maxLength={120}
      disabled={desabilitado}
      aria-label={t("Título da oportunidade")}
      onChange={(e) => aoMudar(e.target.value)}
      onBlur={aoSair}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      placeholder={placeholder ?? t("Título da oportunidade")}
      className={cn(
        "-mx-2 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-2 py-1 text-xl font-semibold outline-hidden transition-colors hover:border-border focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20 disabled:hover:border-transparent",
        className,
      )}
    />
  );
}
