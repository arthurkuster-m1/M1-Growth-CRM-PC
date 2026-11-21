import { brl } from "@/components/financas/kit";

const A = 240,
  pad = { e: 46, d: 12, t: 14, b: 30 };
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const curto = (cents: number) => compacto.format(Math.round(cents / 100));
/** Faixas "redondas" (1, 2, 5 × 10^n) para a grade do gráfico; devolve também o teto da escala. Valores em centavos. */
export function faixasDoGrafico(
  min: number,
  max: number,
  alvo = 4,
): { ticks: number[]; teto: number } {
  const span = max - min || 1,
    bruto = span / alvo,
    mag = 10 ** Math.floor(Math.log10(bruto)),
    f = bruto / mag;
  const passo = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = Math.ceil(min / passo) * passo; v < max + passo - 1e-6; v += passo) {
    ticks.push(v);
    if (v >= max) break;
  }
  return { ticks, teto: ticks[ticks.length - 1] ?? max };
}
export type PontoLinha = { rotulo: string; valor: number | null };

/** Linha simples (evolução do patrimônio). Sem dependência de biblioteca; leitura por voz no aria-label e tabela ao lado. */
export function GraficoLinha({
  pontos,
  titulo,
  largura = 640,
}: {
  pontos: PontoLinha[];
  titulo: string;
  /** largura do desenho (menor = gráfico compacto, com letras do mesmo tamanho) */ largura?: number;
}) {
  const L = largura;
  const com = pontos.filter((p) => p.valor !== null) as { rotulo: string; valor: number }[];
  if (com.length === 0) return null;
  const vals = com.map((p) => p.valor);
  const min0 = Math.min(0, ...vals),
    max0 = Math.max(1, ...vals);
  const { ticks, teto } = faixasDoGrafico(min0, max0);
  const min = Math.min(min0, ticks[0] ?? min0),
    max = Math.max(max0, teto);
  const x = (i: number) =>
    pad.e +
    (pontos.length === 1
      ? (L - pad.e - pad.d) / 2
      : (i / (pontos.length - 1)) * (L - pad.e - pad.d));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (A - pad.t - pad.b);
  const idx = pontos.map((p, i) => (p.valor === null ? -1 : i)).filter((i) => i >= 0);
  const caminho = idx
    .map((i, k) => `${k ? "L" : "M"}${x(i).toFixed(1)} ${y(pontos[i]!.valor as number).toFixed(1)}`)
    .join("");
  const area = `${caminho}L${x(idx[idx.length - 1]!).toFixed(1)} ${y(0).toFixed(1)}L${x(idx[0]!).toFixed(1)} ${y(0).toFixed(1)}Z`;
  const ult = com[com.length - 1]!,
    pri = com[0]!;
  const passo = pontos.length > 8 ? 2 : 1;
  return (
    <figure className="gr">
      <svg
        viewBox={`0 0 ${L} ${A}`}
        role="img"
        aria-label={`${titulo}: de ${brl(pri.valor)} em ${pri.rotulo} a ${brl(ult.valor)} em ${ult.rotulo}.`}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.e} x2={L - pad.d} y1={y(v)} y2={y(v)} className="gr__grade" />
            <text
              x={pad.e - 6}
              y={y(v) + 3.5}
              textAnchor="end"
              className="gr__tick"
              data-testid="faixa-grafico"
            >
              {v === 0 ? "0" : curto(v)}
            </text>
          </g>
        ))}
        {min < 0 && <line x1={pad.e} x2={L - pad.d} y1={y(0)} y2={y(0)} className="gr__zero" />}
        <path d={area} className="gr__area" />
        <path d={caminho} className="gr__linha" />
        {idx.map((i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(pontos[i]!.valor as number)}
            r={i === idx[idx.length - 1] ? 5.5 : 3.5}
            className={i === idx[idx.length - 1] ? "gr__ponto gr__ponto--fim" : "gr__ponto"}
          >
            <title>
              {pontos[i]!.rotulo}: {brl(pontos[i]!.valor as number)}
            </title>
          </circle>
        ))}
        {pontos.map(
          (p, i) =>
            (i % passo === 0 || i === pontos.length - 1) && (
              <text
                key={p.rotulo}
                x={x(i)}
                y={A - 8}
                textAnchor={i === 0 ? "start" : i === pontos.length - 1 ? "end" : "middle"}
                className="gr__eixo"
              >
                {p.rotulo}
              </text>
            ),
        )}
      </svg>
    </figure>
  );
}

/* ───── Barras do ano: verde = ganho, vermelho = gasto; a divisão por categoria aparece ao passar o mouse e ao clicar ───── */
const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const inteiro = (cents: number) => nf0.format(Math.round(cents / 100));
export type LadoDoMes = "entradas" | "saidas";
export type SelecaoBarra = { mes: string; lado: LadoDoMes } | null;
type Mes = import("@/lib/financas/anual").MesEmpilhado;

export function GraficoEmpilhado({
  meses,
  rotuloDoMes,
  nomeDoMes,
  mostrarLucro,
  selecao,
  onSelecionar,
}: {
  meses: Mes[];
  rotuloDoMes: (mes: string) => string;
  nomeDoMes: (mes: string) => string;
  mostrarLucro: boolean;
  selecao: SelecaoBarra;
  onSelecionar: (s: SelecaoBarra) => void;
}) {
  const max = Math.max(1, ...meses.flatMap((m) => [m.totalEntradas, m.totalSaidas]));
  const ALTURA = 210; // px da barra mais alta
  const barra = (m: Mes, lado: LadoDoMes) => {
    const segs = lado === "entradas" ? m.entradas : m.saidas;
    const total = lado === "entradas" ? m.totalEntradas : m.totalSaidas;
    const previsto = segs.reduce((a, s) => a + s.previsto, 0);
    const sel = selecao?.mes === m.mes && selecao.lado === lado;
    const dica = [
      `${nomeDoMes(m.mes)} · ${lado === "entradas" ? "Entradas" : "Saídas"}: ${brl(total)}`,
      ...segs.slice(0, 8).map((s) => `${s.nome}: ${brl(s.pago + s.previsto)}`),
      segs.length > 8 ? `…e mais ${segs.length - 8}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    return (
      <button
        type="button"
        key={lado}
        className={`ac__barra ac__barra--${lado === "entradas" ? "ent" : "sai"}${sel ? "is-sel" : ""}`}
        title={dica}
        style={{ height: total > 0 ? Math.max((total / max) * ALTURA, 3) : 0 }}
        aria-pressed={sel}
        disabled={total === 0}
        aria-label={`${nomeDoMes(m.mes)}, ${lado === "entradas" ? "entradas" : "saídas"}: ${brl(total)}. Ver a divisão por categoria.`}
        onClick={() => onSelecionar(sel ? null : { mes: m.mes, lado })}
      >
        {previsto > 0 && (
          <span className="ac__prev" style={{ height: `${(previsto / total) * 100}%` }} />
        )}
      </button>
    );
  };
  return (
    <figure className="ac">
      <div className="ac__rolagem">
        <div className="ac__grade">
          {meses.map((m) => {
            const topo = Math.max(m.totalEntradas, m.totalSaidas);
            return (
              <div key={m.mes} className="ac__mes">
                <div className="ac__area" style={{ height: ALTURA + 46 }}>
                  {topo > 0 && (
                    <div className="ac__valores" style={{ bottom: (topo / max) * ALTURA + 8 }}>
                      {m.totalEntradas > 0 && (
                        <span className="ac__valor ac__valor--ent">{inteiro(m.totalEntradas)}</span>
                      )}
                      {m.totalSaidas > 0 && (
                        <span className="ac__valor ac__valor--sai">{inteiro(m.totalSaidas)}</span>
                      )}
                    </div>
                  )}
                  <div className="ac__barras">
                    {barra(m, "entradas")}
                    {barra(m, "saidas")}
                  </div>
                </div>
                <div className="ac__base">
                  {mostrarLucro ? (
                    <span
                      className={`ac__lucro${m.lucro < 0 ? "is-neg" : ""}`}
                      title="Lucro do mês: entradas − saídas"
                    >
                      {m.totalEntradas > 0 || m.totalSaidas > 0
                        ? `${m.lucro < 0 ? "−" : "+"}${inteiro(Math.abs(m.lucro))}`
                        : "·"}
                    </span>
                  ) : (
                    <span className="ac__lucro" aria-hidden>
                      &nbsp;
                    </span>
                  )}
                  <span className="ac__rotulo">{rotuloDoMes(m.mes)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <figcaption className="ac__legenda t-caption t-muted">
        <span>
          <i className="ac__chip ac__chip--ent" />
          Ganhos
        </span>
        <span>
          <i className="ac__chip ac__chip--sai" />
          Gastos
        </span>
        <span>
          <i className="ac__chip ac__chip--prev" />
          Previsto (listrado)
        </span>
        {mostrarLucro && <span>Abaixo da linha: lucro do mês</span>}
        <span>Passe o mouse ou clique numa barra para ver as categorias</span>
      </figcaption>
    </figure>
  );
}
