"use client";

import { lazy, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "@/components/financas/rota";
import { ListMagnifyingGlass } from "@/lib/ui/icons";
import {
  Card,
  EmptyState,
  NavegadorDeMes,
  Input,
  Page,
  Segmented,
  Select,
  Skeleton,
  Stat,
  brl,
  useToast,
} from "@/components/financas/kit";
import {
  atualizarLancamento,
  patchPagar,
  useFinancas,
  useLancamentosDoMes,
  type Lancamento,
  type StatusLancamento,
  type TipoLancamento,
} from "@/lib/financas/dados";
import {
  dataLonga,
  intervaloDoMes,
  mesAnterior,
  mesAtual,
  mesSeguinte,
  mesValido,
  nomeDoMes,
} from "@/lib/financas/formato";
import { LancamentoItem, useDescricao } from "./LancamentoItem";
import { EditarLancamento } from "./EditarLancamento";
import { BarraSelecao, EditarEmMassa } from "./EditarEmMassa";
import { Button } from "@/components/financas/kit";
import { PencilSimple } from "@/lib/ui/icons";

const Massa = lazy(() => import("./Massa").then((m) => ({ default: m.Massa })));

/** Lançamentos tem duas vistas na mesma página: a lista do mês e o lançamento em massa. */
export function Lancamentos() {
  const [params, setParams] = useSearchParams();
  const vista = params.get("vista") === "massa" ? "massa" : "lista";
  return (
    <Page wide>
      <h1 className="t-display">Lançamentos</h1>
      <div className="fi-row seletores-topo" data-testid="seletores-lancamentos">
        <Segmented
          value={vista}
          onChange={(v) => setParams(v === "massa" ? { vista: "massa" } : {}, { replace: true })}
          options={[
            { value: "lista", label: "Lista" },
            { value: "massa", label: "Em massa" },
          ]}
        />
      </div>
      {vista === "massa" ? (
        <Suspense fallback={<p className="t-body t-muted">Carregando a tabela…</p>}>
          <Massa />
        </Suspense>
      ) : (
        <ListaVista />
      )}
    </Page>
  );
}

function ListaVista() {
  const [params, setParams] = useSearchParams();
  const mes = mesValido(params.get("mes")) ? params.get("mes")! : mesAtual();
  const irPara = (m: string) => setParams({ mes: m }, { replace: true });
  const { de, ate } = intervaloDoMes(mes);
  const { carregando, erro, itens, recarregar } = useLancamentosDoMes(de, ate);
  const { contas, categorias } = useFinancas();
  const descrever = useDescricao();
  const toast = useToast();

  const [tipo, setTipo] = useState<"todos" | TipoLancamento>("todos");
  const [status, setStatus] = useState<"todos" | StatusLancamento>("todos");
  const [contaId, setContaId] = useState("");
  const [catId, setCatId] = useState("");
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [selecionando, setSelecionando] = useState(false);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [emMassa, setEmMassa] = useState<Lancamento[] | null>(null);
  const marcar = (id: string) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const sairDaSelecao = () => {
    setSelecionando(false);
    setMarcados(new Set());
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter(
      (l) =>
        (tipo === "todos" || l.tipo === tipo) &&
        (status === "todos" || l.status === status) &&
        (!contaId || l.account_id === contaId || l.account_destino_id === contaId) &&
        (!catId || l.category_id === catId) &&
        (!q || `${descrever(l).titulo} ${l.nota ?? ""}`.toLowerCase().includes(q)),
    );
  }, [itens, tipo, status, contaId, catId, busca, descrever]);

  const soma = (t: TipoLancamento, s: StatusLancamento) =>
    filtrados.filter((l) => l.tipo === t && l.status === s).reduce((a, l) => a + l.valor_cents, 0);
  const grupos = useMemo(() => {
    const m = new Map<string, Lancamento[]>();
    for (const l of filtrados) m.set(l.data, [...(m.get(l.data) ?? []), l]);
    return [...m.entries()];
  }, [filtrados]);

  async function pagar(l: Lancamento) {
    try {
      await atualizarLancamento(l.id, patchPagar(l));
      toast("Marcado como pago");
      recarregar();
    } catch {
      toast("Não consegui marcar como pago");
    }
  }

  return (
    <>
      <div className="fi-row fi-row--wrap seletores-topo" data-testid="seletores-lista">
        <NavegadorDeMes value={mes} onChange={irPara} />
        <Button
          variant={selecionando ? "primary" : "secondary"}
          size="sm"
          icon={<PencilSimple size={16} />}
          aria-pressed={selecionando}
          data-testid="editar-varios"
          onClick={() => (selecionando ? sairDaSelecao() : setSelecionando(true))}
        >
          {selecionando ? "Sair da seleção" : "Editar vários"}
        </Button>
      </div>
      {selecionando && (
        <div className="fi-row fi-row--wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMarcados(new Set(filtrados.map((l) => l.id)))}
          >
            Marcar todos ({filtrados.length})
          </Button>
          <BarraSelecao
            n={marcados.size}
            onEditar={() => setEmMassa(filtrados.filter((l) => marcados.has(l.id)))}
            onLimpar={() => setMarcados(new Set())}
          />
        </div>
      )}

      <div className="fi-grid fi-grid--4">
        <Card>
          <Stat label="Entradas">
            <span
              className="t-money t-h2 t-money--fit"
              style={{ color: "var(--color-success-fg)" }}
            >
              {brl(soma("entrada", "pago"))}
            </span>
            {soma("entrada", "pendente") > 0 && (
              <span className="t-caption t-muted">
                + {brl(soma("entrada", "pendente"))} previstos
              </span>
            )}
          </Stat>
        </Card>
        <Card>
          <Stat label="Saídas">
            <span className="t-money t-h2 t-money--fit">{brl(soma("saida", "pago"))}</span>
            {soma("saida", "pendente") > 0 && (
              <span className="t-caption t-muted">
                + {brl(soma("saida", "pendente"))} previstos
              </span>
            )}
          </Stat>
        </Card>
        <Card>
          <Stat label="Transferências">
            <span className="t-money t-h2 t-money--fit">{brl(soma("transferencia", "pago"))}</span>
            <span className="t-caption t-muted">não contam como entrada nem saída</span>
          </Stat>
        </Card>
        <Card>
          <Stat label="Resultado (pago)">
            <span className="t-money t-h2 t-money--fit">
              {brl(soma("entrada", "pago") - soma("saida", "pago"))}
            </span>
          </Stat>
        </Card>
      </div>

      <Card className="fi-stack">
        <Segmented
          block
          value={tipo}
          onChange={setTipo}
          options={[
            { value: "todos", label: "Todos" },
            { value: "entrada", label: "Entradas" },
            { value: "saida", label: "Saídas" },
            { value: "transferencia", label: "Transf." },
          ]}
        />
        <div className="fi-filtros">
          <Input
            type="search"
            placeholder="Buscar categoria ou anotação"
            aria-label="Buscar"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <Select aria-label="Conta" value={contaId} onChange={(e) => setContaId(e.target.value)}>
            <option value="">Todas as contas</option>
            {contas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          <Select aria-label="Categoria" value={catId} onChange={(e) => setCatId(e.target.value)}>
            <option value="">Todas as categorias</option>
            {categorias
              .filter((c) => c.ativa)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.tipo === "entrada" ? " (entrada)" : ""}
                </option>
              ))}
          </Select>
          <Select
            aria-label="Situação"
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="todos">Todas as situações</option>
            <option value="pago">Pagos</option>
            <option value="pendente">Previstos</option>
            <option value="cancelado">Cancelados</option>
          </Select>
        </div>
      </Card>

      {erro && (
        <p className="fi-error-text" role="alert">
          Erro ao carregar: {erro}
        </p>
      )}
      {carregando ? (
        <Card className="fi-stack">
          <Skeleton h={20} w="50%" />
          <Skeleton h={48} />
          <Skeleton h={48} />
          <Skeleton h={48} />
        </Card>
      ) : grupos.length === 0 ? (
        <Card>
          <EmptyState icon={<ListMagnifyingGlass size={30} />} title="Nenhum lançamento aqui">
            Nada em {nomeDoMes(mes)} com esses filtros. Use "Lançar" no menu para registrar.
          </EmptyState>
        </Card>
      ) : (
        grupos.map(([dia, ls]) => (
          <section key={dia} className="fi-stack" style={{ gap: 8 }} aria-label={dataLonga(dia)}>
            <h2 className="fi-list__title">{dataLonga(dia)}</h2>
            <ul className="fi-list">
              {ls.map((l) => (
                <LancamentoItem
                  key={l.id}
                  l={l}
                  onAbrir={() => setEditando(l)}
                  onPagar={() => void pagar(l)}
                  marcado={marcados.has(l.id)}
                  onMarcar={selecionando ? () => marcar(l.id) : undefined}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <EditarLancamento l={editando} onClose={() => setEditando(null)} onMudou={recarregar} />
      <EditarEmMassa
        itens={emMassa}
        onClose={() => setEmMassa(null)}
        onMudou={() => {
          recarregar();
          sairDaSelecao();
        }}
      />
    </>
  );
}
