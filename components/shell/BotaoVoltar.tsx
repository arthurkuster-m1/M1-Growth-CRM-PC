"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { useT } from "@/hooks/i18n/useT";
import { CaretLeft } from "@/lib/ui/icons";

/** Os parâmetros que um atalho põe no endereço para a página de destino saber como voltar. */
export const PARAM_VOLTAR = "voltar";
export const PARAM_NOME_DO_VOLTAR = "vnome";

/** O endereço de um atalho que, na chegada, mostra "Voltar" para `origem`. */
export function comVoltar(href: string, origem: { href: string; rotulo: string }): string {
  const separador = href.includes("?") ? "&" : "?";
  return `${href}${separador}${PARAM_VOLTAR}=${encodeURIComponent(origem.href)}&${PARAM_NOME_DO_VOLTAR}=${encodeURIComponent(origem.rotulo)}`;
}

/** Só volta para dentro do app: nunca para outro site (`//x`, `https://…`). */
const caminhoSeguro = (c: string | null): c is string =>
  c !== null && c.startsWith("/app/") && !c.startsWith("//") && !c.includes("\\");

function Barra() {
  const t = useT();
  const parametros = useSearchParams();
  const destino = parametros.get(PARAM_VOLTAR);
  if (!caminhoSeguro(destino)) return null;
  const nome = parametros.get(PARAM_NOME_DO_VOLTAR)?.slice(0, 80);
  return (
    <div className="mx-auto mb-3 flex w-full max-w-[1400px]">
      <Link
        href={destino}
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-secondary hover:text-foreground"
      >
        <CaretLeft size={14} weight="bold" aria-hidden />
        {nome ? `${t("Voltar para")} ${nome}` : t("Voltar")}
      </Link>
    </div>
  );
}

/**
 * O "VOLTAR" dos atalhos: quem chega a uma página por um atalho de outra (ex.: Campanhas →
 * Clientes) vê um botão que leva de volta para onde estava. Sem o parâmetro no endereço, não
 * aparece nada.
 */
export function BotaoVoltar() {
  return (
    <Suspense fallback={null}>
      <Barra />
    </Suspense>
  );
}
