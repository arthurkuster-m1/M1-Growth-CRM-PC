import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * O FUNIL de verdade, sempre em forma de funil: cada etapa é um trapézio que afunila na MESMA
 * proporção, não importa o quanto os números sejam diferentes (12 milhões de impressões para 32
 * mil leads não vira uma linha fina). À direita, as taxas de passagem em blocos menores.
 * O desenho copia o contorno da marca (`--primary`) das pirâmides de Marketing.
 */
export interface EtapaDoFunil {
  rotulo: string;
  valor: string;
}
export interface TaxaDoFunil {
  rotulo: string;
  valor: string;
  detalhe: string;
}

const PISO_DA_BASE = 28;

export function FunilComTaxas({
  etapas,
  taxas,
}: {
  etapas: readonly EtapaDoFunil[];
  taxas: readonly TaxaDoFunil[];
}) {
  const n = Math.max(1, etapas.length);
  const passo = (100 - PISO_DA_BASE) / n;
  const poligono = (topo: number, base: number, recuo = 0) => {
    const esq = (w: number) => Math.min(50 - w / 2 + recuo, 50);
    const dir = (w: number) => Math.max(50 + w / 2 - recuo, 50);
    return `polygon(${esq(topo)}% 0, ${dir(topo)}% 0, ${dir(base)}% 100%, ${esq(base)}% 100%)`;
  };
  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <ol className="mx-auto grid w-full max-w-3xl auto-rows-[4.75rem] sm:auto-rows-[5.5rem]">
        {etapas.map((e, i) => {
          const topo = 100 - i * passo;
          const base = 100 - (i + 1) * passo;
          // Do topo (mais escuro) à ponta (cor cheia da marca).
          const forca = n === 1 ? 100 : 30 + (i / (n - 1)) * 70;
          const claro = forca >= 62;
          return (
            <li key={e.rotulo} className="relative py-[2px]">
              <div
                aria-hidden
                style={{ clipPath: poligono(topo, base) }}
                className="absolute inset-x-0 inset-y-[2px] bg-primary"
              />
              <div
                style={{
                  clipPath: poligono(topo, base, 0.7),
                  backgroundColor: `color-mix(in srgb, var(--primary) ${forca}%, var(--card))`,
                }}
                className="absolute inset-x-0 inset-y-[4px] grid place-items-center"
              >
                <div className="px-2 text-center">
                  <p
                    className={cn(
                      "font-mono text-[10px] font-semibold tracking-widest uppercase sm:text-[11px]",
                      claro ? "text-primary-foreground/90" : "text-foreground/80",
                    )}
                  >
                    {e.rotulo}
                  </p>
                  <p
                    className={cn(
                      "text-lg font-bold tracking-tight tabular-nums sm:text-2xl",
                      claro ? "text-primary-foreground" : "text-foreground",
                    )}
                  >
                    {e.valor}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col justify-around gap-3">
        {taxas.map((x) => (
          <div key={x.rotulo} className="rounded-xl border bg-background px-4 py-3">
            <p className="font-mono text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
              {x.rotulo}
            </p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-bold tracking-tight text-primary tabular-nums">
                {x.valor}
              </span>
              <span className="text-xs text-muted-foreground">{x.detalhe}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** As COLUNAS do funil completo: o número principal de cada etapa e, embaixo, as contas dela. */
export function FunilEmColunas({
  colunas,
}: {
  colunas: ReadonlyArray<{
    rotulo: string;
    valor: string;
    itens: ReadonlyArray<{ rotulo: string; valor: ReactNode }>;
  }>;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-3">
      {colunas.map((c) => (
        <div key={c.rotulo} className="overflow-hidden rounded-xl border bg-background">
          <div className="border-b bg-primary/10 px-4 py-3">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              {c.rotulo}
            </p>
            <p className="mt-1 text-xl font-bold text-primary tabular-nums">{c.valor}</p>
          </div>
          <dl className="divide-y">
            {c.itens.map((i) => (
              <div key={i.rotulo} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <dt className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {i.rotulo}
                </dt>
                <dd className="text-sm font-semibold tabular-nums">{i.valor}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
