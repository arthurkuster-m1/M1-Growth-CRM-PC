import type { ReactNode } from "react";

import { BORDA_DA_MARCA } from "@/components/marketing/VisuaisDosBlocos";
import { moeda } from "@/lib/marketing/calculadora";
import {
  precoEmTexto,
  ROTULO_DA_ETAPA,
  valorTotalDaOferta,
  type Oferta,
} from "@/lib/marketing/oferta";
import { Check, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

/** Os títulos fixos da página de oferta (texto da agência para o cliente, em português). */
const R = {
  paraQuem: "Para quem é",
  naoEParaQuem: "Para quem não é",
  inclui: "O que está incluído",
  naoInclui: "O que não está incluído",
  entregaveis: "O que você recebe",
  bonus: "Bônus",
  valorTotal: "Valor total do que é entregue",
  investimento: "Seu investimento",
  inacao: "O custo de não fazer nada",
  prazo: "Prazo",
  garantia: "Garantia",
  escassez: "Por que agora",
  objecoes: "Dúvidas e objeções",
  faq: "Perguntas frequentes",
  referencia: "Valor de referência",
} as const;

function Secao({
  titulo,
  children,
  slide,
}: {
  titulo: string;
  children: ReactNode;
  slide: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3
        className={cn("font-semibold tracking-tight", slide ? "text-2xl sm:text-3xl" : "text-xl")}
      >
        {titulo}
      </h3>
      {children}
    </section>
  );
}

/**
 * A OFERTA como o cliente a lê: do resumo ao preço, e — na versão completa — a promessa, o valor
 * empilhado, a garantia e as objeções. Sai dos campos do bloco, então fica sempre igual ao texto
 * que a IA recebe.
 */
export function OfertaDaPagina({ oferta: o, slide }: { oferta: Oferta; slide: boolean }) {
  const completa = o.nivel === "completa";
  const corpo = slide ? "text-lg sm:text-2xl leading-relaxed" : "text-base leading-relaxed";
  const total = valorTotalDaOferta(o);
  const inclui = o.inclui.filter((i) => i.trim() !== "");
  const naoInclui = o.naoInclui.filter((i) => i.trim() !== "");
  const entregaveis = o.entregaveis.filter((e) => e.nome.trim() !== "");
  const bonus = o.bonus.filter((e) => e.nome.trim() !== "");
  const objecoes = o.objecoes.filter((x) => x.objecao.trim() !== "");
  const faq = o.faq.filter((x) => x.pergunta.trim() !== "");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {ROTULO_DA_ETAPA[o.etapa]}
          </span>
          {o.carroChefe ? (
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
              Carro-chefe
            </span>
          ) : null}
        </div>
        {o.resumo ? <p className={cn("max-w-3xl whitespace-pre-line", corpo)}>{o.resumo}</p> : null}
      </header>

      {completa && o.promessa ? (
        <blockquote
          className={cn(
            "rounded-2xl bg-primary/10 p-6 font-semibold tracking-tight sm:p-8",
            slide ? "text-2xl sm:text-4xl" : "text-xl sm:text-2xl",
          )}
        >
          {o.promessa}
        </blockquote>
      ) : null}

      {o.paraQuem || o.naoEParaQuem ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {o.paraQuem ? (
            <section className={cn("rounded-2xl bg-card p-5", BORDA_DA_MARCA)}>
              <h4 className="mb-1.5 font-semibold">{R.paraQuem}</h4>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{o.paraQuem}</p>
            </section>
          ) : null}
          {o.naoEParaQuem ? (
            <section className="rounded-2xl border bg-secondary/50 p-5">
              <h4 className="mb-1.5 font-semibold">{R.naoEParaQuem}</h4>
              <p className="text-sm whitespace-pre-line text-muted-foreground">{o.naoEParaQuem}</p>
            </section>
          ) : null}
        </div>
      ) : null}

      {!completa && inclui.length > 0 ? (
        <Secao titulo={R.inclui} slide={slide}>
          <ul className={cn("flex flex-col gap-2", corpo)}>
            {inclui.map((i, k) => (
              <li key={k} className="flex gap-3">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check size={12} weight="bold" aria-hidden />
                </span>
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      {completa && entregaveis.length > 0 ? (
        <Secao titulo={R.entregaveis} slide={slide}>
          <div className="grid gap-4 sm:grid-cols-2">
            {entregaveis.map((e, k) => (
              <div
                key={k}
                className={cn("flex flex-col gap-1.5 rounded-2xl bg-card p-5", BORDA_DA_MARCA)}
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-semibold">{e.nome}</h4>
                  {e.valor ? (
                    <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {e.valor}
                    </span>
                  ) : null}
                </div>
                {e.descricao ? (
                  <p className="text-sm whitespace-pre-line text-muted-foreground">{e.descricao}</p>
                ) : null}
              </div>
            ))}
          </div>
        </Secao>
      ) : null}

      {completa && bonus.length > 0 ? (
        <Secao titulo={R.bonus} slide={slide}>
          <div className="grid gap-4 sm:grid-cols-2">
            {bonus.map((e, k) => (
              <div
                key={k}
                className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] border-dashed border-primary bg-primary/5 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-semibold">{e.nome}</h4>
                  {e.valor ? (
                    <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {e.valor}
                    </span>
                  ) : null}
                </div>
                {e.descricao ? (
                  <p className="text-sm whitespace-pre-line text-muted-foreground">{e.descricao}</p>
                ) : null}
              </div>
            ))}
          </div>
        </Secao>
      ) : null}

      {naoInclui.length > 0 ? (
        <Secao titulo={R.naoInclui} slide={slide}>
          <ul className={cn("flex flex-col gap-2 text-muted-foreground", corpo)}>
            {naoInclui.map((i, k) => (
              <li key={k} className="flex gap-3">
                <span className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-secondary">
                  <X size={11} weight="bold" aria-hidden />
                </span>
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        {completa && total !== null ? (
          <div className="rounded-2xl border bg-card p-5">
            <span className="block text-xs font-medium text-muted-foreground">{R.valorTotal}</span>
            <span className="mt-1 block text-2xl font-bold tracking-tight text-muted-foreground line-through">
              {moeda(total)}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{R.referencia}</span>
          </div>
        ) : null}
        <div className={cn("rounded-2xl bg-card p-5", BORDA_DA_MARCA)}>
          <span className="block text-xs font-medium text-muted-foreground">{R.investimento}</span>
          <span className="mt-1 block text-3xl font-bold tracking-tight text-primary">
            {precoEmTexto(o)}
          </span>
          {o.preco.condicoes ? (
            <span className="mt-1 block text-sm whitespace-pre-line text-muted-foreground">
              {o.preco.condicoes}
            </span>
          ) : null}
        </div>
        {completa && o.custoDaInacao ? (
          <div className="rounded-2xl border bg-secondary/50 p-5">
            <span className="block text-xs font-medium text-muted-foreground">{R.inacao}</span>
            <span className="mt-1 block text-sm whitespace-pre-line">{o.custoDaInacao}</span>
          </div>
        ) : null}
        {o.prazo ? (
          <div className="rounded-2xl border bg-card p-5">
            <span className="block text-xs font-medium text-muted-foreground">{R.prazo}</span>
            <span className="mt-1 block text-base font-semibold">{o.prazo}</span>
          </div>
        ) : null}
      </section>

      {completa && o.garantia ? (
        <section className="rounded-2xl border-l-4 border-success/60 bg-success-bg p-6">
          <h4 className="mb-1 font-semibold">{R.garantia}</h4>
          <p className={cn("whitespace-pre-line", slide ? "text-lg sm:text-2xl" : "text-base")}>
            {o.garantia}
          </p>
        </section>
      ) : null}

      {completa && o.escassez ? (
        <section className="rounded-2xl border-l-4 border-warning/60 bg-warning-bg p-6">
          <h4 className="mb-1 font-semibold">{R.escassez}</h4>
          <p className={cn("whitespace-pre-line", slide ? "text-lg sm:text-2xl" : "text-base")}>
            {o.escassez}
          </p>
        </section>
      ) : null}

      {completa && objecoes.length > 0 ? (
        <Secao titulo={R.objecoes} slide={slide}>
          <div className="grid gap-4 sm:grid-cols-2">
            {objecoes.map((x, k) => (
              <div key={k} className={cn("rounded-2xl bg-card p-5", BORDA_DA_MARCA)}>
                <h4 className="font-semibold">{x.objecao}</h4>
                <p className="mt-1.5 text-sm whitespace-pre-line text-muted-foreground">
                  {x.resposta}
                </p>
              </div>
            ))}
          </div>
        </Secao>
      ) : null}

      {faq.length > 0 ? (
        <Secao titulo={R.faq} slide={slide}>
          <div className="flex flex-col gap-3">
            {faq.map((x, k) => (
              <details key={k} className="group rounded-2xl border bg-card p-4">
                <summary className="cursor-pointer list-none font-medium">{x.pergunta}</summary>
                <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">
                  {x.resposta}
                </p>
              </details>
            ))}
          </div>
        </Secao>
      ) : null}
    </div>
  );
}
