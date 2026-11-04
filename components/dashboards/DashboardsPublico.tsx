"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { DashboardsClient } from "@/components/dashboards/DashboardsClient";
import { definirModoPublico } from "@/lib/api/client";

/**
 * Os Dashboards pelo LINK SEM LOGIN: o mesmo componente do painel, em modo leitura. Ligar o modo
 * público ANTES do primeiro render faz toda leitura `/api/v1/<rota>` ir para `/p/<token>/dados/<rota>`
 * (o servidor resolve o link e responde só com os dados da empresa dele).
 */
export function DashboardsPublico({ token, empresa }: { token: string; empresa: string }) {
  const [cliente] = useState(() => {
    definirModoPublico(token);
    return new QueryClient({
      defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
    });
  });
  return (
    <QueryClientProvider client={cliente}>
      <DashboardsClient empresa={empresa} publico />
    </QueryClientProvider>
  );
}
