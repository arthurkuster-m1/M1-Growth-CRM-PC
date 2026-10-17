"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { BellRinging } from "@/lib/ui/icons";

import { OPCOES_DE_RESULTADO, useAcoesDoCompromisso } from "./AcoesDoCompromisso";
import type { Agendamento } from "./tipos";

const CHAVE = "m1:agenda:aviso-de-reuniao-encerrada";
const JANELA_MS = 12 * 3_600_000; // só avisa de reuniões que acabaram nas últimas 12 horas

function dispensados(): string[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(CHAVE) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function dispensar(id: string) {
  try {
    window.sessionStorage.setItem(CHAVE, JSON.stringify([...dispensados(), id]));
  } catch {
    // sem armazenamento: o aviso volta na próxima abertura, e tudo bem
  }
}

/**
 * Quando uma reunião termina, o responsável recebe este popup para registrar como foi (o desfecho
 * é sempre declarado por uma pessoa). "Depois" esconde até a próxima abertura da Agenda.
 */
export function AvisoDeReuniaoEncerrada({
  agendamentos,
  usuarioId,
}: {
  agendamentos: Agendamento[];
  usuarioId: string;
}) {
  const t = useT();
  const router = useRouter();
  const { resultado } = useAcoesDoCompromisso();
  const [agora, setAgora] = React.useState(() => Date.now());
  const [escondidos, setEscondidos] = React.useState<string[]>([]);

  React.useEffect(() => {
    setEscondidos(dispensados());
    const timer = window.setInterval(() => setAgora(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const pendente = agendamentos
    .filter(
      (a) =>
        a.origem !== "google_sync" &&
        a.responsavelId === usuarioId &&
        (a.situacao === "confirmed" || a.situacao === "pending") &&
        Date.parse(a.termina) <= agora &&
        agora - Date.parse(a.termina) <= JANELA_MS &&
        !escondidos.includes(a.id),
    )
    .sort((x, y) => Date.parse(x.termina) - Date.parse(y.termina))[0];

  // O compromisso de verdade: dados para mostrar e prova de que ainda existe (excluído, cancelado ou
  // já respondido some do aviso).
  const tag = useTagDeIdioma();
  const detalhe = useQuery({
    queryKey: ["agenda", "detalhe-do-aviso", pendente?.id],
    enabled: Boolean(pendente),
    retry: false,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: {
            status: string;
            starts_at: string;
            ends_at: string;
            time_zone: string;
            oportunidade_titulo: string | null;
            cliente: { nome: string | null } | null;
          };
        }>(`/api/v1/agenda/agendamentos/${pendente!.id}`)
      ).data,
  });
  const sumiu =
    detalhe.isError || (detalhe.data ? !["confirmed", "pending"].includes(detalhe.data.status) : false);

  // Compromisso que sumiu (excluído, cancelado, já respondido): descarta e passa para o próximo.
  const idDoPendente = pendente?.id;
  React.useEffect(() => {
    if (idDoPendente && sumiu) {
      dispensar(idDoPendente);
      setEscondidos((e) => [...e, idDoPendente]);
    }
  }, [idDoPendente, sumiu]);

  if (!pendente || sumiu) return null;
  const esconder = () => {
    dispensar(pendente.id);
    setEscondidos((e) => [...e, pendente.id]);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && esconder()}>
      <DialogContent
        data-testid="aviso-de-reuniao-encerrada"
        className="max-w-md rounded-3xl p-6 sm:rounded-3xl"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <BellRinging size={22} weight="fill" aria-hidden />
          </span>
          <div>
            <DialogTitle className="text-base">{t("Sua reunião terminou")}</DialogTitle>
            <DialogDescription className="text-sm">
              {t("Como foi?")}
            </DialogDescription>
          </div>
        </div>
        <div className="rounded-2xl bg-secondary/60 px-4 py-3 text-sm" data-testid="dados-do-aviso">
          <div className="font-medium">
            {detalhe.data?.oportunidade_titulo ?? detalhe.data?.cliente?.nome ?? pendente.quemSeraAtendido ?? pendente.titulo}
          </div>
          {detalhe.data ? (
            <div className="text-xs text-muted-foreground first-letter:uppercase">
              {new Intl.DateTimeFormat(tag, {
                timeZone: detalhe.data.time_zone,
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
              }).format(new Date(detalhe.data.starts_at))}
              {" – "}
              {new Intl.DateTimeFormat(tag, {
                timeZone: detalhe.data.time_zone,
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
              }).format(new Date(detalhe.data.ends_at))}
            </div>
          ) : null}
        </div>
        <ul className="flex flex-col gap-2">
          {OPCOES_DE_RESULTADO.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                disabled={resultado.isPending}
                data-testid={`aviso-resultado-${o.id}`}
                className="w-full rounded-2xl border border-border px-4 py-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                onClick={() => resultado.mutate({ id: pendente.id, opcao: o.id }, { onSuccess: esconder })}
              >
                <span className="block text-sm font-medium">{t(o.rotulo)}</span>
                <span className="block text-xs text-text-muted">{t(o.dica)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-between gap-2">
          <Button
            variant="ghost"
            className="rounded-xl"
            onClick={() => {
              esconder();
              router.push(`/app/agenda?compromisso=${pendente.id}`);
            }}
          >
            {t("Abrir o compromisso")}
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={esconder}>
            {t("Depois")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
