"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { somarDias } from "@/lib/inicio/datas";
import { topicosDasAnotacoes, type AutoavaliacaoDaSemana } from "@/lib/marketing/autoavaliacao";

const URL_BASE = "/api/v1/marketing/cronograma/autoavaliacoes";

const diaBr = (chave: string) => {
  const [a, m, d] = chave.split("-");
  return `${d}/${m}/${a?.slice(2)}`;
};
/** "Semana 25/10/26 → 31/10/26": a semana vai de domingo a sábado. */
const rotuloDaSemana = (inicio: string, semana: string) =>
  `${semana} ${diaBr(inicio)} → ${diaBr(somarDias(inicio, 6))}`;

/**
 * A AUTOAVALIAÇÃO DA SEMANA — só da agência (a rota é manager+ e a RLS também): uma nota de 0 a
 * 100% numa barra de progresso e anotações rápidas em tópicos. Cada semana guarda a sua, e o
 * histórico lista "Semana dd/mm/aa → dd/mm/aa — NN% — anotações".
 */
export function AutoavaliacaoDaSemana({ inicioDaSemana }: { inicioDaSemana: string }) {
  const t = useT();
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: ["cronograma-autoavaliacoes"],
    queryFn: async () =>
      (await apiClient.get<{ data: { autoavaliacoes: AutoavaliacaoDaSemana[] } }>(URL_BASE)).data
        .autoavaliacoes,
    staleTime: 10_000,
  });
  const lista = consulta.data ?? [];
  const salva = lista.find((x) => x.semana_inicio === inicioDaSemana);
  const [nota, setNota] = useState(0);
  const [anotacoes, setAnotacoes] = useState("");
  // Troca de semana (ou chegada do dado): o formulário passa a mostrar o que está salvo.
  useEffect(() => {
    setNota(salva?.nota ?? 0);
    setAnotacoes(salva?.anotacoes ?? "");
  }, [inicioDaSemana, salva?.nota, salva?.anotacoes]);

  const salvar = useMutation({
    mutationFn: async () =>
      apiClient.put(URL_BASE, { semana_inicio: inicioDaSemana, nota, anotacoes }),
    onSuccess: async () => {
      toast.success(t("Autoavaliação salva."));
      await qc.invalidateQueries({ queryKey: ["cronograma-autoavaliacoes"] });
    },
    onError: (e) => showApiError(e),
  });
  const mudou = nota !== (salva?.nota ?? 0) || anotacoes.trim() !== (salva?.anotacoes ?? "");

  return (
    <section
      data-testid="autoavaliacao-da-semana"
      className="grid gap-4 rounded-2xl border bg-card p-4"
    >
      <div>
        <h3 className="text-base font-semibold">{t("Autoavaliação da semana")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("Só a agência vê. Dê uma nota à semana e anote, em tópicos, como ela foi.")}
        </p>
      </div>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="nota-da-semana" className="text-sm font-medium">
            {t("Progresso da semana")}
          </label>
          <span className="text-lg font-semibold tabular-nums">{nota}%</span>
        </div>
        <div className="relative h-3 rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${nota}%` }}
            aria-hidden
          />
          <input
            id="nota-da-semana"
            type="range"
            min={0}
            max={100}
            step={5}
            value={nota}
            onChange={(e) => setNota(Number(e.target.value))}
            aria-valuetext={`${nota}%`}
            className="absolute inset-x-0 -top-2 h-7 w-full cursor-pointer opacity-0"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <label htmlFor="anotacoes-da-semana" className="text-sm font-medium">
          {t("Como foi a semana (um tópico por linha)")}
        </label>
        <Textarea
          id="anotacoes-da-semana"
          value={anotacoes}
          maxLength={2000}
          rows={5}
          placeholder={t("- O que funcionou\n- O que travou\n- O que fazer diferente")}
          onChange={(e) => setAnotacoes(e.target.value)}
        />
      </div>

      <div className="flex justify-end">
        <Button disabled={!mudou || salvar.isPending} onClick={() => salvar.mutate()}>
          {t("Salvar autoavaliação")}
        </Button>
      </div>

      {lista.length > 0 ? (
        <div className="grid gap-2 border-t pt-3">
          <h4 className="text-sm font-semibold">{t("Histórico")}</h4>
          <ul className="grid gap-2">
            {lista.map((x) => {
              const topicos = topicosDasAnotacoes(x.anotacoes);
              return (
                <li key={x.semana_inicio} className="rounded-xl bg-secondary/40 px-3 py-2">
                  <p className="text-sm font-medium [overflow-wrap:anywhere]">
                    {rotuloDaSemana(x.semana_inicio, t("Semana"))} — {x.nota}%
                  </p>
                  {topicos.length > 0 ? (
                    <ul className="mt-1 list-disc pl-5 text-sm [overflow-wrap:anywhere]">
                      {topicos.map((tp, i) => (
                        <li key={i}>{tp}</li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
