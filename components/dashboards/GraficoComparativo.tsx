"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { COR_DA_MARCA, COR_DO_APOIO } from "@/components/dashboards/base";
import { useT } from "@/hooks/i18n/useT";

export interface MetricaDoGrafico {
  id: string;
  rotulo: string;
  formato: (v: number) => string;
}

/**
 * O gráfico de duas métricas (eixo duplo) do ONE: a principal em destaque (cor da marca) e a
 * secundária tracejada. A pessoa escolhe quais.
 */
export function GraficoComparativo({
  dados,
  metricas,
  inicial,
}: {
  dados: Array<Record<string, number | string>>;
  metricas: MetricaDoGrafico[];
  inicial: [string, string];
}) {
  const t = useT();
  const [a, setA] = useState(inicial[0]);
  const [b, setB] = useState(inicial[1]);
  const ma = metricas.find((m) => m.id === a) ?? metricas[0]!;
  const mb = metricas.find((m) => m.id === b) ?? metricas[1] ?? metricas[0]!;
  const serie = dados.map((d) => ({
    dia: String(d.data).slice(8, 10) + "/" + String(d.data).slice(5, 7),
    [ma.id]: d[ma.id],
    [mb.id]: d[mb.id],
  }));
  const seletor = (valor: string, aoMudar: (v: string) => void, cor: string, rotulo: string) => (
    <label className="flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-xs">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} aria-hidden />
      <span className="sr-only">{rotulo}</span>
      <select
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="bg-transparent text-xs outline-hidden"
      >
        {metricas.map((m) => (
          <option key={m.id} value={m.id}>
            {m.rotulo}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {seletor(a, setA, COR_DA_MARCA, t("Métrica principal"))}
        {seletor(b, setB, COR_DO_APOIO, t("Métrica de comparação"))}
      </div>
      <div className="h-[260px] w-full sm:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="dia"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={18}
            />
            <YAxis
              yAxisId="a"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => ma.formato(v)}
            />
            <YAxis
              yAxisId="b"
              orientation="right"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => mb.formato(v)}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                fontSize: 12,
              }}
              formatter={(valor, nome) => {
                const m = nome === ma.rotulo ? ma : mb;
                return [m.formato(Number(valor)), nome];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              yAxisId="a"
              type="monotone"
              dataKey={ma.id}
              name={ma.rotulo}
              stroke={COR_DA_MARCA}
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              yAxisId="b"
              type="monotone"
              dataKey={mb.id}
              name={mb.rotulo}
              stroke={COR_DO_APOIO}
              strokeWidth={1.8}
              strokeDasharray="5 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
