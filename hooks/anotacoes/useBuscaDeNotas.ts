"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api/client";

export interface ResultadoDeBusca {
  id: string;
  title: string;
  icon: string | null;
  trecho: string;
}

const ESPERA_MS = 300;

/** A busca nas anotações: espera uma pausa na digitação e só procura com 2+ letras. */
export function useBuscaDeNotas(texto: string) {
  const [termo, setTermo] = useState("");
  useEffect(() => {
    const espera = setTimeout(() => setTermo(texto.trim()), ESPERA_MS);
    return () => clearTimeout(espera);
  }, [texto]);

  const ativa = termo.length >= 2;
  const consulta = useQuery({
    queryKey: ["anotacoes", "busca", termo],
    enabled: ativa,
    queryFn: async () => {
      const r = await apiClient.get<{ data: { resultados: ResultadoDeBusca[] } }>(
        `/api/v1/anotacoes/busca?q=${encodeURIComponent(termo)}`,
      );
      return r.data.resultados;
    },
    staleTime: 10_000,
  });

  return {
    ativa: texto.trim().length >= 2,
    resultados: ativa ? (consulta.data ?? []) : [],
    procurando: texto.trim().length >= 2 && (termo !== texto.trim() || consulta.isFetching),
  };
}
