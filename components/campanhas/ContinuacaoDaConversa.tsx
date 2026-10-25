"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useContinuacoes } from "@/hooks/campanhas/useContinuacoes";
import { useT } from "@/hooks/i18n/useT";
import type { EstadoDoFluxo } from "@/lib/campanhas/continuacao";
import type { ItemDaContinuacao } from "@/lib/campanhas/fluxo-da-conversa";
import { Sparkle } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const BOTAO =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50";
const BOTAO_CHEIO =
  "inline-flex h-9 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

const ROTULO_DO_ESTADO: Record<EstadoDoFluxo, string> = {
  proposta_pendente: "Mensagem para aprovar",
  aguardando_resposta: "Esperando a resposta",
  encaminhado: "Com o atendente",
  concluido: "Fluxo concluído",
  parado: "Parado",
};

const ROTULO_DO_MOTIVO: Record<string, string> = {
  opt_out: "pediu para não receber mensagens",
  descartado: "encerrado por você",
  sem_resposta: "não respondeu no prazo",
  sem_dono: "o lead não tem responsável para receber a tarefa",
};

function CartaoDaProposta({
  item,
  ocupado,
  aoDecidir,
}: {
  item: ItemDaContinuacao;
  ocupado: boolean;
  aoDecidir: (acao: "enviar" | "pular" | "reescrever" | "parar", corpo?: string) => void;
}) {
  const t = useT();
  const [texto, setTexto] = useState(item.corpo);
  const [versao, setVersao] = useState(item.corpo);
  if (item.corpo !== versao) {
    setVersao(item.corpo);
    setTexto(item.corpo);
  }
  const audio = item.tipo === "audio";
  return (
    <article className="grid gap-2 rounded-2xl border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{item.nome}</p>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium">
          {audio ? t("Áudio") : item.ia ? t("Escrita pela IA") : t("Texto do fluxo")}
        </span>
      </div>
      {item.respostas.length > 0 ? (
        <div className="grid gap-1 rounded-xl bg-secondary/60 px-3 py-2 text-xs">
          <p className="font-medium text-muted-foreground">{t("O lead respondeu")}</p>
          {item.respostas.map((r, i) => (
            <p key={i}>“{r}”</p>
          ))}
        </div>
      ) : null}
      {audio ? (
        <p className="text-sm">
          🎙️ {item.corpo || t("Áudio gravado")} —{" "}
          {t("o arquivo de voz do fluxo vai como áudio, ao aprovar.")}
        </p>
      ) : (
        <textarea
          rows={4}
          maxLength={1000}
          disabled={ocupado}
          aria-label={`${t("Mensagem para")} ${item.nome}`}
          className="w-full rounded-xl border bg-card px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          value={texto}
          placeholder={t("Escreva a mensagem")}
          onChange={(e) => setTexto(e.target.value)}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BOTAO_CHEIO}
          disabled={ocupado || (!audio && texto.trim() === "")}
          onClick={() => aoDecidir("enviar", audio ? undefined : texto)}
        >
          {audio ? t("Aprovar e enviar o áudio") : t("Aprovar e enviar")}
        </button>
        {audio ? null : (
          <button
            type="button"
            className={BOTAO}
            disabled={ocupado}
            onClick={() => aoDecidir("reescrever")}
          >
            <Sparkle className="size-4" aria-hidden /> {t("Pedir outra à IA")}
          </button>
        )}
        <button
          type="button"
          className={BOTAO}
          disabled={ocupado}
          onClick={() => aoDecidir("pular")}
        >
          {audio ? t("Já mandei à mão") : t("Pular este passo")}
        </button>
        <button
          type="button"
          className={BOTAO}
          disabled={ocupado}
          onClick={() => aoDecidir("parar")}
        >
          {t("Encerrar o fluxo")}
        </button>
      </div>
    </article>
  );
}

/**
 * A CONTINUAÇÃO DA CONVERSA (Fase 8d): depois que o lead responde, o fluxo da abordagem propõe a
 * próxima mensagem — e ela só sai quando a pessoa aprova aqui.
 */
export function ContinuacaoDaConversa({ campanhaId }: { campanhaId: string }) {
  const t = useT();
  const { dados, carregando, decidir } = useContinuacoes(campanhaId, true);
  if (carregando || !dados) return null;
  const total = Object.values(dados.resumo).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const propostas = dados.itens.filter((i) => i.estado === "proposta_pendente");
  const outros = dados.itens.filter((i) => i.estado !== "proposta_pendente");
  const decide =
    (item: ItemDaContinuacao) =>
    (acao: "enviar" | "pular" | "reescrever" | "parar", corpo?: string) =>
      decidir.mutate(
        { id: item.id, acao, corpo },
        {
          onSuccess: () =>
            toast.success(
              acao === "enviar"
                ? t("Mensagem enviada.")
                : acao === "reescrever"
                  ? t("A IA escreveu de novo.")
                  : acao === "pular"
                    ? t("Passo pulado.")
                    : t("Fluxo encerrado."),
            ),
        },
      );
  return (
    <section className="space-y-3 rounded-2xl border border-primary/30 p-4">
      <header className="space-y-1">
        <h2 className="text-base font-semibold">{t("Continuação da conversa")}</h2>
        <p className="text-xs text-muted-foreground">
          {t(
            "Quando o lead responde, o fluxo da abordagem propõe a próxima mensagem. Ela só sai depois que você aprova.",
          )}
        </p>
        <p className="text-xs">
          {(Object.keys(ROTULO_DO_ESTADO) as EstadoDoFluxo[])
            .filter((e) => dados.resumo[e] > 0)
            .map((e) => `${dados.resumo[e]} ${t(ROTULO_DO_ESTADO[e]).toLowerCase()}`)
            .join(" · ")}
        </p>
        {dados.custo_cents > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("Custo da IA nesta continuação")}:{" "}
            {(dados.custo_cents / 100).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </p>
        ) : null}
      </header>
      {propostas.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {propostas.map((i) => (
            <CartaoDaProposta
              key={i.id}
              item={i}
              ocupado={decidir.isPending}
              aoDecidir={decide(i)}
            />
          ))}
        </div>
      ) : null}
      {outros.length > 0 ? (
        <ul className="divide-y rounded-xl border text-sm">
          {outros.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span className="font-medium">{i.nome}</span>
              <span
                className={cn(
                  "text-xs",
                  i.estado === "parado" ? "text-warning-fg" : "text-muted-foreground",
                )}
              >
                {t(ROTULO_DO_ESTADO[i.estado])}
                {i.motivo ? ` — ${t(ROTULO_DO_MOTIVO[i.motivo] ?? i.motivo)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
