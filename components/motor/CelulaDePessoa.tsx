"use client";

import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { Check } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface MembroDoMotor {
  id: string;
  nome: string;
}

interface Props {
  membros: readonly MembroDoMotor[];
  valorId: string | null;
  aoEscolher: (id: string | null) => void;
  podeEditar: boolean;
  rotulo: string;
}

const inicialDe = (nome: string) => [...nome.trim()][0]?.toUpperCase() ?? "?";

function Avatar({ nome }: { nome: string }) {
  return (
    <span
      aria-hidden
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-bold text-primary"
    >
      {inicialDe(nome)}
    </span>
  );
}

/** A coluna "Pessoa" do Notion: avatar + nome; clicar abre a lista da equipe. */
export function CelulaDePessoa({ membros, valorId, aoEscolher, podeEditar, rotulo }: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const atual = valorId ? membros.find((m) => m.id === valorId) : undefined;

  const escolher = (id: string | null) => {
    aoEscolher(id);
    setAberto(false);
  };

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!podeEditar}
          aria-label={rotulo}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
            podeEditar && "hover:bg-secondary",
          )}
        >
          {valorId ? (
            <>
              <Avatar nome={atual?.nome ?? "?"} />
              <span className="truncate">{atual?.nome ?? t("Ex-membro")}</span>
            </>
          ) : (
            <span className="text-text-subtle">{t("Ninguém")}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          <button
            type="button"
            onClick={() => escolher(null)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-secondary"
          >
            {t("Ninguém")}
            {!valorId ? <Check size={14} className="text-primary" aria-hidden /> : null}
          </button>
          {membros.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => escolher(m.id)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Avatar nome={m.nome} />
                <span className="truncate">{m.nome}</span>
              </span>
              {m.id === valorId ? <Check size={14} className="text-primary" aria-hidden /> : null}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
