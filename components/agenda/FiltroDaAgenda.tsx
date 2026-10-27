"use client";

import * as React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useT } from "@/hooks/i18n/useT";
import { cn } from "@/lib/utils";

import { AvatarDaPessoa } from "./AvatarDaPessoa";
import type { Pessoa } from "./tipos";

/**
 * O filtro da Agenda para quem enxerga a equipe (gerente e administrador).
 *
 * Duas listas, e as duas são MULTISSELEÇÃO: atendentes (todos, um, alguns) e tipos de compromisso.
 * Lista vazia = sem filtro = todos. O botão diz o que está valendo ("Todos", o nome da pessoa ou
 * "3 atendentes") e carrega um contador quando há filtro ligado.
 */
export function FiltroDaAgenda({
  pessoas,
  tipos,
  pessoasEscolhidas,
  tiposEscolhidos,
  aoMudarPessoas,
  aoMudarTipos,
  className,
}: {
  pessoas: Pessoa[];
  /** Os nomes dos tipos de atendimento da organização. */
  tipos: string[];
  pessoasEscolhidas: string[];
  tiposEscolhidos: string[];
  aoMudarPessoas: (ids: string[]) => void;
  aoMudarTipos: (nomes: string[]) => void;
  className?: string;
}) {
  const t = useT();
  const alternar = (lista: string[], item: string) =>
    lista.includes(item) ? lista.filter((x) => x !== item) : [...lista, item];
  const ativos = (pessoasEscolhidas.length > 0 ? 1 : 0) + (tiposEscolhidos.length > 0 ? 1 : 0);

  const resumo = (() => {
    if (pessoasEscolhidas.length === 0 && tiposEscolhidos.length === 0) return t("Todos");
    const partes: string[] = [];
    if (pessoasEscolhidas.length === 1) {
      partes.push(pessoas.find((p) => p.id === pessoasEscolhidas[0])?.nome ?? t("1 atendente"));
    } else if (pessoasEscolhidas.length > 1) {
      partes.push(`${pessoasEscolhidas.length} ${t("atendentes")}`);
    }
    if (tiposEscolhidos.length === 1) partes.push(tiposEscolhidos[0]!);
    else if (tiposEscolhidos.length > 1) partes.push(`${tiposEscolhidos.length} ${t("tipos")}`);
    return partes.join(" · ");
  })();

  const linha =
    "flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-secondary";

  return (
    <div className={cn("flex items-center", className)} data-testid="filtro-da-agenda">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="filtro-da-agenda-botao"
            data-ativos={ativos}
            className="inline-flex h-9 max-w-full items-center gap-2 rounded-xl border px-3 text-xs font-medium hover:bg-secondary lg:h-8"
          >
            <span className="text-muted-foreground">{t("Filtrar")}:</span>
            <span className="truncate">{resumo}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <div className="max-h-[70dvh] overflow-y-auto">
            <div className="px-2 pt-1 pb-1 text-xs font-semibold text-muted-foreground">
              {t("Atendentes")}
            </div>
            <button
              type="button"
              className={linha}
              data-testid="filtro-todas-as-pessoas"
              onClick={() => aoMudarPessoas([])}
            >
              <input type="checkbox" readOnly checked={pessoasEscolhidas.length === 0} />
              {t("Todos os atendentes")}
            </button>
            {pessoas.map((p) => (
              <button
                key={p.id}
                type="button"
                className={linha}
                data-testid={`filtro-pessoa-${p.id}`}
                onClick={() => aoMudarPessoas(alternar(pessoasEscolhidas, p.id))}
              >
                <input type="checkbox" readOnly checked={pessoasEscolhidas.includes(p.id)} />
                <AvatarDaPessoa pessoa={p} tamanho="sm" />
                <span className="min-w-0 truncate">{p.nome}</span>
              </button>
            ))}

            {tipos.length > 0 ? (
              <>
                <div className="mt-2 px-2 pt-1 pb-1 text-xs font-semibold text-muted-foreground">
                  {t("Tipos de compromisso")}
                </div>
                <button
                  type="button"
                  className={linha}
                  data-testid="filtro-todos-os-tipos"
                  onClick={() => aoMudarTipos([])}
                >
                  <input type="checkbox" readOnly checked={tiposEscolhidos.length === 0} />
                  {t("Todos os tipos")}
                </button>
                {tipos.map((nome) => (
                  <button
                    key={nome}
                    type="button"
                    className={linha}
                    data-testid={`filtro-tipo-${nome}`}
                    onClick={() => aoMudarTipos(alternar(tiposEscolhidos, nome))}
                  >
                    <input type="checkbox" readOnly checked={tiposEscolhidos.includes(nome)} />
                    <span className="min-w-0 truncate">{nome}</span>
                  </button>
                ))}
              </>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** A regra do filtro, pura: lista vazia não filtra; o bloco do Google só segue a pessoa. */
export function aplicaFiltroDaAgenda<
  T extends { responsavelId: string; tipo?: string; origem: string },
>(lista: T[], pessoas: string[], tipos: string[]): T[] {
  if (pessoas.length === 0 && tipos.length === 0) return lista;
  return lista.filter((a) => {
    if (pessoas.length > 0 && !pessoas.includes(a.responsavelId)) return false;
    if (tipos.length > 0 && a.origem !== "google_sync" && !(a.tipo && tipos.includes(a.tipo))) {
      return false;
    }
    return true;
  });
}
