"use client";

import { ArrowDown, ArrowUp, ArrowsLeftRight, Check } from "@/lib/ui/icons";
import { Badge, brl, cx } from "@/components/financas/kit";
import { dataCurta, mesCurto } from "@/lib/financas/formato";
import { useFinancas, type Lancamento } from "@/lib/financas/dados";

export function useDescricao() {
  const { conta, categoria } = useFinancas();
  return (l: Lancamento) => {
    const origem = conta(l.account_id)?.nome ?? "—";
    if (l.tipo === "transferencia")
      return {
        titulo: `${origem} → ${conta(l.account_destino_id)?.nome ?? "—"}`,
        sub: l.nota ?? "Transferência",
      };
    return {
      titulo: categoria(l.category_id)?.nome ?? "Sem categoria",
      sub: [origem, l.fatura_mes ? `fatura ${mesCurto(l.fatura_mes.slice(0, 7))}` : null, l.nota]
        .filter(Boolean)
        .join(" · "),
    };
  };
}

export function LancamentoItem({
  l,
  mostrarData,
  onAbrir,
  onPagar,
  marcado,
  onMarcar,
}: {
  l: Lancamento;
  mostrarData?: boolean;
  onAbrir: () => void;
  onPagar?: () => void;
  /** modo "editar vários": mostra a caixinha e o clique marca em vez de abrir */ marcado?: boolean;
  onMarcar?: () => void;
}) {
  const descrever = useDescricao();
  const { titulo, sub } = descrever(l);
  const Icone = l.tipo === "entrada" ? ArrowDown : l.tipo === "saida" ? ArrowUp : ArrowsLeftRight;
  const sinal = l.tipo === "entrada" ? "+ " : l.tipo === "saida" ? "− " : "";
  return (
    <li
      className={cx("fi-item", l.status === "cancelado" && "is-cancelado", marcado && "is-marcado")}
    >
      {onMarcar && (
        <input
          type="checkbox"
          className="ano-tab__check sel-check"
          checked={!!marcado}
          onChange={onMarcar}
          aria-label={`Selecionar ${titulo}, ${brl(l.valor_cents)}`}
        />
      )}
      <button
        type="button"
        className="fi-item__open"
        onClick={onMarcar ?? onAbrir}
        aria-label={`Editar ${titulo}, ${brl(l.valor_cents)}`}
      >
        <span className={cx("fi-item__icon", l.tipo === "entrada" && "is-in")} aria-hidden>
          <Icone size={20} weight="bold" />
        </span>
        <span className="fi-item__main">
          <span className="t-body" style={{ fontWeight: 700 }}>
            {titulo}
            {l.parcela_total ? ` ${l.parcela_atual}/${l.parcela_total}` : ""}
          </span>
          <span className="t-body-sm t-muted">
            {mostrarData ? `${dataCurta(l.data)} · ` : ""}
            {sub}
          </span>
        </span>
        <span className="fi-item__lado">
          <span className={cx("fi-item__valor", l.tipo === "entrada" && "is-in")}>
            {sinal}
            {brl(l.valor_cents)}
          </span>
          {l.status === "pendente" && <Badge tone="warning">previsto</Badge>}
          {l.status === "cancelado" && <Badge tone="neutral">cancelado</Badge>}
        </span>
      </button>
      {l.status === "pendente" && onPagar && !onMarcar && (
        <button
          type="button"
          className="fi-btn fi-btn--secondary fi-btn--sm"
          onClick={onPagar}
          aria-label={`Marcar como pago: ${titulo}`}
        >
          <Check size={16} weight="bold" />
          Pagar
        </button>
      )}
    </li>
  );
}
