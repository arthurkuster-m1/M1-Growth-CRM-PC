"use client";

import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams as useNextSearchParams } from "next/navigation";
import { useCallback, type ComponentProps } from "react";

/**
 * As três peças de navegação que as telas da família usam (`react-router`), em cima do Next:
 * `Link`, `useNavigate` e `useSearchParams` (devolve `[params, setParams]`). As telas continuam
 * escrevendo caminhos como `/financas/mes`; aqui eles viram `/app/financas/mes`.
 */
export const caminhoDasFinancas = (para: string) =>
  para.startsWith("/financas") ? `/app${para}` : para;

export function Link({
  to,
  ...resto
}: Omit<ComponentProps<typeof NextLink>, "href"> & { to: string }) {
  return <NextLink href={caminhoDasFinancas(to)} {...resto} />;
}

export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (para: string, opcoes?: { replace?: boolean }) => {
      const destino = caminhoDasFinancas(para);
      if (opcoes?.replace) router.replace(destino);
      else router.push(destino);
    },
    [router],
  );
}

type NovosParametros = Record<string, string> | URLSearchParams;

export function useSearchParams(): [
  URLSearchParams,
  (novos: NovosParametros, opcoes?: { replace?: boolean }) => void,
] {
  const params = useNextSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const definir = useCallback(
    (novos: NovosParametros, opcoes?: { replace?: boolean }) => {
      const q = (novos instanceof URLSearchParams ? novos : new URLSearchParams(novos)).toString();
      const url = q ? `${pathname}?${q}` : pathname;
      if (opcoes?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [pathname, router],
  );
  return [new URLSearchParams(params?.toString() ?? ""), definir];
}
