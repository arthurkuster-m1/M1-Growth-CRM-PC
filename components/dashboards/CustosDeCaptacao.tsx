"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { brl } from "@/components/dashboards/base";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { registrarDesfazer } from "@/lib/motor/desfazer";
import { Trash } from "@/lib/ui/icons";

interface Custo {
  id: string;
  campaign_id: string | null;
  source: string;
  day: string;
  amount_cents: number | string;
  note: string;
}

const hoje = () => new Intl.DateTimeFormat("en-CA").format(new Date());

/**
 * Os CUSTOS DE CAPTAÇÃO: quanto a empresa investiu para captar os leads de cada fonte (uma
 * extração, uma lista importada…). O valor entra no investimento e no CPL da fonte e do total.
 * Campanha em branco vale para todas as campanhas de prospecção.
 */
export function CustosDeCaptacao({
  de,
  ate,
  fontes,
  campanhas,
}: {
  de: string;
  ate: string;
  fontes: readonly string[];
  campanhas: ReadonlyArray<{ id: string; nome: string }>;
}) {
  const t = useT();
  const qc = useQueryClient();
  const [fonte, setFonte] = useState("");
  const [valor, setValor] = useState("");
  const [dia, setDia] = useState(hoje());
  const [nota, setNota] = useState("");
  const [campanha, setCampanha] = useState("");
  const [salvando, setSalvando] = useState(false);

  const lista = useQuery({
    queryKey: ["dashboard-prospeccao-custos", de, ate],
    staleTime: 15_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { custos: Custo[] } }>(
          `/api/v1/dashboards/prospeccao/custos?de=${de}&ate=${ate}`,
        )
      ).data.custos,
  });
  const atualizar = async () => {
    await qc.invalidateQueries({ queryKey: ["dashboard-prospeccao-custos"] });
    await qc.invalidateQueries({ queryKey: ["dashboard-prospeccao"] });
  };

  const corpoDe = (c: {
    source: string;
    amount: number;
    day: string;
    note: string;
    campaign_id: string | null;
  }) => ({
    source: c.source,
    amount: c.amount,
    day: c.day,
    note: c.note,
    campaign_id: c.campaign_id,
  });
  const lancar = async (c: ReturnType<typeof corpoDe>) => {
    const r = await apiClient.post<{ data: { custo: Custo } }>(
      "/api/v1/dashboards/prospeccao/custos",
      c,
    );
    return r.data.custo;
  };
  const apagar = async (custo: Custo) => {
    try {
      await apiClient.delete(`/api/v1/dashboards/prospeccao/custos/${custo.id}`);
      await atualizar();
      const volta = corpoDe({
        source: custo.source,
        amount: Number(custo.amount_cents) / 100,
        day: custo.day,
        note: custo.note,
        campaign_id: custo.campaign_id,
      });
      registrarDesfazer({
        rotulo: custo.source,
        desfazer: async () => {
          await lancar(volta);
          await atualizar();
        },
      });
    } catch (e) {
      showApiError(e);
    }
  };

  const numero = Number(valor.replace(/\./g, "").replace(",", "."));
  const pode = fonte.trim().length > 0 && Number.isFinite(numero) && numero > 0 && !salvando;
  const adicionar = async () => {
    setSalvando(true);
    try {
      const novo = await lancar(
        corpoDe({
          source: fonte.trim(),
          amount: numero,
          day: dia,
          note: nota.trim(),
          campaign_id: campanha || null,
        }),
      );
      registrarDesfazer({
        rotulo: fonte.trim(),
        desfazer: async () => {
          await apiClient.delete(`/api/v1/dashboards/prospeccao/custos/${novo.id}`);
          await atualizar();
        },
      });
      setValor("");
      setNota("");
      await atualizar();
    } catch (e) {
      showApiError(e);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">
        {t(
          "Lance quanto custou captar os leads de uma fonte (uma extração, uma lista importada…). O valor entra no investimento e no CPL. Também dá para informar o custo ao importar leads.",
        )}
      </p>
      <div className="grid gap-2 sm:grid-cols-[1.2fr_0.8fr_0.8fr_1.2fr_1fr_auto]">
        <Input
          list="fontes-de-custo"
          value={fonte}
          maxLength={60}
          placeholder={t("Fonte (ex.: Extração de leads)")}
          aria-label={t("Fonte")}
          onChange={(e) => setFonte(e.target.value)}
        />
        <datalist id="fontes-de-custo">
          {fontes.map((f) => (
            <option key={f} value={f} />
          ))}
        </datalist>
        <Input
          value={valor}
          inputMode="decimal"
          placeholder={t("Valor (R$)")}
          aria-label={t("Valor")}
          onChange={(e) => setValor(e.target.value)}
        />
        <Input
          type="date"
          value={dia}
          aria-label={t("Dia")}
          onChange={(e) => setDia(e.target.value)}
        />
        <Input
          value={nota}
          maxLength={300}
          placeholder={t("Observação (opcional)")}
          aria-label={t("Observação")}
          onChange={(e) => setNota(e.target.value)}
        />
        <select
          value={campanha}
          aria-label={t("Campanha")}
          onChange={(e) => setCampanha(e.target.value)}
          className="h-10 rounded-xl border bg-card px-2 text-sm"
        >
          <option value="">{t("Todas as campanhas")}</option>
          {campanhas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <Button type="button" disabled={!pode} onClick={() => void adicionar()}>
          {t("Lançar custo")}
        </Button>
      </div>
      {(lista.data ?? []).length > 0 ? (
        <ul className="divide-y rounded-xl border text-sm">
          {(lista.data ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-24 shrink-0 text-muted-foreground tabular-nums">
                {c.day.slice(8, 10)}/{c.day.slice(5, 7)}/{c.day.slice(0, 4)}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">
                {c.source}
                {c.note ? (
                  <span className="ml-2 font-normal text-muted-foreground">{c.note}</span>
                ) : null}
              </span>
              <span className="font-semibold tabular-nums">
                {brl(Number(c.amount_cents) / 100)}
              </span>
              <button
                type="button"
                title={t("Apagar (Ctrl+Z desfaz)")}
                onClick={() => void apagar(c)}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg"
              >
                <Trash size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("Nenhum custo lançado neste período.")}</p>
      )}
    </div>
  );
}
