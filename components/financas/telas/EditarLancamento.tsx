"use client";

import { useState } from "react";
import { faturaPadrao, hoje } from "@/lib/financas/formato";
import { OpcoesContas, SeletorFatura } from "./comuns";
import { CriarCategoriaSheet } from "./FormCategoria";
import {
  Button,
  Combobox,
  Field,
  DateField,
  Input,
  Segmented,
  Select,
  Sheet,
  ValorInput,
  brl,
} from "@/components/financas/kit";
import {
  ERRO_PAGO_FUTURO,
  atualizarLancamento,
  excluirLancamento,
  useFinancas,
  type Lancamento,
  type StatusLancamento,
} from "@/lib/financas/dados";

/** Edita TUDO de um lançamento: valor, data, categoria, conta, status e nota. Tipo é fixo (para mudar, exclua e lance de novo). */
export function EditarLancamento({
  l,
  onClose,
  onMudou,
}: {
  l: Lancamento | null;
  onClose: () => void;
  onMudou: () => void;
}) {
  return (
    <Sheet open={!!l} onClose={onClose} title="Editar lançamento">
      {l && <Formulario key={l.id} l={l} onClose={onClose} onMudou={onMudou} />}
    </Sheet>
  );
}

function Formulario({
  l,
  onClose,
  onMudou,
}: {
  l: Lancamento;
  onClose: () => void;
  onMudou: () => void;
}) {
  const { contas, categorias } = useFinancas();
  const [valor, setValor] = useState(l.valor_cents);
  const [data, setData] = useState(l.data);
  const [status, setStatus] = useState<StatusLancamento>(l.status);
  const [nota, setNota] = useState(l.nota ?? "");
  const [cat, setCat] = useState(l.category_id);
  const [conta, setConta] = useState(l.account_id ?? "");
  const [destino, setDestino] = useState(l.account_destino_id ?? "");
  const [fatura, setFatura] = useState<string | null>(
    l.fatura_mes ? l.fatura_mes.slice(0, 7) : null,
  );
  const [criandoCat, setCriandoCat] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);

  const transf = l.tipo === "transferencia";
  const cats = categorias.filter((c) => c.tipo === l.tipo && (c.ativa || c.id === l.category_id));
  const contasUteis = contas.filter((c) => c.tipo !== "bem" && (c.ativa || c.id === l.account_id));
  const contaSel = contas.find((c) => c.id === conta);
  const ehCartao = !transf && contaSel?.tipo === "cartao";

  async function executar(fn: () => Promise<unknown>) {
    setOcupado(true);
    setErro(null);
    try {
      await fn();
      onMudou();
      onClose();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  function salvar() {
    if (valor <= 0) return setErro("Informe um valor maior que zero.");
    if (status === "pago" && data > hoje()) return setErro(ERRO_PAGO_FUTURO);
    if (!transf && !cat) return setErro("Escolha a categoria.");
    if (transf && (!conta || !destino || conta === destino))
      return setErro("Escolha duas contas diferentes.");
    void executar(() =>
      atualizarLancamento(l.id, {
        valor_cents: valor,
        data,
        status,
        nota: nota.trim() || null,
        ...(transf
          ? { account_id: conta, account_destino_id: destino }
          : {
              category_id: cat,
              account_id: conta,
              fatura_mes:
                ehCartao && contaSel
                  ? `${fatura ?? faturaPadrao(data, contaSel.dia_fechamento, contaSel.dia_vencimento)}-01`
                  : null,
            }),
      }),
    );
  }

  // Enter em qualquer campo de texto salva (a lista de categoria e a de contas usam o Enter para escolher a opção)
  const aoTeclar = (e: React.KeyboardEvent) => {
    if (
      e.key !== "Enter" ||
      e.defaultPrevented ||
      e.shiftKey ||
      ocupado ||
      !(e.target instanceof HTMLInputElement)
    )
      return;
    e.preventDefault();
    salvar();
  };
  return (
    <div style={{ display: "contents" }} onKeyDown={aoTeclar}>
      <p className="t-body-sm t-muted" style={{ marginTop: -8 }}>
        {l.tipo === "entrada" ? "Entrada" : l.tipo === "saida" ? "Saída" : "Transferência"} · era{" "}
        {brl(l.valor_cents)}
      </p>
      <Field label="Valor">
        <ValorInput value={valor} onChange={setValor} />
      </Field>
      <Segmented
        block
        value={status}
        onChange={(s) => {
          setStatus(s);
          if (s === "pago" && data > hoje()) setData(hoje());
        }}
        options={[
          { value: "pendente", label: "Previsto" },
          { value: "pago", label: "Pago" },
          { value: "cancelado", label: "Cancelado" },
        ]}
      />
      <Field label="Data">
        <DateField value={data} onChange={(e) => setData(e.target.value)} />
      </Field>
      {!transf && (
        <Field label="Categoria">
          <Combobox
            value={cat ?? ""}
            onChange={(e) => setCat(e.target.value || null)}
            opcoes={cats.map((c) => ({ value: c.id, label: c.nome, sub: c.grupo ?? undefined }))}
            placeholder="Buscar categoria…"
            vazio="Nenhuma categoria com esse nome"
            onCriar={setCriandoCat}
            rotuloCriar="Criar categoria"
          />
        </Field>
      )}
      <Field label={transf ? "De" : "Conta"}>
        <Select
          value={conta}
          onChange={(e) => {
            setConta(e.target.value);
            setFatura(null);
          }}
        >
          <OpcoesContas contas={contasUteis} />
        </Select>
      </Field>
      {ehCartao && contaSel && (
        <SeletorFatura cartao={contaSel} data={data} valor={fatura} onChange={setFatura} />
      )}
      {transf && (
        <Field label="Para">
          <Select value={destino} onChange={(e) => setDestino(e.target.value)}>
            <OpcoesContas contas={contasUteis} />
          </Select>
        </Field>
      )}
      <Field label="Anotação">
        <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="O que foi?" />
      </Field>
      {erro && (
        <p className="fi-error-text" role="alert">
          {erro}
        </p>
      )}
      <Button size="lg" block loading={ocupado} onClick={salvar}>
        Salvar
      </Button>
      <div className="fi-row fi-row--between">
        {status !== "cancelado" ? (
          <Button
            variant="ghost"
            disabled={ocupado}
            onClick={() => void executar(() => atualizarLancamento(l.id, { status: "cancelado" }))}
          >
            Cancelar lançamento
          </Button>
        ) : (
          <span />
        )}
        {confirmaExcluir ? (
          <Button
            variant="danger"
            disabled={ocupado}
            onClick={() => void executar(() => excluirLancamento(l.id))}
          >
            Confirmar exclusão
          </Button>
        ) : (
          <Button variant="ghost" disabled={ocupado} onClick={() => setConfirmaExcluir(true)}>
            Excluir
          </Button>
        )}
      </div>
      <CriarCategoriaSheet
        aberto={criandoCat !== null}
        nome={criandoCat ?? ""}
        tipo={l.tipo === "entrada" ? "entrada" : "saida"}
        onClose={() => setCriandoCat(null)}
        onCriada={(c) => setCat(c.id)}
      />
    </div>
  );
}
