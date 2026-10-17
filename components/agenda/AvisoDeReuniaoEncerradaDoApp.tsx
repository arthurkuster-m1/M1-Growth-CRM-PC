"use client";

import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/auth/AuthProvider";
import { apiClient } from "@/lib/api/client";

import { AvisoDeReuniaoEncerrada } from "./AvisoDeReuniaoEncerrada";
import type { Agendamento } from "./tipos";

interface Listado {
  id: string;
  titulo: string;
  iniciaEm: string;
  terminaEm: string;
  situacao: string;
  donoId: string | null;
  contatoNome: string | null;
  /** Ocupação do Google (bloco de terceiro): não é compromisso, não tem desfecho. */
  origem?: string;
}

/**
 * O aviso de reunião encerrada em QUALQUER tela do app: confere de minuto em minuto se alguma
 * reunião do usuário terminou nas últimas 12 horas sem resultado registrado.
 */
export function AvisoDeReuniaoEncerradaDoApp() {
  const { user } = useAuth();
  const consulta = useQuery({
    queryKey: ["agenda", "aviso-de-reuniao-encerrada", user.id],
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async () => {
      const agora = Date.now();
      const qs = new URLSearchParams({
        de: new Date(agora - 12 * 3_600_000).toISOString(),
        ate: new Date(agora + 60_000).toISOString(),
        owner_user_id: user.id,
        limite: "30",
      });
      const r = await apiClient.get<{ data: Listado[] }>(`/api/v1/agenda/agendamentos?${qs}`);
      return (r.data ?? [])
        .filter((a) => a.origem !== "google_sync" && (a.situacao === "confirmed" || a.situacao === "pending"))
        .map(
        (a): Agendamento => ({
          id: a.id,
          titulo: a.titulo,
          quemSeraAtendido: a.contatoNome ?? undefined,
          responsavelId: a.donoId ?? "",
          comeca: a.iniciaEm,
          termina: a.terminaEm,
          origem: "ui",
          situacao: a.situacao as Agendamento["situacao"],
        }),
      );
    },
  });
  if (!consulta.data?.length) return null;
  return <AvisoDeReuniaoEncerrada agendamentos={consulta.data} usuarioId={user.id} />;
}
