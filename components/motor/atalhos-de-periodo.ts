"use client";

import type { AtalhoDePeriodo } from "@/components/motor/CalendarioDePeriodo";
import { useT } from "@/hooks/i18n/useT";
import { somarDias } from "@/lib/inicio/datas";
import { PERIODOS, janelaDoPeriodo, type Periodo } from "@/lib/marketing/periodos";

/** O dia de hoje, no fuso de quem está olhando (AAAA-MM-DD). */
export const hojeLocal = () => new Intl.DateTimeFormat("en-CA").format(new Date());

/** O nome de cada período nomeado, como a tela o mostra. */
export function rotuloDoPeriodo(t: (s: string) => string, p: Periodo): string {
  switch (p) {
    case "hoje":
      return t("Hoje");
    case "ontem":
      return t("Ontem");
    case "ultimos_5_dias":
      return t("Últimos 5 dias");
    case "ultimos_7_dias":
      return t("Últimos 7 dias");
    case "ultimos_30_dias":
      return t("Últimos 30 dias");
    case "semana":
      return t("Esta semana");
    case "mes":
      return t("Este mês");
    case "mes_passado":
      return t("Mês passado");
  }
}

/**
 * OS ATALHOS PADRÃO do Seletor de Período — os mesmos em todas as telas do app.
 *
 * `semHoje`: para as telas que nunca leem o dia em andamento (Meta Ads: o dia corrente está
 * incompleto e a plataforma ainda o reprocessa). Os atalhos terminam ONTEM, e o seletor deve
 * receber `max={ontem}`.
 */
export function useAtalhosDePeriodo(opcoes: { semHoje?: boolean } = {}): {
  atalhos: AtalhoDePeriodo[];
  hoje: string;
  /** Último dia escolhível: ontem quando `semHoje`, senão nenhum limite. */
  max: string | undefined;
} {
  const t = useT();
  const hoje = hojeLocal();

  if (!opcoes.semHoje) {
    return {
      hoje,
      max: undefined,
      atalhos: PERIODOS.map((p) => ({
        id: p,
        rotulo: rotuloDoPeriodo(t, p),
        ...janelaDoPeriodo(p, hoje),
      })),
    };
  }

  const ontem = somarDias(hoje, -1);
  const ultimos = (n: number, rotulo: string): AtalhoDePeriodo => ({
    id: `ultimos_${n}`,
    rotulo,
    de: somarDias(ontem, -(n - 1)),
    ate: ontem,
  });
  const primeiroDoMes = `${ontem.slice(0, 7)}-01`;
  const passado = janelaDoPeriodo("mes_passado", hoje);
  return {
    hoje,
    max: ontem,
    atalhos: [
      { id: "ontem", rotulo: t("Ontem"), de: ontem, ate: ontem },
      ultimos(7, t("Últimos 7 dias")),
      ultimos(14, t("Últimos 14 dias")),
      ultimos(30, t("Últimos 30 dias")),
      ultimos(90, t("Últimos 90 dias")),
      { id: "mes", rotulo: t("Este mês"), de: primeiroDoMes, ate: ontem },
      { id: "mes_passado", rotulo: t("Mês passado"), de: passado.de, ate: passado.ate },
    ],
  };
}
