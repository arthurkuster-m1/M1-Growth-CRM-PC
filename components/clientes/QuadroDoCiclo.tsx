"use client";

import Link from "next/link";

import { Etiqueta } from "@/components/motor/Etiqueta";
import { useT } from "@/hooks/i18n/useT";
import { CICLOS_DE_VIDA, COR_DO_CICLO, ehCicloDeVida, ROTULO_DO_CICLO } from "@/lib/ciclo-de-vida";

interface ClienteDoQuadro {
  contact_id: string;
  nome: string;
  telefone: string | null;
  ciclo_de_vida: string | null;
  ltv_cents: number;
  oportunidades_abertas: number;
  tags: string[];
}

const moeda = (c: number) =>
  (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * O QUADRO da aba Clientes: uma coluna por status do CICLO DE VIDA (Novo lead, Em negociação,
 * Cliente ativo, Em reativação, Ex-cliente, Nunca comprou, Desqualificado). O status é calculado
 * pelo sistema, então os cartões não se arrastam: a pessoa muda de coluna quando o negócio muda.
 */
export function QuadroDoCiclo({ clientes }: { clientes: readonly ClienteDoQuadro[] }) {
  const t = useT();
  const colunas = CICLOS_DE_VIDA.map((ciclo) => ({
    ciclo,
    itens: clientes.filter((c) => (ehCicloDeVida(c.ciclo_de_vida) ? c.ciclo_de_vida : null) === ciclo),
  }));
  return (
    <div className="flex min-w-0 gap-3 overflow-x-auto pb-2" role="list" aria-label={t("Ciclo de vida")}>
      {colunas.map(({ ciclo, itens }) => (
        <section
          key={ciclo}
          role="listitem"
          className="flex w-64 shrink-0 flex-col gap-2 rounded-2xl border bg-secondary/40 p-2"
        >
          <header className="flex items-center justify-between gap-2 px-1.5 pt-1">
            <Etiqueta ponto cor={COR_DO_CICLO[ciclo]}>
              {t(ROTULO_DO_CICLO[ciclo])}
            </Etiqueta>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {itens.length}
            </span>
          </header>
          <ul className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto">
            {itens.length === 0 ? (
              <li className="px-2 py-3 text-xs text-muted-foreground">{t("Ninguém aqui.")}</li>
            ) : (
              itens.map((c) => (
                <li key={c.contact_id}>
                  <Link
                    href={`/app/contacts/${c.contact_id}`}
                    className="block rounded-xl border bg-card px-3 py-2 text-sm shadow-xs transition-colors hover:border-primary/50"
                  >
                    <p className="truncate font-medium">{c.nome}</p>
                    {c.telefone ? (
                      <p className="truncate text-xs text-muted-foreground">{c.telefone}</p>
                    ) : null}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {c.ltv_cents > 0 ? (
                        <span className="tabular-nums">
                          {t("LTV")} {moeda(c.ltv_cents)}
                        </span>
                      ) : null}
                      {c.oportunidades_abertas > 0 ? (
                        <span>
                          {c.oportunidades_abertas === 1
                            ? t("1 oportunidade aberta")
                            : `${c.oportunidades_abertas} ${t("oportunidades abertas")}`}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
