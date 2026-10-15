"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { ROTULO_DA_CONFIRMACAO } from "@/lib/agenda/confirmacao";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { Plus } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Compromisso {
  id: string;
  titulo: string;
  iniciaEm: string;
  terminaEm: string;
  situacao: string;
  confirmacaoDoCliente?: "confirmed" | "reschedule" | "cancel" | null;
  contatoNome: string | null;
}

const ROTULO: Record<string, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Agendado",
  completed: "Compareceu",
  no_show: "Faltou",
  cancelled: "Cancelado",
};
const COR: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-800 dark:text-yellow-300",
  confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  completed: "bg-green-500/15 text-green-700 dark:text-green-300",
  no_show: "bg-red-500/15 text-red-700 dark:text-red-300",
  cancelled: "bg-secondary text-muted-foreground",
};

/** Os compromissos de uma OPORTUNIDADE (`leadId`) ou de um CLIENTE (`contactId`), e o atalho para marcar. */
export function CompromissosDoLead({
  contactId,
  leadId,
  className,
}: {
  contactId: string | null;
  leadId?: string | null;
  className?: string;
}) {
  const t = useT();
  const consulta = useQuery({
    queryKey: ["agenda", "compromissos-do-lead", leadId ?? null, contactId],
    enabled: Boolean(leadId || contactId),
    staleTime: 10_000,
    queryFn: async () => {
      const qs = new URLSearchParams(leadId ? { lead_id: leadId } : { contact_id: contactId! });
      const r = await apiClient.get<{ data: Compromisso[] }>(`/api/v1/agenda/agendamentos?${qs}`);
      return (r.data ?? []) as Compromisso[];
    },
  });
  const lista = [...(consulta.data ?? [])].sort((a, b) => a.iniciaEm.localeCompare(b.iniciaEm));
  const agora = new Date().toISOString();
  const futuros = lista.filter((c) => c.iniciaEm >= agora && c.situacao !== "cancelled");
  const passados = lista.filter((c) => !futuros.includes(c)).reverse();
  const quando = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  const novo =
    `/app/agenda?${new URLSearchParams({
      ...(contactId ? { contato: contactId } : {}),
      ...(leadId ? { lead: leadId } : {}),
    })}`;

  const linha = (c: Compromisso) => (
    <li key={c.id}>
      <Link
        href={`/app/agenda?compromisso=${c.id}`}
        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary"
      >
        <span className="min-w-0 truncate">
          <span className="tabular-nums">{quando(c.iniciaEm)}</span> · {c.titulo}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {c.confirmacaoDoCliente ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                c.confirmacaoDoCliente === "confirmed"
                  ? "bg-green-500/15 text-green-700 dark:text-green-300"
                  : "bg-yellow-500/15 text-yellow-800 dark:text-yellow-300",
              )}
            >
              {t(ROTULO_DA_CONFIRMACAO[c.confirmacaoDoCliente])}
            </span>
          ) : null}
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", COR[c.situacao])}>
            {t(ROTULO[c.situacao] ?? c.situacao)}
          </span>
        </span>
      </Link>
    </li>
  );

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          {futuros.length > 0
            ? `${t("Próximo compromisso:")} ${quando(futuros[0]!.iniciaEm)}`
            : t("Nenhum compromisso agendado.")}
        </p>
        <Link
          href={novo}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium hover:bg-secondary"
        >
          <Plus size={14} aria-hidden />
          {t("Novo compromisso")}
        </Link>
      </div>
      {futuros.length + passados.length > 0 ? (
        <ul className="grid gap-0.5">
          {futuros.map(linha)}
          {passados.slice(0, 5).map(linha)}
        </ul>
      ) : null}
    </div>
  );
}
