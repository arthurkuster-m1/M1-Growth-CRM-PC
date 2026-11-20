"use client";

import { useEffect, useState } from "react";
import { Link } from "@/components/financas/rota";
import { Bell, CaretDown, CaretUp, CreditCard, Gauge, WarningCircle } from "@/lib/ui/icons";
import { brl } from "@/components/financas/kit";
import type { Alerta } from "@/lib/financas/mes";
import { dataBR } from "@/lib/financas/formato";

const MAX_NO_PC = 6,
  MAX_NO_CELULAR = 4;
/** Quantas linhas cada seção mostra de início: 4 no celular (tela estreita), 6 no PC. */
function useMaxLinhas() {
  const consulta = "(max-width: 640px)";
  const [celular, setCelular] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia(consulta).matches
      : false,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia(consulta),
      f = () => setCelular(m.matches);
    f();
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return celular ? MAX_NO_CELULAR : MAX_NO_PC;
}
type Escopo = { base: "mês" | "ano"; valor: number; uso?: number; para?: string };
type Categoria = { nome: string; escopos: Escopo[]; pior: number; uso: number };

/** Junta o alerta do mês e o do ano da MESMA categoria numa linha só (ex.: Casa: mês +R$ 675 · ano +R$ 646), do maior estouro para o menor. */
function porCategoria(lista: Alerta[]): Categoria[] {
  const m = new Map<string, Categoria>();
  for (const a of lista) {
    const nome = a.nome ?? a.texto;
    const c = m.get(nome) ?? { nome, escopos: [], pior: 0, uso: 0 };
    c.escopos.push({ base: a.base ?? "mês", valor: a.valor ?? 0, uso: a.uso, para: a.para });
    c.pior = Math.max(c.pior, Math.abs(a.valor ?? 0));
    c.uso = Math.max(c.uso, a.uso ?? 0);
    m.set(nome, c);
  }
  return [...m.values()].sort((x, y) => y.pior - x.pior);
}

/**
 * Quadro de alertas visual: contadores no topo e, embaixo, só as seções que têm algo — Faturas a pagar, Passou do orçamento, Perto do limite.
 * Cada categoria é UMA linha (mês e ano juntos) com barra de uso; mostra as 6 maiores e o resto fica em "ver todas".
 */
export function AlertasMes({ alertas }: { alertas: Alerta[] }) {
  const [todas, setTodas] = useState<Set<string>>(new Set());
  const [aberto, setAberto] = useState(false);
  const maxLinhas = useMaxLinhas();
  if (alertas.length === 0) return null;
  const de = (g: Alerta["grupo"]) => alertas.filter((a) => a.grupo === g);
  // "passou" com R$ 0,00 de estouro = bateu exatamente no teto: é "no limite", não estouro
  const estouro = de("passou").filter((a) => (a.valor ?? 0) > 0);
  const noLimite = de("passou")
    .filter((a) => (a.valor ?? 0) <= 0)
    .map((a) => ({ ...a, valor: 0 }));
  const passou = porCategoria(estouro);
  const perto = porCategoria([...de("proximo"), ...noLimite]);
  const faturas = de("falta_pagar");
  const outros = [...de("atrasados"), ...de("aviso")];
  const alternar = (k: string) =>
    setTodas((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const linhas = ({ k, itens, tom }: { k: string; itens: Categoria[]; tom: "erro" | "aviso" }) => {
    const abertas = todas.has(k),
      vis = abertas ? itens : itens.slice(0, maxLinhas);
    return (
      <>
        <ul className="alr-lista">
          {vis.map((c) => (
            <li key={c.nome} className={`alr-linha is-${tom}`} data-testid={`alerta-${c.nome}`}>
              <span className="alr-nome">{c.nome}</span>
              <span className="alr-chips">
                {c.escopos.map((e) => (
                  <span key={e.base} className={`alr-chip is-${tom}`}>
                    <span className="alr-chip__base">{e.base === "ano" ? "Ano" : "Mês"}</span>
                    {tom === "erro" ? (
                      <>+ {brl(e.valor)}</>
                    ) : e.valor > 0 ? (
                      <>resta {brl(e.valor)}</>
                    ) : (
                      <>no limite</>
                    )}
                  </span>
                ))}
              </span>
              {c.uso > 0 && (
                <span
                  className="alr-barra"
                  role="img"
                  aria-label={`${Math.round(c.uso * 100)}% do orçamento usado`}
                >
                  <span className="alr-trilho">
                    <span style={{ width: `${Math.min(c.uso, 1) * 100}%` }} />
                  </span>
                  <b>{Math.round(c.uso * 100)}%</b>
                </span>
              )}
            </li>
          ))}
        </ul>
        {itens.length > maxLinhas && (
          <button type="button" className="alr-mais" onClick={() => alternar(k)}>
            {abertas ? "Mostrar só as maiores" : `Ver todas (${itens.length})`}
          </button>
        )}
      </>
    );
  };

  return (
    <section
      className={`fi-card alr${aberto ? "" : "alr--fechado"}`}
      aria-label="Alertas"
      data-testid="alertas"
    >
      <button
        type="button"
        className="alr-topo alr-toggle"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        data-testid="alertas-toggle"
      >
        <span className="alr-toggle__nome">
          <Bell size={16} weight="duotone" aria-hidden />
          Alertas
        </span>
        <div className="alr-resumo" data-testid="alertas-resumo">
          {faturas.length > 0 && (
            <span className="alr-chip is-erro">
              <CreditCard size={14} weight="bold" aria-hidden />
              {faturas.length} {faturas.length === 1 ? "fatura a pagar" : "faturas a pagar"}
            </span>
          )}
          {passou.length > 0 && (
            <span className="alr-chip is-erro">
              <WarningCircle size={14} weight="bold" aria-hidden />
              {passou.length} {passou.length === 1 ? "passou" : "passaram"} do orçamento
            </span>
          )}
          {perto.length > 0 && (
            <span className="alr-chip is-aviso">
              <Gauge size={14} weight="bold" aria-hidden />
              {perto.length} perto do limite
            </span>
          )}
        </div>
        <span className="alr-toggle__seta" aria-hidden>
          {aberto ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
        </span>
      </button>
      {aberto && (faturas.length > 0 || passou.length > 0 || perto.length > 0) && (
        <div className="alr-secoes">
          {(faturas.length > 0 || passou.length > 0) && (
            <div className="alr-secao" data-testid="alertas-cuidado">
              {faturas.length > 0 && (
                <div data-testid="alertas-faturas">
                  <h3 className="alr-titulo is-erro">
                    <CreditCard size={16} weight="duotone" aria-hidden />
                    Faturas a pagar
                  </h3>
                  <ul className="alr-lista">
                    {faturas.map((a) => (
                      <li key={a.id} className="alr-linha is-erro alr-linha--fatura">
                        <Link to={a.para ?? "#"} className="alr-nome">
                          Fatura {a.nome}
                        </Link>
                        <span className={a.vencida ? "alr-chip is-erro" : "alr-chip"}>
                          {a.vence
                            ? `${a.vencida ? "venceu" : "vence"} ${dataBR(a.vence, true)}`
                            : "sem vencimento"}
                        </span>
                        <b className="t-money alr-valor">{brl(a.valor ?? 0)}</b>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {passou.length > 0 && (
                <div data-testid="alertas-passou">
                  <h3 className="alr-titulo is-erro">
                    <WarningCircle size={16} weight="duotone" aria-hidden />
                    Passou do orçamento <span className="t-muted">({passou.length})</span>
                  </h3>
                  {linhas({ k: "passou", itens: passou, tom: "erro" })}
                </div>
              )}
            </div>
          )}
          {perto.length > 0 && (
            <div className="alr-secao" data-testid="alertas-atencao">
              <div>
                <h3 className="alr-titulo is-aviso">
                  <Gauge size={16} weight="duotone" aria-hidden />
                  Perto do limite <span className="t-muted">({perto.length})</span>
                </h3>
                {linhas({ k: "perto", itens: perto, tom: "aviso" })}
              </div>
            </div>
          )}
        </div>
      )}
      {aberto && outros.length > 0 && (
        <ul className="alr-outros">
          {outros.map((a) => (
            <li key={a.id}>{a.para ? <Link to={a.para}>{a.texto}</Link> : a.texto}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
