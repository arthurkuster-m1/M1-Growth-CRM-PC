"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useMensagensDaIA } from "@/hooks/campanhas/useMensagensDaIA";
import { useT } from "@/hooks/i18n/useT";
import type { ItemDaRevisao } from "@/lib/campanhas/mensagens-da-ia";
import type { StatusDaCampanha } from "@/lib/campanhas/tipos";
import { Sparkle } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const BOTAO =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50";
const BOTAO_CHEIO =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";
const AMOSTRA = 5;

const reais = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function CartaoDaMensagem({
  item,
  podeEditar,
  ocupado,
  aoEditar,
  aoRegerar,
  aoTirar,
}: {
  item: ItemDaRevisao;
  podeEditar: boolean;
  ocupado: boolean;
  aoEditar: (corpo: string) => void;
  aoRegerar: () => void;
  aoTirar: () => void;
}) {
  const t = useT();
  const [texto, setTexto] = useState(item.corpo);
  const [versao, setVersao] = useState(item.corpo);
  if (item.corpo !== versao) {
    setVersao(item.corpo);
    setTexto(item.corpo);
  }
  const rotuloDoStatus =
    item.status === "gerada"
      ? t("Escrita pela IA")
      : item.status === "editada"
        ? t("Editada por você")
        : item.status === "falhou"
          ? t("A IA falhou")
          : t("Ainda sem mensagem");
  return (
    <article className="grid gap-2 rounded-2xl border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{item.nome}</p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            item.status === "falhou" ? "bg-error/10 text-error-fg" : "bg-secondary",
          )}
        >
          {rotuloDoStatus}
        </span>
      </div>
      {item.status === "falhou" ? (
        <p className="text-xs text-error-fg">{item.erro ?? t("Erro ao escrever a mensagem.")}</p>
      ) : null}
      <textarea
        rows={4}
        maxLength={1000}
        disabled={!podeEditar || ocupado || item.status === "pendente" || item.status === "falhou"}
        aria-label={`${t("Mensagem para")} ${item.nome}`}
        className="w-full rounded-xl border bg-card px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => texto.trim() !== item.corpo.trim() && texto.trim() && aoEditar(texto)}
      />
      {podeEditar ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BOTAO} disabled={ocupado} onClick={aoRegerar}>
            {item.status === "pendente" || item.status === "falhou"
              ? t("Gerar")
              : t("Escrever de novo")}
          </button>
          <button type="button" className={BOTAO} disabled={ocupado} onClick={aoTirar}>
            {t("Tirar da lista")}
          </button>
        </div>
      ) : null}
    </article>
  );
}

/**
 * As MENSAGENS DA IA do disparo: a abertura da abordagem escrita pela IA para cada lead. A pessoa
 * vê uma amostra (ou todas), edita, escreve de novo, tira um lead da lista e APROVA — sem a
 * aprovação o disparo não inicia. Nada é enviado por aqui.
 */
export function MensagensDaIA({
  campanhaId,
  status,
  podeEditar,
}: {
  campanhaId: string;
  status: StatusDaCampanha;
  podeEditar: boolean;
}) {
  const t = useT();
  const { revisao, carregando, gerar, editar, aprovar } = useMensagensDaIA(campanhaId, true);
  const [verTodas, setVerTodas] = useState(false);
  if (carregando || !revisao || !revisao.precisa_ia) return null;

  const preparado = status === "ready";
  const ocupado = gerar.isPending || editar.isPending || aprovar.isPending;
  const r = revisao;
  const todasPendentes = r.itens.length > 0 && r.itens.every((i) => i.status === "pendente");
  const acimaDoTeto = r.elegiveis > r.teto;
  const itens = verTodas ? r.itens : r.itens.slice(0, AMOSTRA);
  const pronta = r.resumo.pendentes === 0 && r.resumo.falhas === 0 && r.itens.length > 0;
  const aprovadaEm = r.aprovada_em ? new Date(r.aprovada_em).toLocaleString("pt-BR") : null;

  return (
    <section className="space-y-3 rounded-2xl border border-primary/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkle size={18} aria-hidden />
          {t("Mensagens da IA")}
        </h2>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            aprovadaEm ? "bg-emerald-500/10 text-emerald-700" : "bg-secondary",
          )}
        >
          {aprovadaEm ? `${t("Aprovadas em")} ${aprovadaEm}` : t("Falta aprovar")}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {t(
          "A IA escreve a primeira mensagem de cada lead a partir da ideia central da abordagem. Revise, edite se quiser e aprove: o disparo só inicia depois da sua aprovação.",
        )}
      </p>

      {acimaDoTeto ? (
        <p className="rounded-xl bg-error/10 px-3 py-2 text-sm text-error-fg">
          {t(
            "Com mensagem da IA o disparo vai até {n} leads por enquanto (este tem {m}). Reduza o público e prepare de novo.",
          )
            .replace("{n}", String(r.teto))
            .replace("{m}", String(r.elegiveis))}
        </p>
      ) : !preparado ? (
        <p className="text-sm text-muted-foreground">
          {status === "draft"
            ? t("Prepare o disparo para gerar as mensagens.")
            : t("As mensagens estão congeladas para o envio.")}
        </p>
      ) : null}

      {preparado && !acimaDoTeto && todasPendentes && podeEditar ? (
        <button
          type="button"
          className={BOTAO_CHEIO}
          disabled={ocupado}
          onClick={() => gerar.mutate(undefined)}
        >
          {gerar.isPending
            ? t("A IA está escrevendo…")
            : t("Gerar as mensagens dos {n} leads").replace("{n}", String(r.elegiveis))}
        </button>
      ) : null}

      {!todasPendentes && r.itens.length > 0 ? (
        <>
          <p className="text-xs text-muted-foreground">
            {r.resumo.geradas} {t("escritas pela IA")} · {r.resumo.editadas} {t("editadas")} ·{" "}
            {r.resumo.falhas} {t("com falha")}
            {r.resumo.pendentes > 0 ? ` · ${r.resumo.pendentes} ${t("sem mensagem")}` : ""}
            {r.custo_cents > 0 ? ` · ${t("custo da IA")} ≈ ${reais(r.custo_cents)}` : ""}
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {itens.map((i) => (
              <CartaoDaMensagem
                key={i.id}
                item={i}
                podeEditar={podeEditar && preparado}
                ocupado={ocupado}
                aoEditar={(corpo) => editar.mutate({ id: i.id, corpo })}
                aoRegerar={() => gerar.mutate(i.id)}
                aoTirar={() => editar.mutate({ id: i.id, excluir: true })}
              />
            ))}
          </div>
          {r.itens.length > AMOSTRA ? (
            <button type="button" className={BOTAO} onClick={() => setVerTodas(!verTodas)}>
              {verTodas
                ? t("Ver só a amostra")
                : t("Ver todas as {n}").replace("{n}", String(r.itens.length))}
            </button>
          ) : null}
        </>
      ) : null}

      {preparado && podeEditar && !acimaDoTeto && !todasPendentes ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={BOTAO_CHEIO}
            disabled={ocupado || !pronta || Boolean(aprovadaEm)}
            onClick={() =>
              aprovar.mutate(undefined, {
                onSuccess: () => toast.success(t("Mensagens aprovadas.")),
              })
            }
          >
            {aprovadaEm ? t("Aprovadas") : t("Aprovar as mensagens")}
          </button>
          <button
            type="button"
            className={BOTAO}
            disabled={ocupado}
            onClick={() => gerar.mutate(undefined)}
          >
            {t("Escrever todas de novo")}
          </button>
          {!pronta ? (
            <span className="text-xs text-muted-foreground">
              {t(
                "Resolva os leads sem mensagem (gerar, escrever à mão ou tirar da lista) para aprovar.",
              )}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
