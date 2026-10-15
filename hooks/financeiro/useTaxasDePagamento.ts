"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import { useT } from "@/hooks/i18n/useT";
import { rotuloDaFormaComTaxas, type TaxaDaForma } from "@/lib/financeiro/taxas";
import { rotuloDaForma } from "@/lib/vendas";

export const CHAVE_DAS_TAXAS = ["financeiro", "taxas"] as const;

/** As taxas de cada forma de pagamento da empresa (Pix, crédito, débito e as criadas por ela). */
export function useTaxasDePagamento() {
  return useQuery({
    queryKey: CHAVE_DAS_TAXAS,
    queryFn: async () =>
      (await apiClient.get<{ data: TaxaDaForma[] }>("/api/v1/financeiro/taxas")).data,
    staleTime: 60_000,
  });
}

/** O nome da forma de pagamento na tela, incluindo as formas criadas pela empresa. */
export function useRotuloDaForma() {
  const t = useT();
  const taxas = useTaxasDePagamento();
  return (forma: string): string =>
    rotuloDaFormaComTaxas(t, forma, taxas.data ?? []) ?? rotuloDaForma(t, forma);
}
