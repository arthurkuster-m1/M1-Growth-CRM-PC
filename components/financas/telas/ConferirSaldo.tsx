"use client";

import { useState } from "react";
import {
  Button,
  Field,
  Segmented,
  Sheet,
  ValorInput,
  brl,
  useToast,
} from "@/components/financas/kit";
import { registrarConferencia, type Conta, type DestinoConferencia } from "@/lib/financas/dados";

/** "Bate com o banco?": a pessoa digita o saldo real; a diferença vira rendimento ou ajuste (ou só fica registrada). */
export function ConferirSaldo({
  conta,
  saldoSistema,
  onClose,
  onFeito,
}: {
  conta: Conta | null;
  saldoSistema: number;
  onClose: () => void;
  onFeito: () => void;
}) {
  return (
    <Sheet open={!!conta} onClose={onClose} title="Conferir saldo">
      {conta && (
        <Formulario
          key={conta.id}
          conta={conta}
          saldoSistema={saldoSistema}
          onClose={onClose}
          onFeito={onFeito}
        />
      )}
    </Sheet>
  );
}

function Formulario({
  conta,
  saldoSistema,
  onClose,
  onFeito,
}: {
  conta: Conta;
  saldoSistema: number;
  onClose: () => void;
  onFeito: () => void;
}) {
  const toast = useToast();
  const [real, setReal] = useState(Math.max(saldoSistema, 0));
  const [destino, setDestino] = useState<DestinoConferencia>(
    conta.tipo === "investida" ? "rendimento" : "ajuste",
  );
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const dif = real - saldoSistema;

  async function confirmar() {
    setOcupado(true);
    setErro(null);
    try {
      await registrarConferencia({ contaId: conta.id, saldoSistema, saldoReal: real, destino });
      toast(
        dif === 0
          ? "Saldo confere"
          : destino === "ignorar"
            ? "Conferência registrada"
            : "Diferença lançada",
      );
      onFeito();
      onClose();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <p className="t-body">
        <b>{conta.nome}</b>: o app calcula <b className="t-money">{brl(saldoSistema)}</b>. Quanto o
        banco mostra agora?
      </p>
      <Field label="Saldo no banco">
        <ValorInput value={real} onChange={setReal} />
      </Field>
      <p
        className="t-body"
        data-testid="diferenca"
        style={{
          color:
            dif === 0
              ? "var(--color-success-fg)"
              : dif > 0
                ? "var(--color-success-fg)"
                : "var(--color-error-fg)",
          fontWeight: 700,
        }}
      >
        {dif === 0
          ? "Bate certinho."
          : `Diferença: ${dif > 0 ? "+" : "−"} ${brl(Math.abs(dif))} ${dif > 0 ? "a mais no banco" : "a menos no banco"}`}
      </p>
      {dif !== 0 && (
        <div className="fi-field">
          <span className="fi-label">O que fazer com a diferença?</span>
          <Segmented
            block
            value={destino}
            onChange={setDestino}
            options={[
              { value: "rendimento", label: "Rendimento" },
              { value: "ajuste", label: "Ajuste" },
              { value: "ignorar", label: "Ignorar" },
            ]}
          />
          <span className="fi-hint">
            {destino === "rendimento"
              ? dif > 0
                ? "Entra como entrada na categoria Rendimentos."
                : "Diferença negativa não é rendimento: entra como Ajuste de saldo."
              : destino === "ajuste"
                ? "Entra como Ajuste de saldo, fora dos gastos e das entradas do mês."
                : "Só guarda o registro; o saldo do app não muda."}
          </span>
        </div>
      )}
      {erro && (
        <p className="fi-error-text" role="alert">
          {erro}
        </p>
      )}
      <Button size="lg" block loading={ocupado} onClick={() => void confirmar()}>
        {dif === 0 ? "Registrar conferência" : "Registrar"}
      </Button>
    </>
  );
}
