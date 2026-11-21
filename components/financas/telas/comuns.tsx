"use client";

import { brl } from "@/components/financas/kit";
import { Field, Select } from "@/components/financas/kit";
import {
  dataBR,
  datasDaFatura,
  faturaPadrao,
  mesAnterior,
  mesCurto,
  mesSeguinte,
} from "@/lib/financas/formato";
import type { Conta } from "@/lib/financas/dados";

/** <option>s de conta em grupos: Contas, Cartões e, por último, Investimentos (raramente movimentados). Cada grupo mantém a ordem do app. */
export function OpcoesContas({ contas }: { contas: Conta[] }) {
  const grupos = [
    {
      rotulo: "Contas",
      lista: contas.filter((c) => c.tipo !== "cartao" && c.tipo !== "investida"),
    },
    { rotulo: "Cartões", lista: contas.filter((c) => c.tipo === "cartao") },
    { rotulo: "Investimentos", lista: contas.filter((c) => c.tipo === "investida") },
  ].filter((g) => g.lista.length > 0);
  const op = (c: Conta) => (
    <option key={c.id} value={c.id}>
      {c.nome}
    </option>
  );
  if (grupos.length <= 1) return <>{(grupos[0]?.lista ?? []).map(op)}</>;
  return (
    <>
      {grupos.map((g) => (
        <optgroup key={g.rotulo} label={g.rotulo}>
          {g.lista.map(op)}
        </optgroup>
      ))}
    </>
  );
}

/** Texto "Paga em 05/11/2026 · fecha em 28/10/2026 (compras de 29/09 a 28/10)" — o PAGAMENTO vem primeiro, é o que importa para o caixa. */
export function descreverFatura(
  mes: string,
  fechamento: number | null,
  vencimento: number | null,
  curta = false,
): string {
  const d = datasDaFatura(mes, fechamento, vencimento);
  const partes = [
    d.paga ? `Paga em ${dataBR(d.paga)}` : "Vencimento não cadastrado",
    d.fecha
      ? `fecha em ${dataBR(d.fecha)}${d.inicio && !curta ? ` (compras de ${dataBR(d.inicio, true)} a ${dataBR(d.fecha, true)})` : ""}`
      : null,
  ];
  return partes.filter(Boolean).join(" · ");
}

/** Em qual fatura a compra cai: já vem sugerida pelo fechamento e vencimento, mostra QUANDO PAGA, e dá para mudar. */
export function SeletorFatura({
  cartao,
  data,
  valor,
  onChange,
  compacto,
}: {
  cartao: Conta;
  data: string;
  valor: string | null;
  onChange: (mes: string) => void;
  /** dica numa linha só (sem o intervalo das compras) */ compacto?: boolean;
}) {
  const padrao = faturaPadrao(data, cartao.dia_fechamento, cartao.dia_vencimento);
  const atual = valor ?? padrao;
  const opcoes = [
    ...new Set([
      mesAnterior(padrao),
      padrao,
      mesSeguinte(padrao),
      mesSeguinte(mesSeguinte(padrao)),
      atual,
    ]),
  ].sort();
  const rotulo = (m: string) => {
    const d = datasDaFatura(m, cartao.dia_fechamento, cartao.dia_vencimento);
    return `${mesCurto(m)}${d.paga ? ` · paga ${dataBR(d.paga, true)}` : ""}${m === padrao ? " (sugerida)" : ""}`;
  };
  return (
    <Field
      label="Fatura (mês do pagamento)"
      hint={
        cartao.dia_fechamento || cartao.dia_vencimento
          ? descreverFatura(atual, cartao.dia_fechamento, cartao.dia_vencimento, !!compacto)
          : "Cadastre fechamento e vencimento em Configurações › Cartões"
      }
    >
      <Select value={atual} onChange={(e) => onChange(e.target.value)}>
        {opcoes.map((m) => (
          <option key={m} value={m}>
            {rotulo(m)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Valor em reais para tabelas apertadas: no celular o "R$" some (classe .mes-tab__rs) e os números cabem. */
export const rs = (cents: number) => (
  <>
    <span className="mes-tab__rs">R$&nbsp;</span>
    {brl(cents).replace(/^-?R\$[\s\u00a0]*/, cents < 0 ? "-" : "")}
  </>
);
