"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface Fonte {
  id: string;
  name: string;
  ativa: boolean;
  desta_campanha: boolean;
  de_outra_campanha: boolean;
  ultimo_recebimento: string | null;
}

/** O modelo de parâmetros que a Meta preenche sozinha em cada anúncio. */
export const MODELO_DE_UTM_DA_META =
  "utm_source=meta&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}&utm_id={{campaign.id}}";

function Cartao({
  titulo,
  estado,
  children,
}: {
  titulo: string;
  estado?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid content-start gap-2 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {estado ? (
          <span className="rounded-lg bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {estado}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/**
 * COMO OS LEADS CHEGAM a esta campanha: as quatro portas, cada uma com o que fazer para ela
 * funcionar. Tudo cai no funil da campanha e carrega a origem (campanha, LP, criativo).
 */
export function EntradaDeLeads({
  campanhaId,
  podeEditar,
  temFunil,
}: {
  campanhaId: string;
  podeEditar: boolean;
  temFunil: boolean;
}) {
  const t = useT();
  const [fontes, setFontes] = useState<Fonte[] | null>(null);
  const [copiado, setCopiado] = useState(false);

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

  async function ligar(fonte: Fonte, ligar: boolean) {
    try {
      await apiClient.put(`/api/v1/demand-campaigns/${campanhaId}/entrada`, {
        source_id: fonte.id,
        ligar,
      });
      await carregar();
    } catch (e) {
      showApiError(e);
    }
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(MODELO_DE_UTM_DA_META);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* sem permissão de área de transferência: o texto está na tela */
    }
  }

  const ligadas = (fontes ?? []).filter((f) => f.desta_campanha);

  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold">{t("Como os leads chegam a esta campanha")}</h2>
        <p className="text-xs text-muted-foreground">
          {temFunil
            ? t(
                "Todo lead que chegar por uma destas portas nasce na primeira etapa do funil da campanha e carrega de onde veio.",
              )
            : t("Crie o funil da campanha abaixo: é nele que os leads vão nascer.")}
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Cartao
          titulo={t("Formulário de landing page")}
          estado={ligadas.length > 0 ? `${ligadas.length} ${t("ligado(s)")}` : t("Não ligado")}
        >
          <p className="text-xs text-muted-foreground">
            {t(
              "Ligue o formulário da LP a esta campanha. Os leads dele entram aqui, e as UTMs da URL dizem de qual anúncio vieram.",
            )}
          </p>
          {fontes === null ? (
            <div className="h-10 animate-pulse rounded-xl bg-secondary" aria-busy="true" />
          ) : fontes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("Nenhum formulário cadastrado ainda.")}{" "}
              <Link className="text-primary underline" href="/app/webhooks">
                {t("Criar um formulário")}
              </Link>
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {fontes.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{f.name}</span>
                    {f.de_outra_campanha ? (
                      <span className="block text-xs text-muted-foreground">
                        {t("Ligado a outra campanha")}
                      </span>
                    ) : null}
                  </span>
                  {podeEditar ? (
                    <button
                      type="button"
                      onClick={() => void ligar(f, !f.desta_campanha)}
                      className={cn(
                        "h-8 shrink-0 rounded-lg border px-3 text-xs font-medium whitespace-nowrap",
                        f.desta_campanha ? "border-primary bg-primary/10" : "hover:bg-secondary",
                      )}
                    >
                      {f.desta_campanha ? t("Ligado") : t("Ligar")}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao titulo={t("Parâmetros (UTM) dos anúncios")} estado={t("Copie e cole no anúncio")}>
          <p className="text-xs text-muted-foreground">
            {t(
              "No anúncio do Meta, cole isto em “Parâmetros de URL”. A Meta troca cada {{…}} pelo código da campanha, do conjunto e do anúncio, e o CRM casa com esta campanha e com o criativo.",
            )}
          </p>
          <pre className="overflow-x-auto rounded-lg bg-secondary p-2 text-xs">
            {MODELO_DE_UTM_DA_META}
          </pre>
          <button
            type="button"
            onClick={() => void copiar()}
            className="h-9 w-fit rounded-xl border px-3 text-sm font-medium hover:bg-secondary"
          >
            {copiado ? t("Copiado!") : t("Copiar parâmetros")}
          </button>
          <p className="text-xs text-muted-foreground">
            {t(
              "Para o casamento ser exato, escolha as campanhas do Meta na aba Cadastro e importe os criativos do Meta.",
            )}
          </p>
        </Cartao>

        <Cartao titulo={t("Anúncio que abre o WhatsApp")} estado={t("Automático")}>
          <p className="text-xs text-muted-foreground">
            {t(
              "Quando alguém clica no anúncio e chama no WhatsApp, o CRM reconhece o anúncio e põe o lead no funil desta campanha. Funciona com as campanhas do Meta atreladas e com os criativos importados.",
            )}
          </p>
        </Cartao>

        <Cartao titulo={t("Formulário de lead do Meta")} estado={t("Pelo formulário ligado")}>
          <p className="text-xs text-muted-foreground">
            {t(
              "Envie os leads do formulário nativo do Meta para o formulário ligado acima (por Zapier, Make ou pela integração do Meta), incluindo os campos ad_id e campaign_id. O CRM usa esses campos para achar a campanha e o criativo.",
            )}
          </p>
        </Cartao>

        <Cartao titulo={t("Prospecção ativa e cadastro manual")} estado={t("Automático")}>
          <p className="text-xs text-muted-foreground">
            {t(
              "Lead cadastrado direto no funil desta campanha (um por um, ou por planilha) já conta como da campanha.",
            )}
          </p>
          <Link
            href="/app/clientes"
            className="inline-flex h-9 w-fit items-center rounded-xl border px-3 text-sm font-medium hover:bg-secondary"
          >
            {t("Abrir Clientes (CRM)")}
          </Link>
        </Cartao>
      </div>
    </section>
  );
}
