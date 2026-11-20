"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Segmented, brl } from "@/components/financas/kit";
import type { GrupoDetalhe } from "@/lib/financas/anual";
import { achatar } from "@/lib/financas/tabelaAno";

const SEM = "_sem";
type Fatia = {
  chave: string;
  nome: string;
  total: number;
  previsto: number;
  orcamento: number;
  cor: string;
};

/** Pizza do ano por categoria (mesma ideia da pizza do mês): marque 1 ou mais categorias para somar o ano todo e comparar com a meta/orçamento. */
export function PizzaAno({
  ano,
  renda,
  gastos,
  corDe,
}: {
  ano: number;
  renda: GrupoDetalhe[];
  gastos: GrupoDetalhe[];
  corDe: (id: string | null) => string;
}) {
  const [vista, setVista] = useState<"saida" | "entrada">("saida");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [todas, setTodas] = useState(false);
  useEffect(() => {
    setSel(new Set());
    setTodas(false);
  }, [vista, ano]);

  const lista: Fatia[] = useMemo(
    () =>
      achatar(vista === "saida" ? gastos : renda)
        .filter((c) => c.total > 0)
        .map((c) => ({
          chave: c.id ?? SEM,
          nome: c.nome,
          total: c.total,
          previsto: c.previsto,
          orcamento: c.orcamentoAno,
          cor: corDe(c.id),
        }))
        .sort((a, b) => b.total - a.total),
    [vista, gastos, renda, corDe],
  );
  const total = lista.reduce((a, f) => a + f.total, 0);
  const ganho = vista === "entrada";
  const titulo = ganho ? "Entradas por categoria no ano" : "Gastos por categoria no ano";
  const escolhidas = lista.filter((f) => sel.has(f.chave));
  const somaSel = escolhidas.reduce((a, f) => a + f.total, 0);
  const orcSel = escolhidas.reduce((a, f) => a + f.orcamento, 0);
  const alternar = (k: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const R = 120,
    C = 130;
  // o ângulo onde cada fatia começa: soma acumulada das anteriores (sem reatribuir variável durante o desenho)
  const inicios = lista.reduce<number[]>((acc, f, i) => {
    acc.push(i === 0 ? -Math.PI / 2 : acc[i - 1]! + (lista[i - 1]!.total / total) * Math.PI * 2);
    return acc;
  }, []);
  const caminhos = lista.map((f, i) => {
    const ang = inicios[i]!;
    const arco = (f.total / total) * Math.PI * 2;
    const p = (a: number) =>
      `${(C + R * Math.cos(a)).toFixed(2)} ${(C + R * Math.sin(a)).toFixed(2)}`;
    const d =
      lista.length === 1
        ? `M${C - R} ${C}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`
        : `M${C} ${C}L${p(ang)}A${R} ${R} 0 ${arco > Math.PI ? 1 : 0} 1 ${p(ang + arco)}Z`;
    return (
      <path
        key={f.chave}
        d={d}
        fill={f.cor}
        className={sel.size ? (sel.has(f.chave) ? "is-sel" : "is-dim") : undefined}
        onClick={() => alternar(f.chave)}
        aria-hidden
      >
        <title>
          {f.nome}: {brl(f.total)}
        </title>
      </path>
    );
  });
  const visiveis = sel.size > 0 && !todas ? escolhidas : lista;

  return (
    <Card className="fi-stack" data-testid="pizza-ano">
      <div className="fi-row fi-row--between fi-row--wrap">
        <h2 className="t-h3">{titulo}</h2>
        <span className="t-caption t-muted">
          Marque uma ou mais categorias para filtrar e somar
        </span>
      </div>
      <Segmented
        block
        value={vista}
        onChange={setVista}
        options={[
          { value: "saida", label: "Saídas" },
          { value: "entrada", label: "Entradas" },
        ]}
      />
      {!total ? (
        <p className="t-body t-muted" style={{ padding: "16px 0" }}>
          {ganho ? `Nenhuma entrada em ${ano}.` : `Nenhuma saída em ${ano}.`}
        </p>
      ) : (
        <>
          <div className="mes-pizza">
            <svg
              viewBox="0 0 260 260"
              className="mes-pizza__svg"
              role="img"
              aria-label={`${titulo}: total ${brl(total)}`}
            >
              {caminhos}
              <circle cx={C} cy={C} r="62" className="mes-pizza__furo" pointerEvents="none" />
              <text
                x={C}
                y={C + 2}
                className="mes-pizza__total"
                textAnchor="middle"
                pointerEvents="none"
              >
                {brl(sel.size ? somaSel : total)}
              </text>
              <text
                x={C}
                y={C + 20}
                className="mes-pizza__sub"
                textAnchor="middle"
                pointerEvents="none"
              >
                {sel.size === 0
                  ? "total do ano"
                  : escolhidas.length === 1
                    ? escolhidas[0]!.nome
                    : `${escolhidas.length} categorias`}
              </text>
            </svg>
            <ul className="mes-leg-lista" data-testid="legenda-ano">
              {visiveis.map((f) => {
                const uso = f.orcamento > 0 ? f.total / f.orcamento : null;
                const nivel =
                  uso === null
                    ? null
                    : ganho
                      ? "ok"
                      : uso >= 1
                        ? "bad"
                        : uso >= 0.8
                          ? "warn"
                          : "ok";
                return (
                  <li key={f.chave}>
                    <button
                      type="button"
                      className={sel.has(f.chave) ? "mes-leg-item is-sel" : "mes-leg-item"}
                      aria-pressed={sel.has(f.chave)}
                      onClick={() => alternar(f.chave)}
                    >
                      <span className="mes-dot" style={{ background: f.cor }} aria-hidden />
                      <span className="mes-leg-item__nome">
                        {f.nome}
                        {f.previsto > 0 && (
                          <span className="t-caption t-muted">
                            {" "}
                            · inclui {brl(f.previsto)} previsto
                          </span>
                        )}
                        {uso !== null && (
                          <span className="mes-leg-item__orc" data-tone={nivel}>
                            {Math.round(uso * 100)}% {ganho ? "da meta" : "do orçamento"} de{" "}
                            {brl(f.orcamento)}
                          </span>
                        )}
                      </span>
                      <span className="t-money">{brl(f.total)}</span>
                      <span className="t-caption t-muted mes-leg-item__pct">
                        {Math.round((f.total / total) * 100)}%
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          {sel.size > 0 && (
            <p className="t-body-sm" data-testid="soma-selecao-ano">
              <b>
                {escolhidas.length === 1 ? escolhidas[0]!.nome : `${escolhidas.length} categorias`}
              </b>{" "}
              no ano: <b className="t-money">{brl(somaSel)}</b> (
              {Math.round((somaSel / total) * 100)}% do total)
              {orcSel > 0 && (
                <>
                  {" "}
                  · {Math.round((somaSel / orcSel) * 100)}% {ganho ? "da meta" : "do orçamento"} de{" "}
                  {brl(orcSel)}
                </>
              )}
            </p>
          )}
          {sel.size > 0 && lista.length > escolhidas.length && (
            <button
              type="button"
              className="mes-chip mes-leg-todas"
              onClick={() => setTodas((v) => !v)}
            >
              {todas
                ? "Mostrar só as selecionadas"
                : `Mostrar todas as categorias (${lista.length})`}
            </button>
          )}
        </>
      )}
    </Card>
  );
}
