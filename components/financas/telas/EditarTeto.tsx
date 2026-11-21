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
import {
  removerMetaDoMes,
  removerTetoDoMes,
  salvarMetaDoMes,
  salvarMetaPadrao,
  salvarTetoDoMes,
  salvarTetoPadrao,
} from "@/lib/financas/dados";
import { nomeDoMes } from "@/lib/financas/formato";
import type { TetoResolvido } from "@/lib/financas/teto";

/** Teto de gastos do mês: valor fixo para todos os meses (padrão) ou só para este mês. */
export function EditarTeto({
  tipo = "teto",
  mes,
  atual,
  tetoPadrao,
  aberto,
  onClose,
  onSalvo,
}: {
  tipo?: "teto" | "meta";
  mes: string;
  atual: TetoResolvido;
  tetoPadrao: number;
  aberto: boolean;
  onClose: () => void;
  onSalvo: () => void;
}) {
  return (
    <Sheet
      open={aberto}
      onClose={onClose}
      title={`${tipo === "meta" ? "Meta de ganhos" : "Teto"} de ${nomeDoMes(mes)}`}
    >
      {aberto && (
        <Formulario
          key={`${tipo}-${mes}`}
          tipo={tipo}
          mes={mes}
          atual={atual}
          tetoPadrao={tetoPadrao}
          onClose={onClose}
          onSalvo={onSalvo}
        />
      )}
    </Sheet>
  );
}

function Formulario({
  tipo,
  mes,
  atual,
  tetoPadrao,
  onClose,
  onSalvo,
}: {
  tipo: "teto" | "meta";
  mes: string;
  atual: TetoResolvido;
  tetoPadrao: number;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const toast = useToast();
  const M = tipo === "meta";
  const rot = M ? "Meta do mês" : "Teto do mês";
  const salvarPadrao = M ? salvarMetaPadrao : salvarTetoPadrao,
    salvarMes = M ? salvarMetaDoMes : salvarTetoDoMes,
    removerMes = M ? removerMetaDoMes : removerTetoDoMes;
  const [valor, setValor] = useState(atual.valor);
  const [escopo, setEscopo] = useState<"mes" | "todos">(
    atual.origem === "nenhum" ? "todos" : atual.origem === "mes" ? "mes" : "mes",
  );
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function executar(fn: () => Promise<void>, msg: string) {
    setOcupado(true);
    setErro(null);
    try {
      await fn();
      toast(msg);
      onSalvo();
      onClose();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <>
      <p className="t-body-sm t-muted" style={{ marginTop: -8 }}>
        {M
          ? "Quanto você quer ganhar, no mínimo, no mês — um valor fixo."
          : "Quanto você quer gastar, no máximo, no mês — um valor fixo."}{" "}
        {tetoPadrao > 0 ? (
          <>
            Hoje o padrão é <b>{brl(tetoPadrao)}</b>.
          </>
        ) : (
          "Ainda não há um padrão."
        )}
      </p>
      <Field label={rot}>
        <ValorInput value={valor} onChange={setValor} data-testid="valor-teto" />
      </Field>
      <Field label="Vale para">
        <Segmented
          block
          value={escopo}
          onChange={setEscopo}
          options={[
            { value: "mes", label: `Só ${nomeDoMes(mes).split(" de ")[0]}` },
            { value: "todos", label: "Todos os meses" },
          ]}
        />
      </Field>
      <p className="t-caption t-muted">
        {escopo === "todos"
          ? "Vira o padrão de todos os meses (exceto os que tiverem um valor próprio)."
          : "Só este mês muda; os outros seguem o padrão."}
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
        disabled={valor <= 0}
        data-testid="salvar-teto"
        onClick={() =>
          void executar(
            () => (escopo === "todos" ? salvarPadrao(valor) : salvarMes(mes, valor)),
            escopo === "todos"
              ? M
                ? "Meta padrão salva"
                : "Teto padrão salvo"
              : M
                ? "Meta do mês salva"
                : "Teto do mês salvo",
          )
        }
      >
        Salvar
      </Button>
      {atual.origem === "mes" && (
        <Button
          variant="ghost"
          disabled={ocupado}
          onClick={() => void executar(() => removerMes(mes), "Este mês voltou ao padrão")}
        >
          Voltar ao padrão neste mês
        </Button>
      )}
    </>
  );
}
