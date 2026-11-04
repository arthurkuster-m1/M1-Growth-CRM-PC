"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { SecaoDaFicha } from "@/components/leads/SecaoDaFicha";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectDoApp } from "@/components/ui/SelectDoApp";
import { useAtalhoDesfazer } from "@/hooks/motor/useAtalhoDesfazer";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import type { TenantCounts, TenantOrganization } from "@/hooks/useTenantDetail";
import { useUpdateTenant, type EdicaoDaEmpresa } from "@/hooks/useUpdateTenant";
import { IDIOMAS } from "@/lib/i18n/idiomas";
import { copyToClipboard } from "@/lib/clipboard";
import { Copy } from "@/lib/ui/icons";

const MOEDAS = ["BRL", "USD", "EUR", "MXN", "ARS", "CLP", "COP"];
const PAISES = ["BR", "PT", "US", "MX", "AR", "CL", "CO", "ES"];
const FUSOS_BASE = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Fortaleza",
  "America/Mexico_City",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Santiago",
  "Europe/Lisbon",
  "Europe/Madrid",
  "America/New_York",
  "UTC",
];

type Salvar = (patch: EdicaoDaEmpresa, anterior: EdicaoDaEmpresa, rotulo: string) => void;

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-1 py-1.5 sm:grid-cols-[180px_1fr] sm:gap-4">
      <span className="text-xs text-text-muted">{rotulo}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Texto salvo ao sair do campo (ou Enter), só se mudou. `key` reinicia com o valor do servidor. */
function CampoDeTexto({
  rotulo,
  valor,
  obrigatorio,
  mono,
  placeholder,
  onSalvar,
}: {
  rotulo: string;
  valor: string | null;
  obrigatorio?: boolean;
  mono?: boolean;
  placeholder?: string;
  onSalvar: (novo: string | null, anterior: string | null) => void;
}) {
  const [texto, setTexto] = useState(valor ?? "");
  function confirmar() {
    const limpo = texto.trim();
    if (limpo === (valor ?? "")) return;
    if (obrigatorio && limpo === "") {
      setTexto(valor ?? "");
      return;
    }
    onSalvar(limpo === "" ? null : limpo, valor);
  }
  return (
    <Linha rotulo={rotulo}>
      <Input
        value={texto}
        placeholder={placeholder}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setTexto(valor ?? "");
        }}
        className={mono ? "font-mono" : undefined}
        aria-label={rotulo}
      />
    </Linha>
  );
}

function CampoDeSelecao({
  rotulo,
  valor,
  opcoes,
  onSalvar,
}: {
  rotulo: string;
  valor: string;
  opcoes: Array<{ id: string; nome: string }>;
  onSalvar: (novo: string, anterior: string) => void;
}) {
  const lista = opcoes.some((o) => o.id === valor)
    ? opcoes
    : [{ id: valor, nome: valor }, ...opcoes];
  return (
    <Linha rotulo={rotulo}>
      <SelectDoApp
        value={valor}
        aria-label={rotulo}
        onChange={(e) => e.target.value !== valor && onSalvar(e.target.value, valor)}
      >
        {lista.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nome}
          </option>
        ))}
      </SelectDoApp>
    </Linha>
  );
}

function CampoDeNumero({
  rotulo,
  valor,
  sufixo,
  vazioSignifica,
  onSalvar,
}: {
  rotulo: string;
  valor: number | null;
  sufixo?: string;
  vazioSignifica?: string;
  onSalvar: (novo: number | null, anterior: number | null) => void;
}) {
  const [texto, setTexto] = useState(valor === null ? "" : String(valor));
  function confirmar() {
    const limpo = texto.trim().replace(",", ".");
    const novo = limpo === "" ? null : Number(limpo);
    if (novo !== null && (!Number.isFinite(novo) || novo < 0)) {
      setTexto(valor === null ? "" : String(valor));
      return;
    }
    if (novo !== valor) onSalvar(novo, valor);
  }
  return (
    <Linha rotulo={rotulo}>
      <div className="flex items-center gap-2">
        <Input
          inputMode="decimal"
          value={texto}
          placeholder={vazioSignifica}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="max-w-40"
          aria-label={rotulo}
        />
        {sufixo ? <span className="text-xs text-text-muted">{sufixo}</span> : null}
      </div>
    </Linha>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  const tag = useTagDeIdioma();
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="text-lg font-semibold tabular-nums">{valor.toLocaleString(tag)}</div>
      <div className="text-xs text-text-muted">{rotulo}</div>
    </div>
  );
}

export function FichaDaEmpresa({
  organization: org,
  counts,
}: {
  organization: TenantOrganization;
  counts: TenantCounts;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  useAtalhoDesfazer();
  const { mutate } = useUpdateTenant(org.id);

  const salvar: Salvar = (patch, anterior, rotulo) =>
    mutate({ patch, anterior, rotulo }, { onError: (err) => showApiError(err) });

  const data = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(tag, { dateStyle: "short", timeStyle: "short" }) : "—";

  const fusos = (() => {
    try {
      const todos = (
        Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
      ).supportedValuesOf?.("timeZone");
      return todos && todos.length > 0 ? todos : FUSOS_BASE;
    } catch {
      return FUSOS_BASE;
    }
  })();

  const marca = ((org.settings as { branding?: { app_name?: string; accent_hex?: string } } | null)
    ?.branding ?? {}) as { app_name?: string; accent_hex?: string };

  const orcamentoReais = org.ai_budget_cents === null ? null : org.ai_budget_cents / 100;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <SecaoDaFicha id="empresa-identificacao" titulo={t("Identificação")}>
        <Linha rotulo={t("Identificador (slug)")}>
          <div className="flex items-center gap-2">
            <code className="rounded-md bg-secondary px-2 py-1 font-mono text-xs">{org.slug}</code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t("Copiar")}
              onClick={async () =>
                (await copyToClipboard(org.slug)) ? toast.success(t("Copiado")) : undefined
              }
            >
              <Copy size={14} aria-hidden />
            </Button>
            <span className="text-xs text-text-muted">
              {t("Não pode ser trocado depois de criado")}
            </span>
          </div>
        </Linha>
        <CampoDeTexto
          key={`dn-${org.display_name}`}
          rotulo={t("Nome")}
          valor={org.display_name}
          obrigatorio
          onSalvar={(novo, ant) =>
            salvar({ display_name: novo ?? "" }, { display_name: ant ?? "" }, t("Nome"))
          }
        />
        <CampoDeTexto
          key={`ln-${org.legal_name}`}
          rotulo={t("Razão social")}
          valor={org.legal_name}
          obrigatorio
          onSalvar={(novo, ant) =>
            salvar({ legal_name: novo ?? "" }, { legal_name: ant ?? "" }, t("Razão social"))
          }
        />
        <CampoDeTexto
          key={`cnpj-${org.cnpj}`}
          rotulo="CNPJ"
          valor={org.cnpj}
          mono
          onSalvar={(novo, ant) => salvar({ cnpj: novo }, { cnpj: ant }, "CNPJ")}
        />
        <Linha rotulo={t("Situação")}>
          <Badge variant={org.status === "active" ? "success" : "warning"}>
            {org.status === "active"
              ? t("Ativo")
              : org.status === "suspended"
                ? t("Suspenso")
                : t("Redigido")}
          </Badge>
          {org.suspended_reason ? (
            <span className="ml-2 text-xs text-text-muted">{org.suspended_reason}</span>
          ) : null}
        </Linha>
      </SecaoDaFicha>

      <SecaoDaFicha id="empresa-regiao" titulo={t("Região e idioma")}>
        <CampoDeSelecao
          rotulo={t("Fuso horário")}
          valor={org.timezone}
          opcoes={fusos.map((f) => ({ id: f, nome: f }))}
          onSalvar={(novo, ant) => salvar({ timezone: novo }, { timezone: ant }, t("Fuso horário"))}
        />
        <CampoDeSelecao
          rotulo={t("Idioma")}
          valor={org.locale}
          opcoes={IDIOMAS.map((i) => ({ id: i, nome: i }))}
          onSalvar={(novo, ant) => salvar({ locale: novo }, { locale: ant }, t("Idioma"))}
        />
        <CampoDeSelecao
          rotulo={t("Moeda")}
          valor={org.currency}
          opcoes={MOEDAS.map((m) => ({ id: m, nome: m }))}
          onSalvar={(novo, ant) => salvar({ currency: novo }, { currency: ant }, t("Moeda"))}
        />
        <CampoDeSelecao
          rotulo={t("País")}
          valor={org.country ?? "BR"}
          opcoes={PAISES.map((p) => ({ id: p, nome: p }))}
          onSalvar={(novo, ant) => salvar({ country: novo }, { country: ant }, t("País"))}
        />
      </SecaoDaFicha>

      <SecaoDaFicha id="empresa-lgpd" titulo={t("Privacidade (LGPD)")} padraoAberta={false}>
        <CampoDeTexto
          key={`dpo-${org.dpo_email}`}
          rotulo={t("E-mail do encarregado (DPO)")}
          valor={org.dpo_email}
          onSalvar={(novo, ant) =>
            salvar({ dpo_email: novo }, { dpo_email: ant }, t("E-mail do encarregado (DPO)"))
          }
        />
        <CampoDeTexto
          key={`pp-${org.privacy_policy_url}`}
          rotulo={t("Política de privacidade (link)")}
          valor={org.privacy_policy_url}
          placeholder="https://"
          onSalvar={(novo, ant) =>
            salvar(
              { privacy_policy_url: novo },
              { privacy_policy_url: ant },
              t("Política de privacidade (link)"),
            )
          }
        />
        <CampoDeNumero
          key={`ret-${org.media_retention_days}`}
          rotulo={t("Guardar mídias por")}
          valor={org.media_retention_days}
          sufixo={t("dias")}
          onSalvar={(novo, ant) =>
            novo !== null && novo >= 1
              ? salvar(
                  { media_retention_days: Math.round(novo) },
                  { media_retention_days: ant ?? 365 },
                  t("Guardar mídias por"),
                )
              : undefined
          }
        />
      </SecaoDaFicha>

      <SecaoDaFicha id="empresa-ia" titulo={t("Limite de IA")} padraoAberta={false}>
        <CampoDeNumero
          key={`ia-${org.ai_budget_cents}`}
          rotulo={t("Orçamento mensal de IA")}
          valor={orcamentoReais}
          sufixo={org.currency}
          vazioSignifica={t("Sem limite")}
          onSalvar={(novo, ant) =>
            salvar(
              { ai_budget_cents: novo === null ? null : Math.round(novo * 100) },
              { ai_budget_cents: ant === null ? null : Math.round(ant * 100) },
              t("Orçamento mensal de IA"),
            )
          }
        />
      </SecaoDaFicha>

      <SecaoDaFicha id="empresa-marca" titulo={t("Marca")} padraoAberta={false}>
        <CampoDeTexto
          key={`mn-${marca.app_name ?? ""}`}
          rotulo={t("Nome na marca")}
          valor={marca.app_name ?? null}
          placeholder={t("Igual ao da instalação")}
          onSalvar={(novo, ant) =>
            salvar(
              { marca: { app_name: novo, accent_hex: marca.accent_hex ?? null } },
              { marca: { app_name: ant, accent_hex: marca.accent_hex ?? null } },
              t("Nome na marca"),
            )
          }
        />
        <CampoDeTexto
          key={`mc-${marca.accent_hex ?? ""}`}
          rotulo={t("Cor principal")}
          valor={marca.accent_hex ?? null}
          mono
          placeholder="#366D6F"
          onSalvar={(novo, ant) =>
            salvar(
              { marca: { app_name: marca.app_name ?? null, accent_hex: novo } },
              { marca: { app_name: marca.app_name ?? null, accent_hex: ant } },
              t("Cor principal"),
            )
          }
        />
      </SecaoDaFicha>

      <SecaoDaFicha id="empresa-interface" titulo={t("Áreas de trabalho")} padraoAberta={false}>
        <CampoDeSelecao
          rotulo={t("Interface")}
          valor={org.interface_settings?.preset ?? "completa"}
          opcoes={[
            { id: "completa", nome: t("Completa") },
            { id: "simplificada", nome: t("Simplificada") },
          ]}
          onSalvar={(novo, ant) =>
            salvar(
              { interface_settings: { preset: novo as "completa" | "simplificada" } },
              { interface_settings: { preset: ant as "completa" | "simplificada" } },
              t("Interface"),
            )
          }
        />
      </SecaoDaFicha>

      <SecaoDaFicha id="empresa-volumes" titulo={t("Volumes")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Numero rotulo={t("Usuários")} valor={counts.user_count} />
          <Numero rotulo={t("Conversas")} valor={counts.conversations_count} />
          <Numero rotulo={t("Mensagens")} valor={counts.messages_count} />
          <Numero rotulo={t("Leads")} valor={counts.leads_count} />
          <Numero rotulo={t("Pedidos")} valor={counts.orders_count} />
        </div>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-text-muted">{t("Solicitações LGPD pendentes")}</dt>
            <dd className="font-medium">{counts.lgpd_requests_pending}</dd>
          </div>
          <div>
            <dt className="text-text-muted">{t("Invocações IA (30d)")}</dt>
            <dd className="font-medium">{counts.ai_invocations_30d.toLocaleString(tag)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">{t("Sessões de WhatsApp")}</dt>
            <dd className="font-medium">{counts.waha_sessions_count}</dd>
          </div>
        </dl>
      </SecaoDaFicha>

      <SecaoDaFicha id="empresa-datas" titulo={t("Datas")} padraoAberta={false}>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
          <div>
            <dt className="text-text-muted">{t("Criada em")}</dt>
            <dd className="font-medium">{data(org.created_at)}</dd>
          </div>
          <div>
            <dt className="text-text-muted">{t("Onboarding concluído")}</dt>
            <dd className="font-medium">{data(org.onboarded_at)}</dd>
          </div>
          {org.suspended_at ? (
            <div>
              <dt className="text-text-muted">{t("Suspensa em")}</dt>
              <dd className="font-medium">{data(org.suspended_at)}</dd>
            </div>
          ) : null}
        </dl>
      </SecaoDaFicha>
    </div>
  );
}
