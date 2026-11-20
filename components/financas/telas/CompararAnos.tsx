"use client";

import { useEffect, useMemo, useState } from "react";
import { CaretDown, CaretRight } from "@/lib/ui/icons";
import { Card, Select, Skeleton, brl } from "@/components/financas/kit";
import { rs } from "./comuns";
import { listarParaHistorico, patrimonioMensal, useFinancas } from "@/lib/financas/dados";
import { hoje } from "@/lib/financas/formato";
import {
  compararAnos,
  metricasDoAno,
  type LinhaComparacao,
  type MetricasAno,
} from "@/lib/financas/compararAnos";

const pct = (n: number) => `${Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function frase(x: LinhaComparacao, ano: number): string | null {
  if (x.dif === null || x.dif === 0) return null;
  const mais = x.dif > 0,
    v = brl(Math.abs(x.dif)),
    p = x.pct !== null ? ` (${pct(x.pct)} ${mais ? "de aumento" : "de redução"})` : "";
  switch (x.chave) {
    case "saidas":
      return `Em ${ano} você gastou ${v} ${mais ? "a mais" : "a menos"}${p} — o custo de vida ${mais ? "subiu" : "caiu"}.`;
    case "aportes":
      return `Em ${ano} você investiu ${v} ${mais ? "a mais" : "a menos"}${p}.`;
    case "entradas":
      return `Em ${ano} você ganhou ${v} ${mais ? "a mais" : "a menos"}${p}.`;
    case "resultado":
      return `O resultado do ano ${mais ? "melhorou" : "piorou"} ${v}${p}.`;
    case "patrimonio":
      return `O patrimônio no fim do ano ${mais ? "cresceu" : "caiu"} ${v}${p}.`;
    default:
      return null;
  }
}

/** "Comparar anos": escolhe dois anos e mostra as principais métricas lado a lado, em valor e em %. */
export function CompararAnos({ anoInicial }: { anoInicial: number }) {
  const { contas, categoriasDoAno } = useFinancas();
  const atual = Number(hoje().slice(0, 4));
  const [aberto, setAberto] = useState(false);
  const [a, setA] = useState(anoInicial - 1);
  const [b, setB] = useState(anoInicial);
  const [m, setM] = useState<{ a: MetricasAno; b: MetricasAno } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const anos = useMemo(() => {
    const l: number[] = [];
    for (let x = atual + 1; x >= 2021; x--) l.push(x);
    return l;
  }, [atual]);
  useEffect(() => {
    if (!aberto) return;
    let vivo = true;
    setM(null);
    setErro(null);
    const um = async (ano: number) => {
      const [lancamentos, pat] = await Promise.all([
        listarParaHistorico(`${ano}-01`, `${ano + 1}-01`),
        patrimonioMensal(`${ano}-12`, 1),
      ]);
      return metricasDoAno({
        ano,
        hoje: hoje(),
        contas,
        categorias: categoriasDoAno(ano),
        lancamentos,
        patrimonioFim: pat.length ? pat[pat.length - 1]!.contas_cents : null,
      });
    };
    Promise.all([um(a), um(b)]).then(
      ([ma, mb]) => vivo && setM({ a: ma, b: mb }),
      (e: Error) => vivo && setErro(e.message),
    );
    return () => {
      vivo = false;
    };
  }, [aberto, a, b, contas, categoriasDoAno]);
  const linhas = m ? compararAnos(m.a, m.b) : [];
  const Seta = aberto ? CaretDown : CaretRight;
  const cel = (v: number | null) => (v === null ? "—" : rs(v));
  return (
    <Card className="fi-stack" data-testid="comparar-anos">
      <button
        type="button"
        className="plano__toggle"
        aria-expanded={aberto}
        onClick={() => setAberto((x) => !x)}
      >
        <h2 className="t-h3">
          <Seta size={16} weight="bold" aria-hidden /> Comparar anos
        </h2>
        <span className="t-body-sm t-muted">Escolha dois anos e veja o que mudou</span>
      </button>
      {aberto && (
        <>
          <div className="fi-row fi-row--wrap">
            <Select
              aria-label="Ano base"
              value={String(a)}
              onChange={(e) => setA(Number(e.target.value))}
            >
              {anos.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
            <span className="t-body-sm t-muted">comparado com</span>
            <Select
              aria-label="Ano comparado"
              value={String(b)}
              onChange={(e) => setB(Number(e.target.value))}
            >
              {anos.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </Select>
          </div>
          {erro && (
            <p className="fi-error-text" role="alert">
              {erro}
            </p>
          )}
          {!m && !erro ? (
            <Skeleton h={160} />
          ) : (
            m && (
              <>
                <div className="mes-tab__rolagem">
                  <table
                    className="mes-tab mes-tab--compacta"
                    style={{ minWidth: 0 }}
                    data-testid="tabela-comparacao"
                  >
                    <thead>
                      <tr>
                        <th>Métrica</th>
                        <th className="mes-tab__v">{a}</th>
                        <th className="mes-tab__v">{b}</th>
                        <th className="mes-tab__v">Diferença</th>
                        <th className="mes-tab__v">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((x) => {
                        const bom =
                          x.dif === null || x.dif === 0 || x.bomSubir === null
                            ? null
                            : x.dif > 0 === x.bomSubir;
                        const cor =
                          bom === null
                            ? undefined
                            : { color: bom ? "var(--color-success-fg)" : "var(--color-error-fg)" };
                        return (
                          <tr key={x.chave} data-chave={x.chave}>
                            <td>{x.rotulo}</td>
                            <td className="mes-tab__v t-money">{cel(x.a)}</td>
                            <td className="mes-tab__v t-money">{cel(x.b)}</td>
                            <td className="mes-tab__v t-money" style={cor}>
                              {x.dif === null ? (
                                "—"
                              ) : (
                                <>
                                  {x.dif > 0 ? "+ " : x.dif < 0 ? "− " : ""}
                                  {rs(Math.abs(x.dif))}
                                </>
                              )}
                            </td>
                            <td className="mes-tab__v t-money" style={cor}>
                              {x.pct === null
                                ? "—"
                                : `${x.pct > 0 ? "+" : x.pct < 0 ? "−" : ""}${pct(x.pct)}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <ul className="t-body" data-testid="frases-comparacao">
                  {linhas.map((x) => {
                    const f = frase(x, b);
                    return f ? <li key={x.chave}>{f}</li> : null;
                  })}
                </ul>
                <p className="t-caption t-muted">
                  Valores cheios (pagos + previstos); o patrimônio do fim do ano é o realizado. As
                  médias dividem pelos meses de janeiro até o último mês com lançamentos.
                  “Investido” = dinheiro transferido para contas de investimento, menos o que saiu
                  delas.
                </p>
              </>
            )
          )}
        </>
      )}
    </Card>
  );
}
