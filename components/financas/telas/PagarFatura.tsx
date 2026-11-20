"use client";

import { useState } from "react";
import {
  Button,
  DateField,
  Field,
  Select,
  Sheet,
  ValorInput,
  brl,
} from "@/components/financas/kit";
import { ERRO_PAGO_FUTURO, criarLancamento, useFinancas } from "@/lib/financas/dados";
import type { FaturaDoCartao } from "@/lib/financas/faturas";
import { dataBR, hoje, mesCurto } from "@/lib/financas/formato";
import { OpcoesContas } from "./comuns";

/** Data em que o pagamento cai: o vencimento da fatura; sem vencimento cadastrado, hoje (se for o mês) ou dentro do mês da fatura. */
export const dataDoPagamento = (f: FaturaDoCartao, hojeISO = hoje()) =>
  f.paga ?? (hojeISO.startsWith(f.mes) ? hojeISO : `${f.mes}-28`);

/** "Pagar fatura": cria a TRANSFERÊNCIA da conta de pagamento para o cartão, na data do pagamento e no valor que falta. */
export function PagarFatura({
  fatura,
  onClose,
  onFeito,
}: {
  fatura: FaturaDoCartao | null;
  onClose: () => void;
  onFeito: () => void;
}) {
  return (
    <Sheet open={!!fatura} onClose={onClose} title="Pagar fatura">
      {fatura && (
        <Formulario
          key={`${fatura.cartao.id}-${fatura.mes}`}
          f={fatura}
          onClose={onClose}
          onFeito={onFeito}
        />
      )}
    </Sheet>
  );
}

function Formulario({
  f,
  onClose,
  onFeito,
}: {
  f: FaturaDoCartao;
  onClose: () => void;
  onFeito: () => void;
}) {
  const { contas } = useFinancas();
  const origens = contas.filter((c) => c.ativa && c.tipo !== "cartao" && c.tipo !== "bem");
  const [valor, setValor] = useState(f.restante);
  const [data, setData] = useState(() => dataDoPagamento(f));
  const [origem, setOrigem] = useState(() =>
    f.cartao.conta_pagamento_id && origens.some((c) => c.id === f.cartao.conta_pagamento_id)
      ? f.cartao.conta_pagamento_id
      : (origens.find((c) => c.tipo === "corrente")?.id ?? origens[0]?.id ?? ""),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const futuro = data > hoje();
  const foraDoMes = data.slice(0, 7) !== f.mes;

  async function confirmar() {
    if (valor <= 0) return setErro("Informe um valor maior que zero.");
    if (!origem) return setErro("Escolha a conta de onde sai o pagamento.");
    setOcupado(true);
    setErro(null);
    try {
      await criarLancamento({
        tipo: "transferencia",
        valor_cents: valor,
        data,
        status: futuro ? "pendente" : "pago",
        nota: `Fatura ${f.cartao.nome} ${mesCurto(f.mes)}`,
        account_id: origem,
        account_destino_id: f.cartao.id,
        category_id: null,
        fatura_mes: null,
      });
      onFeito();
      onClose();
    } catch (e) {
      const m = (e as Error).message;
      setErro(m === ERRO_PAGO_FUTURO ? ERRO_PAGO_FUTURO : m);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <p className="t-body-sm t-muted" style={{ marginTop: -8 }}>
        {f.cartao.nome} · fatura {mesCurto(f.mes)} · total {brl(f.total)}
        {f.jaPaga > 0 ? ` · já pago ${brl(f.jaPaga)}` : ""}
      </p>
      <Field label="Valor do pagamento">
        <ValorInput value={valor} onChange={setValor} />
      </Field>
      <Field label="Sai de">
        <Select value={origem} onChange={(e) => setOrigem(e.target.value)}>
          <OpcoesContas contas={origens} />
        </Select>
      </Field>
      <Field
        label="Data do pagamento"
        hint={
          f.paga
            ? `Vencimento da fatura: ${dataBR(f.paga)}.`
            : "O cartão não tem vencimento cadastrado."
        }
      >
        <DateField value={data} onChange={(e) => setData(e.target.value)} />
      </Field>
      {foraDoMes && (
        <p className="t-body-sm" style={{ color: "var(--color-error-fg)" }}>
          Essa data é de outro mês: o pagamento não vai abater esta fatura ({mesCurto(f.mes)}).
        </p>
      )}
      <p className="t-body-sm t-muted" data-testid="resumo-pagar-fatura">
        Cria uma transferência de {brl(valor)} em {dataBR(data)}
        {futuro ? " (fica como previsto até a data chegar)" : ""}.
      </p>
      {erro && (
        <p className="fi-error-text" role="alert">
          {erro}
        </p>
      )}
      <Button
        size="lg"
        block
        loading={ocupado}
        onClick={() => void confirmar()}
        data-testid="confirmar-pagar-fatura"
      >
        Pagar fatura
      </Button>
    </>
  );
}
