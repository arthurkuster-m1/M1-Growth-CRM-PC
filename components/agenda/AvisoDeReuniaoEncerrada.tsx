"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/hooks/i18n/useT";
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

  if (!pendente) return null;
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
              {pendente.quemSeraAtendido ?? pendente.titulo} · {t("Como foi?")}
            </DialogDescription>
          </div>
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
