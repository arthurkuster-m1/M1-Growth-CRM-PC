"use client";

import { LinkVoltar } from "@/components/ui/LinkVoltar";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { useT } from "@/hooks/i18n/useT";
import { PARAM_NOME_DO_VOLTAR, PARAM_VOLTAR, caminhoSeguro, comVoltar } from "@/lib/navigation/voltar";


// As funções puras moram em `lib/navigation/voltar.ts` (páginas de servidor as usam sem passar por aqui).
export { PARAM_VOLTAR, PARAM_NOME_DO_VOLTAR, comVoltar };

function Barra() {
  const t = useT();
  const parametros = useSearchParams();
  const destino = parametros.get(PARAM_VOLTAR);
  if (!caminhoSeguro(destino)) return null;
  const nome = parametros.get(PARAM_NOME_DO_VOLTAR)?.slice(0, 80);
  return (
    <div className="mb-3 flex w-full px-4 sm:px-6">
      <LinkVoltar href={destino}>{nome}</LinkVoltar>
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
