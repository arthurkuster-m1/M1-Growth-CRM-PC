"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StagesSection } from "@/app/app/settings/tenant/pipelines/_stages";
import { useT } from "@/hooks/i18n/useT";
import { useArquivarFunil, useCriarFunil, useEditarFunil } from "@/hooks/pipelines/usePipelines";
import { apiClient } from "@/lib/api/client";
import { ArrowRight, Plus } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

export interface FunilDaGestao {
  id: string;
  name: string;
  is_default: boolean;
  /** Para onde o lead vai quando ganha neste funil (settings.ao_ganhar_funil_id). */
  ao_ganhar_funil_id: string | null;
  etapas: number;
  leads: number;
}

const CAMPO =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

/**
 * Os FUNIS do cliente, criados pela agência dentro de Geração de demanda: cada funil tem as
 * suas etapas e, se quiser, o funil para onde o lead vai quando ganha (ex.: Tráfego → Pós-venda).
 * Os leads ficam todos no mesmo banco; o funil é uma propriedade do lead.
 */
export function GestaoDeFunis({
  funis,
  podeGerir,
}: {
  funis: FunilDaGestao[];
  podeGerir: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [escolhidoId, setEscolhidoId] = useState<string | null>(funis[0]?.id ?? null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [nome, setNome] = useState("");
  const criar = useCriarFunil();
  const editar = useEditarFunil();
  const arquivar = useArquivarFunil();
  const [nomeEditado, setNomeEditado] = useState<{ id: string; valor: string } | null>(null);
  const [confirmaArquivar, setConfirmaArquivar] = useState(false);

  const escolhido = funis.find((f) => f.id === escolhidoId) ?? funis[0] ?? null;

  async function criarFunil() {
    const n = nome.trim();
    if (!n) return;
    try {
      const r = await criar.mutateAsync(n);
      const novo = r.data.pipelines.find((p) => p.name === n) ?? r.data.pipelines.at(-1);
      setNome("");
      setNovoAberto(false);
      if (novo) setEscolhidoId(novo.id);
      router.refresh();
    } catch (e) {
      showApiError(e);
    }
  }

  async function renomear(id: string, valor: string) {
    const v = valor.trim();
    if (!v || v === funis.find((f) => f.id === id)?.name) return;
    try {
      await editar.mutateAsync({ id, patch: { name: v } });
    } catch (e) {
      showApiError(e);
    }
  }

  async function definirAoGanhar(id: string, destino: string) {
    try {
      await apiClient.put(`/api/v1/pipelines/${id}/ao-ganhar`, {
        funil_destino_id: destino === "" ? null : destino,
      });
      router.refresh();
    } catch (e) {
      showApiError(e);
    }
  }

  async function arquivarFunil(id: string) {
    try {
      await arquivar.mutateAsync({ id });
      setConfirmaArquivar(false);
      setEscolhidoId(null);
      router.refresh();
    } catch (e) {
      showApiError(e);
    }
  }

  return (
    <section aria-label={t("Funis")} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("Funis do cliente")}</h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "Cada funil tem as suas etapas. Todos os leads ficam no mesmo banco, e o funil é uma propriedade deles.",
            )}
          </p>
        </div>
        {podeGerir ? (
          <button
            type="button"
            onClick={() => setNovoAberto(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium whitespace-nowrap text-primary-foreground"
          >
            <Plus size={14} weight="bold" aria-hidden />
            {t("Novo funil")}
          </button>
        ) : null}
      </div>

      {funis.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          {t("Nenhum funil ainda. Crie o primeiro em “Novo funil”.")}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <ul className="grid content-start gap-2">
            {funis.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => setEscolhidoId(f.id)}
                  aria-pressed={escolhido?.id === f.id}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-2xl border-[1.5px] bg-card p-3 text-left transition-colors",
                    escolhido?.id === f.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {f.name}
                    {f.is_default ? (
                      <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {t("Padrão")}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {f.etapas} {t("etapas")} · {f.leads} {t("leads")}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {escolhido ? (
            <div className="grid content-start gap-5 rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-0 flex-1 basis-56">
                  <span className="mb-1 block text-xs text-muted-foreground">
                    {t("Nome do funil")}
                  </span>
                  <input
                    key={escolhido.id}
                    defaultValue={escolhido.name}
                    maxLength={80}
                    disabled={!podeGerir}
                    onChange={(e) => setNomeEditado({ id: escolhido.id, valor: e.target.value })}
                    onBlur={() =>
                      nomeEditado?.id === escolhido.id
                        ? void renomear(escolhido.id, nomeEditado.valor)
                        : undefined
                    }
                    className={CAMPO}
                  />
                </label>
                <Link
                  href={`/app/clientes?funil=${escolhido.id}`}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary"
                >
                  {t("Ver no CRM")}
                  <ArrowRight size={14} weight="bold" aria-hidden />
                </Link>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">
                  {t("Quando o lead ganhar neste funil, ele entra em")}
                </span>
                <select
                  value={escolhido.ao_ganhar_funil_id ?? ""}
                  disabled={!podeGerir}
                  onChange={(e) => void definirAoGanhar(escolhido.id, e.target.value)}
                  className={CAMPO}
                >
                  <option value="">{t("Nenhum (só fica como ganho)")}</option>
                  {funis
                    .filter((f) => f.id !== escolhido.id)
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

              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("Etapas")}</h3>
                {podeGerir ? (
                  <StagesSection pipelineId={escolhido.id} ancoraMapeamento="" />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("Só a agência edita as etapas.")}
                  </p>
                )}
              </div>

              {podeGerir && !escolhido.is_default ? (
                <div className="border-t pt-3">
                  <button
                    type="button"
                    onClick={() => setConfirmaArquivar(true)}
                    className="h-9 rounded-xl border px-3 text-sm font-medium text-error-fg hover:bg-error-bg"
                  >
                    {t("Arquivar funil")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={novoAberto} onOpenChange={setNovoAberto}>
        <DialogContent className="max-w-md gap-3 p-5 sm:rounded-2xl">
          <DialogTitle className="text-base font-semibold">{t("Novo funil")}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t(
              "Dê um nome (ex.: Outbound, Tráfego pago, Indicação). As etapas você ajusta depois.",
            )}
          </DialogDescription>
          <input
            value={nome}
            maxLength={80}
            autoFocus
            placeholder={t("Nome do funil")}
            aria-label={t("Nome do funil")}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void criarFunil()}
            className={CAMPO}
          />
          <button
            type="button"
            disabled={nome.trim() === "" || criar.isPending}
            onClick={() => void criarFunil()}
            className="h-10 rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {t("Criar funil")}
          </button>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmaArquivar} onOpenChange={setConfirmaArquivar}>
        <DialogContent className="max-w-md gap-3 p-5 sm:rounded-2xl">
          <DialogTitle className="text-base font-semibold">{t("Arquivar funil")}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("O funil sai das listas e dos formulários. Os leads e o histórico ficam guardados.")}
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmaArquivar(false)}
              className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-secondary"
            >
              {t("Cancelar")}
            </button>
            <button
              type="button"
              onClick={() => escolhido && void arquivarFunil(escolhido.id)}
              className="h-10 rounded-xl bg-error px-4 text-sm font-medium text-white"
            >
              {t("Arquivar")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
