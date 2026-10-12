"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  qualification?: "mql" | "disqualified" | null;
}

type Papel = "nenhum" | "won" | "lost" | "mql" | "disqualified";

const papelDe = (e: Etapa): Papel =>
  e.is_won ? "won" : e.is_lost ? "lost" : (e.qualification ?? "nenhum");

/** Só o que muda viaja: a API recusa desmarcar ganho/perda que nunca estiveram marcados. */
function patchDoPapel(e: Etapa, novo: Papel): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (e.is_won !== (novo === "won")) patch.is_won = novo === "won";
  if (e.is_lost !== (novo === "lost")) patch.is_lost = novo === "lost";
  const qual = novo === "mql" || novo === "disqualified" ? novo : null;
  if ((e.qualification ?? null) !== qual) patch.qualification = qual;
  return patch;
}

interface Modelo {
  id: string;
  name: string;
  stages: unknown[];
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
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [modeloEscolhido, setModeloEscolhido] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const router = useRouter();

  const carregarModelos = useCallback(async () => {
    try {
      const r = await apiClient.get<{ data: { modelos: Modelo[] } }>(
        "/api/v1/demand-funnel-templates",
      );
      setModelos(r.data.modelos);
    } catch {
      setModelos([]);
    }
  }, []);

  useEffect(() => {
    if (podeEditar) void carregarModelos();
  }, [podeEditar, carregarModelos]);

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

  async function criarFunil(modeloId: string | null) {
    setCriando(true);
    try {
      await apiClient.post(`/api/v1/demand-campaigns/${c.id}/funnel`, {
        template_id: modeloId,
      });
      await queryClient.invalidateQueries({ queryKey: ["demand-campaigns"] });
      router.refresh();
    } catch (e) {
      showApiError(e);
    } finally {
      setCriando(false);
    }
  }

  async function renomearFunil(nome: string) {
    if (!c.pipeline_id) return;
    try {
      await apiClient.patch(`/api/v1/pipelines/${c.pipeline_id}`, { name: nome });
      await queryClient.invalidateQueries({ queryKey: ["demand-campaigns"] });
    } catch (e) {
      showApiError(e);
    }
  }

  async function salvarComoModelo() {
    if (!c.pipeline_id) return;
    const nome = window.prompt(t("Nome do modelo de funil"), funil?.name ?? c.name);
    if (!nome?.trim()) return;
    try {
      await apiClient.post("/api/v1/demand-funnel-templates", {
        name: nome.trim(),
        from_pipeline_id: c.pipeline_id,
      });
      await carregarModelos();
      setAviso(t("Modelo salvo. Use-o ao criar o funil de outra campanha."));
    } catch (e) {
      showApiError(e);
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

  // Sem funil: o convite para criar o da campanha (do zero ou de um modelo).
  if (!c.pipeline_id) {
    return (
      <section className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">{t("Funil de conversão")}</h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "Esta campanha ainda não tem funil. O funil é só dela: os leads que entram na campanha nascem na primeira etapa e andam até o fechamento.",
          )}
        </p>
        {podeEditar ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid grid-cols-1 content-start gap-2 rounded-xl border p-3">
              <p className="text-sm font-medium">{t("Começar do zero")}</p>
              <p className="text-xs text-muted-foreground">
                {t("Novo, Em andamento, Ganho e Perdido. Depois você ajusta etapa por etapa.")}
              </p>
              <button
                type="button"
                disabled={criando}
                onClick={() => void criarFunil(null)}
                className="inline-flex h-10 w-fit items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                <Plus size={14} weight="bold" aria-hidden />
                {criando ? t("Criando…") : t("Criar o funil desta campanha")}
              </button>
            </div>
            <div className="grid grid-cols-1 content-start gap-2 rounded-xl border p-3">
              <p className="text-sm font-medium">{t("Usar um modelo de funil")}</p>
              {modelos.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t(
                    "Nenhum modelo ainda. Monte um funil e use “Salvar como modelo” para repetir em outras campanhas.",
                  )}
                </p>
              ) : (
                <>
                  <select
                    className={CAMPO}
                    value={modeloEscolhido}
                    aria-label={t("Modelo de funil")}
                    onChange={(e) => setModeloEscolhido(e.target.value)}
                  >
                    <option value="">{t("Escolha um modelo")}</option>
                    {modelos.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.stages.length} {t("etapas")})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={criando || modeloEscolhido === ""}
                    onClick={() => void criarFunil(modeloEscolhido)}
                    className="inline-flex h-10 w-fit items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {criando ? t("Criando…") : t("Criar a partir do modelo")}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {t("O funil nasce com o nome da campanha. Você pode renomear depois.")}
                  </p>
                </>
              )}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  const lista = etapas ?? [];
  const atual = lista.find((e) => e.id === escolhida) ?? null;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 [&>*]:min-w-0">
      <section className="grid min-w-0 grid-cols-1 gap-4 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">{t("Funil de conversão")}</h2>
          <div className="flex flex-wrap gap-2">
            {podeEditar ? (
              <button
                type="button"
                onClick={() => void salvarComoModelo()}
                className="h-9 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary"
              >
                {t("Salvar como modelo")}
              </button>
            ) : null}
            <Link
              href={`/app/clientes?funil=${c.pipeline_id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary"
            >
              {t("Ver no CRM")}
              <ArrowRight size={14} weight="bold" aria-hidden />
            </Link>
          </div>
        </div>

        {podeEditar ? (
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">{t("Nome do funil")}</span>
            <NomeGravavel
              valor={funil?.name ?? c.name}
              desabilitado={!podeEditar}
              rotulo={t("Nome do funil")}
              aoGravar={(nome) => void renomearFunil(nome)}
            />
          </label>
        ) : null}
        {aviso ? (
          <p role="status" className="text-sm text-muted-foreground">
            {aviso}
          </p>
        ) : null}

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
                            : e.qualification === "mql"
                              ? "bg-info-bg text-info-fg"
                              : e.qualification === "disqualified"
                                ? "bg-warning-bg text-warning-fg"
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
                          : e.qualification === "mql"
                            ? t("Lead MQL")
                            : e.qualification === "disqualified"
                              ? t("Lead desqualificado")
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
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-dashed p-3">
                <p className="text-xs font-semibold tracking-wider text-text-subtle uppercase">
                  {t("Configurar a etapa")}{" "}
                  {String(lista.findIndex((e) => e.id === atual.id) + 1).padStart(2, "0")}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                      value={papelDe(atual)}
                      onChange={(ev) => {
                        const patch = patchDoPapel(atual, ev.target.value as Papel);
                        if (Object.keys(patch).length > 0) void mexer(atual.id, patch);
                      }}
                    >
                      <option value="nenhum">{t("Nada especial")}</option>
                      <option value="mql">{t("Lead MQL (qualificado)")}</option>
                      <option value="disqualified">{t("Lead desqualificado")}</option>
                      <option value="won">{t("Aqui o cliente fecha")}</option>
                      <option value="lost">{t("Aqui o cliente desiste")}</option>
                    </select>
                    {atual.qualification ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {atual.qualification === "mql"
                          ? t(
                              "Quando o lead entrar nesta etapa, o CRM o marca como MQL e avisa a Meta que ele é um lead qualificado (se veio de anúncio da Meta).",
                            )
                          : t(
                              "Quando o lead entrar nesta etapa, o CRM avisa a Meta que ele é um lead ruim (se veio de anúncio da Meta), para a otimização aprender.",
                            )}
                      </span>
                    ) : null}
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
                  <div className="flex flex-wrap items-end gap-2">
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
        <section className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 shadow-sm">
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
