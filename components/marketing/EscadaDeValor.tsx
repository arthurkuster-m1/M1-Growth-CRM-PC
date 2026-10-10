import Link from "next/link";

import type { EtapaDaOferta } from "@/lib/marketing/blocos";
import { ROTULO_DA_ETAPA } from "@/lib/marketing/oferta";
import { cn } from "@/lib/utils";

export interface DegrauDaEscada {
  chave: string;
  titulo: string;
  etapa: EtapaDaOferta;
  carroChefe: boolean;
  preco: string;
  href: string;
}

const ETAPAS: EtapaDaOferta[] = ["isca", "entrada", "principal", "expansao", "recorrencia"];

/**
 * A ESCADA DE VALOR, montada sozinha: cada oferta cai na etapa que a agência escolheu nela
 * (isca, entrada, principal, expansão, recorrência). O caminho de cima para baixo mostra como
 * o cliente sobe: do primeiro contato até quem fica e compra de novo.
 */
export function EscadaDeValor({ ofertas }: { ofertas: DegrauDaEscada[] }) {
  if (ofertas.length === 0) return null;
  return (
    <ol className="grid gap-3 sm:grid-cols-5">
      {ETAPAS.map((etapa, i) => {
        const daEtapa = ofertas.filter((o) => o.etapa === etapa);
        return (
          <li key={etapa} className="flex flex-col gap-2">
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold tracking-wider uppercase",
                daEtapa.length > 0
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground",
              )}
              style={{ marginLeft: `${i * 0}px` }}
            >
              <span className="font-mono">{String(i + 1).padStart(2, "0")}</span>
              {ROTULO_DA_ETAPA[etapa]}
            </div>
            {daEtapa.length === 0 ? (
              <div className="rounded-xl border border-dashed p-3 text-center text-sm text-muted-foreground">
                —
              </div>
            ) : (
              daEtapa.map((o) => (
                <Link
                  key={o.chave}
                  href={o.href}
                  className="flex flex-col gap-0.5 rounded-xl border-[1.5px] border-primary bg-card p-3 transition-colors hover:bg-primary/5"
                >
                  <span className="text-sm font-semibold">{o.titulo}</span>
                  <span className="text-xs font-medium text-primary">{o.preco}</span>
                  {o.carroChefe ? (
                    <span className="mt-1 w-fit rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      ★
                    </span>
                  ) : null}
                </Link>
              ))
            )}
          </li>
        );
      })}
    </ol>
  );
}
