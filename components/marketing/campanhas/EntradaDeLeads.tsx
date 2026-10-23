"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { CaretDown, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

interface Fonte {
  id: string;
  name: string;
  ativa: boolean;
  desta_campanha: boolean;
  de_outra_campanha: boolean;
  ultimo_recebimento: string | null;
  url: string;
}

/** O modelo de parâmetros que a Meta preenche sozinha em cada anúncio. */
/** Exemplo do que o n8n (ou qualquer sistema) pode mandar: os campos mudam de funil para funil. */
export const EXEMPLO_DE_ENVIO = `{
  "external_id": "id-unico-do-envio",
  "lead": { "nome": "Ana Souza", "telefone": "11912345678", "email": "ana@exemplo.com" },
  "respostas": { "orcamento": "R$ 5 mil", "interesse": ["rinoplastia", "lipo"] },
  "agendamento": { "data": "2026-10-20", "hora": "14:00" },
  "utm": { "campaign": "120001", "content": "9001", "term": "456" },
  "page_url": "https://sualp.com.br/oferta"
}`;

export const MODELO_DE_UTM_DA_META =
  "utm_source=meta&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}&utm_id={{campaign.id}}";

/** Uma "porta" de entrada: linha que abre para mostrar o que fazer. */
function Porta({
  numero,
  titulo,
  resumo,
  estado,
  tom = "neutro",
  aberta,
  children,
}: {
  numero: string;
  titulo: string;
  resumo: string;
  estado: string;
  tom?: "neutro" | "ok";
  aberta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={aberta} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 hover:bg-secondary/40 sm:px-4 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 grid-cols-1 place-items-center rounded-full bg-secondary font-mono text-xs font-semibold text-muted-foreground"
        >
          {numero}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{titulo}</span>
          <span className="block truncate text-xs text-muted-foreground">{resumo}</span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-lg px-2 py-0.5 text-xs font-medium",
            tom === "ok" ? "bg-success-bg text-success-fg" : "bg-secondary text-muted-foreground",
          )}
        >
          {estado}
        </span>
        <span
          aria-hidden
          className="shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
        >
          ›
        </span>
      </summary>
      <div className="grid grid-cols-1 gap-3 border-t bg-secondary/20 px-3 py-4 sm:px-4 sm:pl-[3.75rem]">
        {children}
      </div>
    </details>
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
  // Como o "Dia a dia": começa fechado, para a aba abrir direto no funil.
  const [aberto, setAberto] = useState(false);
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
    <section className="grid grid-cols-1 gap-3 rounded-2xl border border-l-4 border-l-teal-500 bg-card shadow-sm">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-start gap-2 px-4 pt-4 pb-1 text-left"
      >
        <span className="mt-0.5 shrink-0">
          {aberto ? (
            <CaretDown size={14} weight="bold" aria-hidden />
          ) : (
            <CaretRight size={14} weight="bold" aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">
            {t("Como os leads chegam a esta campanha")}
          </span>
          <span className="block text-xs text-muted-foreground">
            {temFunil
              ? t(
                  "Todo lead que chegar por uma destas portas nasce na primeira etapa do funil da campanha e carrega de onde veio.",
                )
              : t("Crie o funil da campanha acima: é nele que os leads vão nascer.")}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {aberto ? t("Fechar") : t("Abrir")}
        </span>
      </button>

      {aberto ? (
        <div className="divide-y border-t">
          <Porta
            numero="1"
            titulo={t("Receber leads já tratados (n8n, Zapier ou sistema próprio)")}
            resumo={t("Um endereço (URL) que aceita qualquer campo")}
            estado={ligadas.length > 0 ? `${ligadas.length} ${t("ligado(s)")}` : t("Não ligado")}
            tom={ligadas.length > 0 ? "ok" : "neutro"}
            aberta={ligadas.length > 0}
          >
            <p className="text-sm text-muted-foreground">
              {t(
                "O sistema aceita qualquer JSON: nome, telefone e e-mail são reconhecidos, todo o resto (perguntas, respostas, agendamento, listas e objetos) vira informação do lead, e as UTMs dizem a origem.",
              )}
            </p>
            {fontes === null ? (
              <div className="h-10 animate-pulse rounded-xl bg-secondary" aria-busy="true" />
            ) : fontes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("Nenhuma fonte de leads cadastrada ainda.")}{" "}
                <Link className="text-primary underline" href="/app/webhooks">
                  {t("Criar uma fonte de leads")}
                </Link>
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-2">
                {fontes.map((f) => (
                  <li
                    key={f.id}
                    className="grid grid-cols-1 gap-1.5 rounded-xl border bg-card px-3 py-2 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{f.name}</span>
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
                            f.desta_campanha
                              ? "border-primary bg-primary/10"
                              : "hover:bg-secondary",
                          )}
                        >
                          {f.desta_campanha ? t("Ligado") : t("Ligar")}
                        </button>
                      ) : null}
                    </div>
                    {f.desta_campanha ? (
                      <code className="block overflow-x-auto rounded-lg bg-secondary px-2 py-1.5 text-xs break-all">
                        {f.url}
                      </code>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <details className="rounded-xl border bg-card p-2">
              <summary className="cursor-pointer text-sm font-medium">
                {t("Exemplo do que enviar (POST, JSON)")}
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-secondary p-2 text-xs">
                {EXEMPLO_DE_ENVIO}
              </pre>
              <p className="mt-2 text-xs text-muted-foreground">
                {t(
                  "O external_id evita lead duplicado se o n8n reenviar. Se a pessoa já existe (mesmo telefone), o lead é atualizado e não duplica.",
                )}
              </p>
            </details>
          </Porta>

          <Porta
            numero="2"
            titulo={t("Parâmetros (UTM) dos anúncios")}
            resumo={t("Para saber de qual anúncio e criativo cada lead veio")}
            estado={t("Copie e cole no anúncio")}
          >
            <p className="text-sm text-muted-foreground">
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
              className="h-9 w-fit rounded-xl border bg-card px-3 text-sm font-medium hover:bg-secondary"
            >
              {copiado ? t("Copiado!") : t("Copiar parâmetros")}
            </button>
            <p className="text-xs text-muted-foreground">
              {t(
                "Para o casamento ser exato, escolha as campanhas do Meta na aba Cadastro e importe os criativos do Meta.",
              )}
            </p>
          </Porta>

          <Porta
            numero="3"
            titulo={t("Anúncio que abre o WhatsApp")}
            resumo={t("O CRM reconhece o anúncio na primeira mensagem")}
            estado={t("Automático")}
            tom="ok"
          >
            <p className="text-sm text-muted-foreground">
              {t(
                "Quando alguém clica no anúncio e chama no WhatsApp, o CRM reconhece o anúncio e põe o lead no funil desta campanha. Funciona com as campanhas do Meta atreladas e com os criativos importados.",
              )}
            </p>
          </Porta>

          <Porta
            numero="4"
            titulo={t("Formulário de lead do Meta")}
            resumo={t("Enviar pelo webhook da porta 1, com ad_id e campaign_id")}
            estado={t("Pelo webhook")}
          >
            <p className="text-sm text-muted-foreground">
              {t(
                "Envie os leads do formulário nativo do Meta para o webhook ligado acima (por Zapier, Make ou pela integração do Meta), incluindo os campos ad_id e campaign_id. O CRM usa esses campos para achar a campanha e o criativo.",
              )}
            </p>
          </Porta>

          <Porta
            numero="5"
            titulo={t("Prospecção ativa e cadastro manual")}
            resumo={t("Lead cadastrado no funil da campanha já conta")}
            estado={t("Automático")}
            tom="ok"
          >
            <p className="text-sm text-muted-foreground">
              {t(
                "Lead cadastrado direto no funil desta campanha (um por um, ou por planilha) já conta como da campanha.",
              )}
            </p>
            <Link
              href="/app/clientes"
              className="inline-flex h-9 w-fit items-center rounded-xl border bg-card px-3 text-sm font-medium hover:bg-secondary"
            >
              {t("Abrir Clientes (CRM)")}
            </Link>
          </Porta>
        </div>
      ) : null}
    </section>
  );
}
