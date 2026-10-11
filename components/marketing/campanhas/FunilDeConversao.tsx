"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { StagesSection } from "@/app/app/settings/tenant/pipelines/_stages";
import { useT } from "@/hooks/i18n/useT";
import { useCampanhasDeDemanda } from "@/hooks/marketing/useCampanhasDeDemanda";
import { apiClient } from "@/lib/api/client";
import type { CampanhaDeDemanda } from "@/lib/marketing/campanhas";
import { ArrowRight, Plus } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Etapa {
  id: string;
  name: string;
  position: number;
  is_won: boolean;
  is_lost: boolean;
  expected_duration_hours: number | null;
  win_probability?: number | null;
}

const CAMPO =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

const FORMA_PRIMEIRA =
  "polygon(0 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 22px) 100%, 0 100%)";
const FORMA_DEMAIS =
  "polygon(0 0, calc(100% - 22px) 0, 100% 50%, calc(100% - 22px) 100%, 0 100%, 22px 50%)";

/** Um nome que grava ao sair do campo, só se mudou. */
function NomeGravavel({
  valor,
  aoGravar,
  desabilitado,
  rotulo,
}: {
  valor: string;
  aoGravar: (v: string) => void;
  desabilitado: boolean;
  rotulo: string;
}) {
  const [v, setV] = useState(valor);
  useEffect(() => setV(valor), [valor]);
  return (
    <input
      value={v}
      maxLength={80}
      disabled={desabilitado}
      aria-label={rotulo}
      className={CAMPO}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() && v !== valor && aoGravar(v.trim())}
    />
  );
}

/**
 * O FUNIL DE CONVERSÃO da campanha: o desenho do fluxo (etapa → etapa → …) e a configuração
 * etapa por etapa. Cada campanha tem o seu funil, criado aqui dentro — não existe funil solto.
 */
export function FunilDeConversao({ c, podeEditar }: { c: CampanhaDeDemanda; podeEditar: boolean }) {
  const t = useT();
  const { funis, editar } = useCampanhasDeDemanda();
  const queryClient = useQueryClient();
  const funil = funis.find((f) => f.id === c.pipeline_id) ?? null;
  const [etapas, setEtapas] = useState<Etapa[] | null>(null);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [semAcesso, setSemAcesso] = useState(false);

  const carregar = useCallback(async () => {
    if (!c.pipeline_id) return;
    try {
      const r = await apiClient.get<{ data: Etapa[] }>(`/api/v1/pipelines/${c.pipeline_id}/stages`);
      setEtapas(r.data);
      setEscolhida((atual) => atual ?? r.data[0]?.id ?? null);
    } catch {
      setSemAcesso(true);
    }
  }, [c.pipeline_id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function criarFunil() {
    setCriando(true);
    try {
      const r = await apiClient.post<{
        data: { pipelines: Array<{ id: string; name: string }> };
      }>("/api/v1/pipelines", { name: c.name.slice(0, 80) });
      const novo =
        r.data.pipelines.find((p) => p.name === c.name.slice(0, 80)) ?? r.data.pipelines.at(-1);
      if (novo) await editar([c.id], { pipeline_id: novo.id });
    } catch (e) {
      showApiError(e);
    } finally {
      setCriando(false);
    }
  }

  async function mexer(etapaId: string, patch: Record<string, unknown>) {
    if (!c.pipeline_id) return;
    try {
      await apiClient.patch(`/api/v1/pipelines/${c.pipeline_id}/stages/${etapaId}`, patch);
    } catch (e) {
      showApiError(e);
    } finally {
      await carregar();
    }
  }

  async function novaEtapa() {
    if (!c.pipeline_id) return;
    try {
      await apiClient.post(`/api/v1/pipelines/${c.pipeline_id}/stages`, {
        name: t("Nova etapa"),
      });
    } catch (e) {
      showApiError(e);
    } finally {
      await carregar();
    }
  }

  // Sem funil: o convite para criar o da campanha.
  if (!c.pipeline_id) {
    return (
      <section className="grid gap-3 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">{t("Funil de conversão")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "Esta campanha ainda não tem funil. O funil é só dela: os leads que entram na campanha nascem na primeira etapa e andam até o fechamento.",
          )}
        </p>
        {podeEditar ? (
          <button
            type="button"
            disabled={criando}
            onClick={() => void criarFunil()}
            className="inline-flex h-10 w-fit items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {criando ? t("Criando…") : t("Criar o funil desta campanha")}
          </button>
        ) : null}
      </section>
    );
  }

  const lista = etapas ?? [];
  const atual = lista.find((e) => e.id === escolhida) ?? null;
  const papel = (e: Etapa) => (e.is_won ? "won" : e.is_lost ? "lost" : "nenhum");

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">
            {t("Funil de conversão")} · {funil?.name ?? c.name}
          </h2>
          <Link
            href={`/app/clientes?funil=${c.pipeline_id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary"
          >
            {t("Ver no CRM")}
            <ArrowRight size={14} weight="bold" aria-hidden />
          </Link>
        </div>

        {semAcesso ? (
          <p className="text-sm text-muted-foreground">
            {t("Só a agência vê e edita as etapas do funil.")}
          </p>
        ) : etapas === null ? (
          <div className="h-24 animate-pulse rounded-xl bg-secondary" aria-busy="true" />
        ) : (
          <>
            <ol
              aria-label={t("Etapas do funil, da primeira à última")}
              className="flex overflow-x-auto pb-1"
            >
              {lista.map((e, i) => (
                <li
                  key={e.id}
                  className="-ml-4 first:ml-0"
                  style={{ minWidth: 190, flex: "1 0 190px" }}
                >
                  <button
                    type="button"
                    aria-pressed={escolhida === e.id}
                    onClick={() => setEscolhida(e.id)}
                    style={{ clipPath: i === 0 ? FORMA_PRIMEIRA : FORMA_DEMAIS }}
                    className={cn(
                      "grid h-24 w-full content-center gap-0.5 py-3 pr-8 text-left transition-colors",
                      i === 0 ? "pl-4" : "pl-9",
                      escolhida === e.id
                        ? "bg-primary text-primary-foreground"
                        : e.is_won
                          ? "bg-success-bg text-success-fg"
                          : e.is_lost
                            ? "bg-error-bg text-error-fg"
                            : "bg-secondary text-foreground hover:bg-secondary/70",
                    )}
                  >
                    <span className="font-mono text-[11px] font-semibold tabular-nums opacity-80">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate text-sm font-semibold">{e.name}</span>
                    <span className="truncate text-xs opacity-80">
                      {e.is_won
                        ? t("Aqui o cliente fecha")
                        : e.is_lost
                          ? t("Aqui o cliente desiste")
                          : t("Em andamento")}
                    </span>
                  </button>
                </li>
              ))}
              {podeEditar ? (
                <li className="ml-2 grid shrink-0 place-items-center">
                  <button
                    type="button"
                    onClick={() => void novaEtapa()}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-dashed px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary"
                  >
                    <Plus size={14} weight="bold" aria-hidden />
                    {t("Etapa")}
                  </button>
                </li>
              ) : null}
            </ol>

            {atual ? (
              <div className="grid gap-3 rounded-xl border border-dashed p-3">
                <p className="text-xs font-semibold tracking-wider text-text-subtle uppercase">
                  {t("Configurar a etapa")}{" "}
                  {String(lista.findIndex((e) => e.id === atual.id) + 1).padStart(2, "0")}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">
                      {t("Nome da etapa")}
                    </span>
                    <NomeGravavel
                      valor={atual.name}
                      desabilitado={!podeEditar}
                      rotulo={t("Nome da etapa")}
                      aoGravar={(name) => void mexer(atual.id, { name })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">
                      {t("O que acontece nesta etapa")}
                    </span>
                    <select
                      className={CAMPO}
                      disabled={!podeEditar}
                      value={papel(atual)}
                      onChange={(ev) => {
                        const v = ev.target.value;
                        void mexer(atual.id, {
                          is_won: v === "won",
                          is_lost: v === "lost",
                        });
                      }}
                    >
                      <option value="nenhum">{t("Nada especial")}</option>
                      <option value="won">{t("Aqui o cliente fecha")}</option>
                      <option value="lost">{t("Aqui o cliente desiste")}</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">
                      {t("Chance de fechamento (0 a 100)")}
                    </span>
                    <input
                      key={atual.id}
                      type="number"
                      min={0}
                      max={100}
                      disabled={!podeEditar}
                      defaultValue={atual.win_probability ?? ""}
                      className={CAMPO}
                      onBlur={(ev) => {
                        const v = ev.target.value.trim();
                        const n =
                          v === "" ? null : Math.min(100, Math.max(0, Math.round(Number(v))));
                        if (n !== (atual.win_probability ?? null)) {
                          void mexer(atual.id, { win_probability: n });
                        }
                      }}
                    />
                  </label>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      disabled={!podeEditar || lista[0]?.id === atual.id}
                      onClick={() => {
                        const i = lista.findIndex((e) => e.id === atual.id);
                        void mexer(atual.id, { depois_de: lista[i - 2]?.id ?? null });
                      }}
                      className="h-10 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary disabled:opacity-40"
                    >
                      ← {t("Mover para trás")}
                    </button>
                    <button
                      type="button"
                      disabled={!podeEditar || lista.at(-1)?.id === atual.id}
                      onClick={() => {
                        const i = lista.findIndex((e) => e.id === atual.id);
                        void mexer(atual.id, { depois_de: lista[i + 1]?.id ?? null });
                      }}
                      className="h-10 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary disabled:opacity-40"
                    >
                      {t("Mover para frente")} →
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {podeEditar ? (
        <section className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t("Quando o lead ganhar neste funil, ele entra em")}
            </span>
            <select
              className={CAMPO}
              value={funil?.ao_ganhar_funil_id ?? ""}
              onChange={async (ev) => {
                try {
                  await apiClient.put(`/api/v1/pipelines/${c.pipeline_id}/ao-ganhar`, {
                    funil_destino_id: ev.target.value === "" ? null : ev.target.value,
                  });
                  await queryClient.invalidateQueries({ queryKey: ["demand-campaigns"] });
                } catch (e) {
                  showApiError(e);
                }
              }}
            >
              <option value="">{t("Nenhum (só fica como ganho)")}</option>
              {funis
                .filter((f) => f.id !== c.pipeline_id)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
            <span className="mt-1 block text-xs text-muted-foreground">
              {t(
                "O lead continua no CRM: fica como ganho aqui e abre uma entrada na primeira etapa do funil escolhido.",
              )}
            </span>
          </label>
          <details className="rounded-xl border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              {t("Configurações avançadas das etapas")}
            </summary>
            <div className="mt-3">
              <StagesSection pipelineId={c.pipeline_id} ancoraMapeamento="" />
            </div>
          </details>
        </section>
      ) : null}
    </div>
  );
}
