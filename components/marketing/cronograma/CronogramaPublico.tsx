"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import {
  PainelDoCronograma,
  type RotulosDoCronograma,
} from "@/components/marketing/cronograma/PainelDoCronograma";
import { useBaixarImagem } from "@/hooks/marketing/useCronograma";
import type {
  ConfigDoCronograma,
  ItemDoCronograma,
  MetaDoCronograma,
  TarefaDoCronograma,
} from "@/lib/marketing/cronograma";
import { cn } from "@/lib/utils";

/** O cronograma do link sem login: abas (geral e semana), navegação de semana e a imagem. */
export function CronogramaPublico({
  config,
  itens,
  metas,
  tarefas,
  inicioDaSemana,
  semanaAtual,
  rotulos,
  textos,
  hrefAnterior,
  hrefProxima,
  hrefHoje,
}: {
  config: ConfigDoCronograma;
  itens: ItemDoCronograma[];
  metas: MetaDoCronograma[];
  tarefas: TarefaDoCronograma[];
  inicioDaSemana: string;
  semanaAtual: number | null;
  rotulos: RotulosDoCronograma;
  textos: {
    geral: string;
    semana: string;
    baixar: string;
    gerando: string;
    anterior: string;
    proxima: string;
    estaSemana: string;
  };
  hrefAnterior: string;
  hrefProxima: string;
  hrefHoje: string | null;
}) {
  const [aba, setAba] = useState<"geral" | "semana">("geral");
  const captura = useRef<HTMLDivElement>(null);
  const baixar = useBaixarImagem();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl bg-secondary p-0.5">
          {(
            [
              ["geral", textos.geral],
              ["semana", textos.semana],
            ] as const
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={aba === valor}
              onClick={() => setAba(valor)}
              className={cn(
                "h-9 rounded-[10px] px-4 text-sm font-medium transition-colors",
                aba === valor
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {rotulo}
            </button>
          ))}
        </div>
        {aba === "semana" ? (
          <div className="inline-flex items-center gap-1 text-sm">
            <Link
              href={hrefAnterior}
              className="h-9 rounded-lg border px-3 leading-9 hover:bg-secondary"
            >
              {textos.anterior}
            </Link>
            <Link
              href={hrefProxima}
              className="h-9 rounded-lg border px-3 leading-9 hover:bg-secondary"
            >
              {textos.proxima}
            </Link>
            {hrefHoje ? (
              <Link
                href={hrefHoje}
                className="h-9 rounded-lg px-3 leading-9 text-primary hover:bg-secondary"
              >
                {textos.estaSemana}
              </Link>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          disabled={baixar.isPending}
          onClick={() =>
            captura.current &&
            baixar.mutate({
              elemento: captura.current,
              nome: aba === "geral" ? "cronograma.png" : "tarefas-da-semana.png",
            })
          }
          className="ml-auto h-9 rounded-xl border bg-card px-4 text-sm font-medium shadow-sm hover:bg-secondary disabled:opacity-50"
        >
          {baixar.isPending ? textos.gerando : textos.baixar}
        </button>
      </div>
      <div ref={captura}>
        <PainelDoCronograma
          vista={aba}
          config={config}
          itens={itens}
          metas={metas}
          tarefas={tarefas}
          inicioDaSemana={inicioDaSemana}
          semanaAtual={semanaAtual}
          rotulos={rotulos}
          mostrarAdiamentos={false}
        />
      </div>
    </div>
  );
}
