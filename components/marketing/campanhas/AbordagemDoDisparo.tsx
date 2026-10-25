"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { SelectDoApp } from "@/components/ui/SelectDoApp";
import { useT } from "@/hooks/i18n/useT";
import { useCadenciaDaCampanha, useFluxoDaAbordagem } from "@/hooks/marketing/useCadencia";
import { useAbordagensDaCampanha } from "@/hooks/marketing/useCampanhasDeDemanda";
import { ordenarPassos } from "@/lib/cadencia/cadencia";
import type { PassoDoFluxo, TipoDePassoDoFluxo } from "@/lib/cadencia/fluxo-da-abordagem";

const CAMPO =
  "h-10 w-full rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

/** O texto fixo da abertura do fluxo (1º passo, se for mensagem sem IA) — para sugerir o texto do disparo. */
export function aberturaFixaDoFluxo(passos: readonly PassoDoFluxo[] | null | undefined): string {
  const p = passos?.[0];
  return p && p.kind === "mensagem" && !p.ai_personalize ? p.body.trim() : "";
}

/** A abordagem do passo mais cedo da cadência que tem abordagem de WhatsApp (o D0 em geral). */
export function abordagemSugerida(
  passos: ReadonlyArray<{ day_offset: number; medium: string; approach_id: string | null }>,
): string | null {
  const p = ordenarPassos([...passos]).find((x) => x.medium === "whatsapp" && x.approach_id);
  return p?.approach_id ?? null;
}

const ROTULO: Record<TipoDePassoDoFluxo, string> = {
  mensagem: "Mensagem",
  audio: "Áudio",
  aguardar: "Aguardar resposta",
  encaminhar: "Encaminhar ao atendente",
};

/** O fluxo da abordagem em uma linha: Mensagem → Aguardar resposta → Mensagem (IA) → … */
export function ResumoDoFluxo({
  campanhaId,
  abordagemId,
  ideiaCentral,
}: {
  campanhaId: string;
  abordagemId: string;
  ideiaCentral: string;
}) {
  const t = useT();
  const { passos, carregando } = useFluxoDaAbordagem(campanhaId, abordagemId);
  if (carregando || passos === null) return null;
  return (
    <div className="grid gap-1 rounded-xl bg-secondary px-3 py-2 text-xs">
      {passos.length === 0 ? (
        <p className="text-muted-foreground">
          {t(
            "Esta abordagem ainda não tem fluxo de conversa: o disparo manda só a mensagem abaixo.",
          )}{" "}
          <Link
            href={`/app/marketing/geracao-de-demanda/campanhas/${campanhaId}?aba=cadencia`}
            className="font-medium text-primary hover:underline"
          >
            {t("Desenhar na Cadência")}
          </Link>
        </p>
      ) : (
        <p className="font-medium">
          {passos
            .map((p) =>
              p.kind === "mensagem" && p.ai_personalize
                ? `${t("Mensagem")} (IA)`
                : t(ROTULO[p.kind]),
            )
            .join(" → ")}
        </p>
      )}
      {ideiaCentral.trim() ? (
        <p className="text-muted-foreground">
          {t("Ideia central")}: {ideiaCentral}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A ABORDAGEM do disparo: qual abordagem de WhatsApp (e, por ela, qual fluxo de conversa) este
 * disparo executa. Sugere a do passo mais cedo da cadência. Só mostra as abordagens de WhatsApp da
 * campanha de prospecção dona do disparo.
 */
export function AbordagemDoDisparo({
  campanhaId,
  valor,
  aoMudar,
  podeEditar = true,
  sugerirSozinho = true,
  aoSugerirTexto,
}: {
  campanhaId: string;
  valor: string;
  aoMudar: (id: string) => void;
  /** O texto fixo da abertura do fluxo, para a tela sugerir como mensagem do disparo (se estiver vazia). */
  aoSugerirTexto?: (texto: string) => void;
  podeEditar?: boolean;
  /** Preenche com a sugestão da cadência quando ainda não há escolha (só ao criar). */
  sugerirSozinho?: boolean;
}) {
  const t = useT();
  const { abordagens } = useAbordagensDaCampanha(campanhaId);
  const { dados } = useCadenciaDaCampanha(campanhaId);
  const doWhatsapp = abordagens.filter((a) => a.medium === "whatsapp");
  const escolhida = doWhatsapp.find((a) => a.id === valor) ?? null;
  const { passos } = useFluxoDaAbordagem(
    campanhaId,
    valor || "00000000-0000-0000-0000-000000000000",
  );
  const jaSugeriu = useRef(false);
  const textoSugeridoPara = useRef<string | null>(null);

  useEffect(() => {
    if (!aoSugerirTexto || !valor || !passos || textoSugeridoPara.current === valor) return;
    textoSugeridoPara.current = valor;
    const abertura = aberturaFixaDoFluxo(passos);
    if (abertura) aoSugerirTexto(abertura);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, passos]);

  useEffect(() => {
    if (!sugerirSozinho || jaSugeriu.current || valor || !dados) return;
    const id = abordagemSugerida(dados.cadencia.steps);
    jaSugeriu.current = true;
    if (id && doWhatsapp.some((a) => a.id === id)) aoMudar(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, abordagens]);

  if (doWhatsapp.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("Esta campanha ainda não tem abordagem de WhatsApp.")}{" "}
        <Link
          href={`/app/marketing/geracao-de-demanda/campanhas/${campanhaId}?aba=cadencia`}
          className="font-medium text-primary hover:underline"
        >
          {t("Criar na Cadência")}
        </Link>
      </p>
    );
  }
  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">{t("Abordagem")}</span>
        <SelectDoApp
          className={CAMPO}
          disabled={!podeEditar}
          value={valor}
          aria-label={t("Abordagem do disparo")}
          onChange={(e) => aoMudar(e.target.value)}
        >
          <option value="">{t("Sem abordagem (só o texto abaixo)")}</option>
          {doWhatsapp.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectDoApp>
      </label>
      {escolhida ? (
        <ResumoDoFluxo
          campanhaId={campanhaId}
          abordagemId={escolhida.id}
          ideiaCentral={escolhida.central_idea ?? ""}
        />
      ) : null}
    </div>
  );
}
