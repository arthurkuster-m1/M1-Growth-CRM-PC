"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { Plus } from "@/lib/ui/icons";
import { EXEMPLO_DE_ENVIO } from "@/components/marketing/campanhas/EntradaDeLeads";

interface Fonte {
  id: string;
  name: string;
  ativa: boolean;
  desta_campanha: boolean;
  de_outra_campanha: boolean;
  ultimo_recebimento: string | null;
  url: string;
}

/**
 * OS WEBHOOKS DA CAMPANHA: o endereço que recebe os leads (do n8n, da LP ou de qualquer sistema)
 * já ligado à campanha. É o mesmo cadastro de Conexões › Webhooks — criar aqui ou lá dá no
 * mesmo, e a gestão de todos continua em Conexões. Quem monta a campanha pega o link final sem
 * trocar de aba.
 */
export function WebhooksDaCampanha({
  campanhaId,
  nomeDaCampanha,
  podeEditar,
  temFunil,
}: {
  campanhaId: string;
  nomeDaCampanha: string;
  podeEditar: boolean;
  temFunil: boolean;
}) {
  const t = useT();
  const [fontes, setFontes] = useState<Fonte[] | null>(null);
  const [nome, setNome] = useState(`${nomeDaCampanha} — webhook`);
  const [criando, setCriando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await apiClient.get<{ data: { fontes: Fonte[] } }>(
        `/api/v1/demand-campaigns/${campanhaId}/entrada`,
      );
      setFontes(r.data.fontes);
    } catch {
      setFontes([]);
    }
  }, [campanhaId]);

  useEffect(() => {
    if (podeEditar) void carregar();
  }, [podeEditar, carregar]);

  async function criar() {
    setCriando(true);
    setErro(null);
    try {
      await apiClient.post(`/api/v1/demand-campaigns/${campanhaId}/webhook`, { name: nome.trim() });
      await carregar();
    } catch (e) {
      const msg = (e as { message?: string } | null)?.message;
      setErro(msg ?? t("Não foi possível criar o webhook."));
      showApiError(e);
    } finally {
      setCriando(false);
    }
  }

  async function ligar(f: Fonte, ligar: boolean) {
    try {
      await apiClient.put(`/api/v1/demand-campaigns/${campanhaId}/entrada`, {
        source_id: f.id,
        ligar,
      });
      await carregar();
    } catch (e) {
      showApiError(e);
    }
  }

  async function copiar(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(url);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      /* sem permissão: o endereço está na tela */
    }
  }

  if (!podeEditar) return null;
  const desta = (fontes ?? []).filter((f) => f.desta_campanha);
  const outras = (fontes ?? []).filter((f) => !f.desta_campanha && !f.de_outra_campanha);

  return (
    <section className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("Webhooks desta campanha")}</h2>
        <Link
          href="/app/webhooks"
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          {t("Gerir todos os webhooks em Conexões")}
        </Link>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "O endereço que recebe os leads desta campanha — do n8n, do formulário da LP ou de outro sistema. Aceita qualquer campo: o que chegar vira informação do lead, e o lead nasce no funil da campanha com a origem.",
        )}
      </p>

      {fontes === null ? (
        <div className="h-16 animate-pulse rounded-xl bg-secondary" aria-busy="true" />
      ) : desta.length === 0 ? (
        <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          {t("Nenhum webhook nesta campanha ainda.")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {desta.map((f) => (
            <li key={f.id} className="grid grid-cols-1 gap-1.5 rounded-xl bg-secondary/50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{f.name}</span>
                <span className="text-xs text-muted-foreground">
                  {f.ultimo_recebimento
                    ? `${t("Último lead")}: ${new Date(f.ultimo_recebimento).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                    : t("Ainda não recebeu leads")}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 basis-64 overflow-x-auto rounded-lg bg-card px-2 py-1.5 text-xs break-all">
                  {f.url}
                </code>
                <button
                  type="button"
                  onClick={() => void copiar(f.url)}
                  className="h-9 rounded-xl border px-3 text-sm font-medium whitespace-nowrap hover:bg-secondary"
                >
                  {copiado === f.url ? t("Copiado!") : t("Copiar link")}
                </button>
                <button
                  type="button"
                  onClick={() => void ligar(f, false)}
                  className="h-9 rounded-xl px-3 text-sm text-muted-foreground hover:bg-secondary hover:text-error-fg"
                >
                  {t("Desligar da campanha")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Criar ou ligar um webhook fica recolhido: aberto só quando a campanha ainda não tem nenhum. */}
      <details
        className="group rounded-xl border border-dashed"
        open={fontes !== null && desta.length === 0}
      >
        <summary className="flex cursor-pointer list-none items-center gap-2 p-3 text-sm font-medium">
          <span
            aria-hidden
            className="inline-block text-xs text-muted-foreground transition-transform group-open:rotate-90"
          >
            ▶
          </span>
          {t("Criar ou ligar um webhook")}
        </summary>
        <div className="grid grid-cols-1 gap-2 p-3 pt-0">
          {temFunil ? (
            <>
              <p className="text-sm font-medium">{t("Criar webhook")}</p>
              <div className="flex flex-wrap gap-2">
                <input
                  value={nome}
                  maxLength={120}
                  onChange={(e) => setNome(e.target.value)}
                  aria-label={t("Nome do webhook")}
                  className="h-10 min-w-0 flex-1 basis-60 rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="button"
                  disabled={criando || nome.trim() === ""}
                  onClick={() => void criar()}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium whitespace-nowrap text-primary-foreground disabled:opacity-50"
                >
                  <Plus size={14} weight="bold" aria-hidden />
                  {criando ? t("Criando…") : t("Criar webhook")}
                </button>
              </div>
              {erro ? (
                <p role="alert" className="text-xs text-error-fg">
                  {erro}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t(
                "Para criar o webhook, primeiro crie o funil da campanha na aba Funil de conversão: é nele que os leads vão nascer.",
              )}
            </p>
          )}
          {outras.length > 0 ? (
            <label className="grid grid-cols-1 gap-1">
              <span className="text-xs text-muted-foreground">
                {t("Ou ligar um webhook que já existe")}
              </span>
              <select
                className="h-10 rounded-xl border bg-background px-3 text-sm"
                value=""
                onChange={(e) => {
                  const f = outras.find((x) => x.id === e.target.value);
                  if (f) void ligar(f, true);
                }}
              >
                <option value="">{t("Escolha um webhook")}</option>
                {outras.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </details>

      <details className="rounded-xl border p-2">
        <summary className="cursor-pointer text-sm font-medium">
          {t("Exemplo do que enviar (POST, JSON)")}
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-secondary p-2 text-xs">
          {EXEMPLO_DE_ENVIO}
        </pre>
      </details>
    </section>
  );
}
