"use client";

import { useMemo, useState } from "react";
import { PencilSimple, X } from "@/lib/ui/icons";
import {
  Button,
  Combobox,
  DateField,
  Field,
  Input,
  Segmented,
  Select,
  Sheet,
  brl,
  useToast,
} from "@/components/financas/kit";
import {
  atualizarLancamento,
  excluirLancamento,
  useFinancas,
  type Lancamento,
} from "@/lib/financas/dados";
import { descreverFatura, OpcoesContas } from "./comuns";
import { mesAtual, mesCurto, mesSeguinte } from "@/lib/financas/formato";
import {
  FORM_MASSA_VAZIO,
  patchDaEdicaoEmMassa,
  type FormMassa,
} from "@/lib/financas/mesDoLancamento";

/** Barra que aparece quando há lançamentos marcados (Lista e Visão do mês). */
export function BarraSelecao({
  n,
  onEditar,
  onLimpar,
  onPagar,
}: {
  n: number;
  onEditar: () => void;
  onLimpar: () => void;
  onPagar?: () => void;
}) {
  return (
    <div
      className="sel-barra"
      role="region"
      aria-label="Lançamentos selecionados"
      data-testid="barra-selecao"
    >
      <b>
        {n} {n === 1 ? "selecionado" : "selecionados"}
      </b>
      <Button size="sm" icon={<PencilSimple size={16} />} disabled={n === 0} onClick={onEditar}>
        Editar selecionados
      </Button>
      {onPagar && (
        <Button
          size="sm"
          variant="secondary"
          disabled={n === 0}
          onClick={onPagar}
          data-testid="pagar-selecionados"
        >
          Marcar como pago
        </Button>
      )}
      <Button size="sm" variant="ghost" icon={<X size={16} />} onClick={onLimpar}>
        Limpar
      </Button>
    </div>
  );
}

const LIMITE_PARALELO = 5;
export async function emLotes<T>(
  itens: T[],
  fn: (x: T) => Promise<unknown>,
): Promise<{ ok: number; falhas: string[] }> {
  let ok = 0;
  const falhas: string[] = [];
  for (let i = 0; i < itens.length; i += LIMITE_PARALELO) {
    const r = await Promise.allSettled(itens.slice(i, i + LIMITE_PARALELO).map(fn));
    for (const x of r) {
      if (x.status === "fulfilled") ok++;
      else falhas.push((x.reason as Error).message);
    }
  }
  return { ok, falhas };
}

/** Edita vários lançamentos de uma vez: só muda o que for preenchido; o resto fica como está. */
export function EditarEmMassa({
  itens,
  onClose,
  onMudou,
}: {
  itens: Lancamento[] | null;
  onClose: () => void;
  onMudou: () => void;
}) {
  return (
    <Sheet
      open={!!itens}
      onClose={onClose}
      title={itens ? `Editar ${itens.length} lançamentos` : "Editar lançamentos"}
    >
      {itens && <Formulario itens={itens} onClose={onClose} onMudou={onMudou} />}
    </Sheet>
  );
}

function Formulario({
  itens,
  onClose,
  onMudou,
}: {
  itens: Lancamento[];
  onClose: () => void;
  onMudou: () => void;
}) {
  const { contas, categorias } = useFinancas();
  const toast = useToast();
  const [f, setF] = useState<FormMassa>(FORM_MASSA_VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const set = <K extends keyof FormMassa>(k: K, v: FormMassa[K]) => {
    setF((x) => ({ ...x, [k]: v }));
    setErro(null);
  };

  const contagem = useMemo(
    () => ({
      saida: itens.filter((l) => l.tipo === "saida").length,
      entrada: itens.filter((l) => l.tipo === "entrada").length,
      transf: itens.filter((l) => l.tipo === "transferencia").length,
    }),
    [itens],
  );
  const tiposComCategoria = [
    ...new Set(itens.filter((l) => l.tipo !== "transferencia").map((l) => l.tipo)),
  ];
  const tipoCat =
    tiposComCategoria.length === 1 ? (tiposComCategoria[0] as "entrada" | "saida") : null;
  const cats = tipoCat
    ? categorias.filter((c) => c.tipo === tipoCat && c.ativa && c.grupo !== "Sistema")
    : [];
  const contasUteis = contas.filter((c) => c.ativa && c.tipo !== "bem");
  const semTransf = itens.filter((l) => l.tipo !== "transferencia");
  const contaNova = contas.find((c) => c.id === f.contaId);
  const todosCartao =
    semTransf.length > 0 &&
    (contaNova
      ? contaNova.tipo === "cartao"
      : semTransf.every((l) => contas.find((c) => c.id === l.account_id)?.tipo === "cartao"));
  const mesesFatura = useMemo(() => {
    const m: string[] = [];
    let x = mesAtual();
    for (let i = 0; i < 3; i++) {
      const [a = 0, n = 0] = x.split("-").map(Number);
      x = n === 1 ? `${a - 1}-12` : `${a}-${String(n - 1).padStart(2, "0")}`;
    }
    for (let i = 0; i < 12; i++) {
      m.push(x);
      x = mesSeguinte(x);
    }
    return m;
  }, []);
  const planos = useMemo(
    () => itens.map((l) => ({ l, patch: patchDaEdicaoEmMassa(l, f, contas) })),
    [itens, f, contas],
  );
  const aMudar = planos.filter((p) => p.patch);

  async function aplicar() {
    if (aMudar.length === 0) return setErro("Escolha pelo menos uma coisa para mudar.");
    setOcupado(true);
    setErro(null);
    const r = await emLotes(aMudar, (p) => atualizarLancamento(p.l.id, p.patch!));
    setOcupado(false);
    if (r.ok) {
      onMudou();
      toast(`${r.ok} lançamento${r.ok === 1 ? "" : "s"} atualizado${r.ok === 1 ? "" : "s"}`);
    }
    if (r.falhas.length)
      return setErro(
        `${r.falhas.length} não foram alterados: ${[...new Set(r.falhas)].join("; ")}`,
      );
    onClose();
  }
  async function excluir() {
    setOcupado(true);
    setErro(null);
    const r = await emLotes(itens, (l) => excluirLancamento(l.id));
    setOcupado(false);
    if (r.ok) {
      onMudou();
      toast(`${r.ok} lançamento${r.ok === 1 ? "" : "s"} excluído${r.ok === 1 ? "" : "s"}`);
    }
    if (r.falhas.length)
      return setErro(
        `${r.falhas.length} não foram excluídos: ${[...new Set(r.falhas)].join("; ")}`,
      );
    onClose();
  }

  const total = itens.reduce((a, l) => a + l.valor_cents, 0);
  return (
    <>
      <p className="t-body-sm t-muted" style={{ marginTop: -8 }} data-testid="resumo-massa">
        {[
          contagem.saida && `${contagem.saida} ${contagem.saida === 1 ? "saída" : "saídas"}`,
          contagem.entrada &&
            `${contagem.entrada} ${contagem.entrada === 1 ? "entrada" : "entradas"}`,
          contagem.transf &&
            `${contagem.transf} ${contagem.transf === 1 ? "transferência" : "transferências"}`,
        ]
          .filter(Boolean)
          .join(" · ")}{" "}
        · soma {brl(total)}. Só muda o que você preencher; o resto fica como está.
      </p>
      <Field label="Situação">
        <Segmented
          block
          value={f.status || "manter"}
          onChange={(v) => set("status", v === "manter" ? "" : v)}
          options={[
            { value: "manter", label: "Manter" },
            { value: "pendente", label: "Previsto" },
            { value: "pago", label: "Pago" },
            { value: "cancelado", label: "Cancelado" },
          ]}
        />
      </Field>
      <Field
        label="Categoria"
        hint={
          tipoCat
            ? undefined
            : contagem.transf === itens.length
              ? "Transferências não têm categoria."
              : "Para mudar a categoria, selecione só saídas ou só entradas."
        }
      >
        <Combobox
          value={f.categoriaId}
          onChange={(e) => set("categoriaId", e.target.value)}
          opcoes={cats.map((c) => ({ value: c.id, label: c.nome, sub: c.grupo ?? undefined }))}
          placeholder={tipoCat ? "Manter (ou buscar categoria…)" : "Indisponível"}
          vazio="Nenhuma categoria com esse nome"
          disabled={!tipoCat}
        />
      </Field>
      <Field label="Conta">
        <Select value={f.contaId} onChange={(e) => set("contaId", e.target.value)}>
          <option value="">Manter</option>
          <OpcoesContas contas={contasUteis} />
        </Select>
      </Field>
      {todosCartao && (
        <Field
          label="Fatura (mês do pagamento)"
          hint={
            contaNova
              ? descreverFatura(
                  f.faturaMes || mesAtual(),
                  contaNova.dia_fechamento,
                  contaNova.dia_vencimento,
                  true,
                )
              : undefined
          }
        >
          <Select value={f.faturaMes} onChange={(e) => set("faturaMes", e.target.value)}>
            <option value="">{contaNova || f.data ? "Calcular pela data" : "Manter"}</option>
            {mesesFatura.map((m) => (
              <option key={m} value={m}>
                {mesCurto(m)}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Data" hint="Vale para todos. Compras no cartão têm a fatura recalculada.">
        <div className="fi-row">
          <DateField value={f.data} onChange={(e) => set("data", e.target.value)} />
          {f.data && (
            <Button variant="ghost" size="sm" onClick={() => set("data", "")}>
              Manter
            </Button>
          )}
        </div>
      </Field>
      <Field
        label="Anotação"
        hint={f.limparNota ? "As anotações serão apagadas." : "Substitui a anotação de todos."}
      >
        <Input
          value={f.nota}
          disabled={f.limparNota}
          onChange={(e) => set("nota", e.target.value)}
          placeholder="Manter"
        />
      </Field>
      <label className="ano-comp__ant">
        <input
          type="checkbox"
          checked={f.limparNota}
          onChange={(e) => set("limparNota", e.target.checked)}
        />{" "}
        Apagar as anotações
      </label>
      {erro && (
        <p className="fi-error-text" role="alert">
          {erro}
        </p>
      )}
      <Button
        size="lg"
        block
        loading={ocupado}
        disabled={aMudar.length === 0}
        onClick={() => void aplicar()}
        data-testid="aplicar-massa"
      >
        {aMudar.length === 0
          ? "Nada para mudar ainda"
          : `Aplicar em ${aMudar.length} ${aMudar.length === 1 ? "lançamento" : "lançamentos"}`}
      </Button>
      {aMudar.length > 0 && aMudar.length < itens.length && (
        <p className="t-caption t-muted">
          {itens.length - aMudar.length} já estão assim (ou não se aplicam) e ficam como estão.
        </p>
      )}
      <div className="fi-row fi-row--between">
        <span />
        {confirmaExcluir ? (
          <Button variant="danger" disabled={ocupado} onClick={() => void excluir()}>
            Confirmar: excluir {itens.length}
          </Button>
        ) : (
          <Button variant="ghost" disabled={ocupado} onClick={() => setConfirmaExcluir(true)}>
            Excluir selecionados
          </Button>
        )}
      </div>
    </>
  );
}
