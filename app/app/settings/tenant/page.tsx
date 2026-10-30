import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
import { traduzir } from "@/lib/i18n/dicionario";
import { marcaDaInstalacao } from "@/lib/branding/instalacao";
import { marcaDaOrganizacaoDeSettings } from "@/lib/branding/organizacao";
import { env } from "@/lib/env";
import { moedaServidaOu } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { FormularioDaMarcaDaOrganizacao } from "../marca/_form";
import { ZonaDePerigoDaOrganizacao } from "./_danger-zone";
import { TenantForm } from "./_form";
import { InterfaceDaEmpresaForm } from "./_interface";

export const dynamic = "force-dynamic";

interface OrgRow {
  display_name: string;
  legal_name: string;
  cnpj: string | null;
  country: string | null;
  timezone: string;
  locale: string;
  currency: string;
  media_retention_days: number;
  media_retention_enforced: boolean;
  dpo_email: string | null;
  privacy_policy_url: string | null;
  /** Portas escolhidas pela EMPRESA (issue #1341). Opaco aqui: quem lê é `lerInterface`. */
  interface_settings: unknown;
  /** Onde mora a marca da organização (`settings.branding`). Opaco aqui: quem lê é `marcaDaOrganizacaoDeSettings`. */
  settings: unknown;
}

export default async function TenantSettingsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!(user.is_platform_admin && !user.support) && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select(
      "display_name, legal_name, cnpj, country, timezone, locale, currency, media_retention_days, media_retention_enforced, dpo_email, privacy_policy_url, interface_settings, settings",
    )
    .eq("id", activeOrg.orgId)
    .maybeSingle();

  const row = (data ?? null) as OrgRow | null;
  const idioma = user.idioma;
  const gravada = marcaDaOrganizacaoDeSettings(row?.settings ?? null);
  const linha = await marcaDaInstalacao();

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{traduzir("Sua empresa e marca", idioma)}</h1>
        <p className="text-sm text-muted-foreground">
          {traduzir("Dados da empresa, nome e cor da marca, retenção de mídia e DPO. Só administradores.", idioma)}
        </p>
      </header>
      {row && (
        <TenantForm
          initial={{
            display_name: row.display_name,
            legal_name: row.legal_name,
            cnpj: row.cnpj,
            // `null` na coluna é Brasil (migration 0277): o seletor não tem
            // opção vazia, então o país padrão aparece EXPLÍCITO. Salvar sem
            // trocar nada grava `BR` onde estava `null` — mesmo país, mesma
            // lei, mesmo calendário; o que muda é a linha deixar de depender
            // do default implícito.
            country: row.country ?? "BR",
            timezone: row.timezone,
            // `en-US` saiu da lista (nunca teve tradução). Uma linha antiga
            // com ele cai no padrão em vez de quebrar a tela.
            locale: normalizarIdioma(row.locale),
            currency: moedaServidaOu(row.currency),
            media_retention_days: row.media_retention_days,
            media_retention_enforced: row.media_retention_enforced,
            dpo_email: row.dpo_email,
            privacy_policy_url: row.privacy_policy_url,
          }}
        />
      )}
      {row && (
        <section aria-labelledby="marca-da-empresa" className="flex flex-col gap-3">
          <div>
            <h2 id="marca-da-empresa" className="text-lg font-semibold tracking-tight">
              {traduzir("Marca", idioma)}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {traduzir(
                "O nome e a cor que a sua empresa mostra para quem trabalha aqui dentro.",
                idioma,
              )}
            </p>
          </div>
          <FormularioDaMarcaDaOrganizacao
            gravada={{
              app_name: gravada?.app_name ?? null,
              accent_hex: gravada?.accent_hex ?? null,
              logo_path: gravada?.logo_path ?? null,
            }}
            instalacao={{
              app_name: linha?.app_name ?? null,
              logo_url: linha?.logo_url ?? null,
              logo_path: linha?.logo_path ?? null,
              accent_hex: linha?.accent_hex ?? null,
            }}
            ambiente={{
              APP_NAME: env.APP_NAME,
              APP_LOGO_URL: env.APP_LOGO_URL,
              APP_ACCENT_HEX: env.APP_ACCENT_HEX,
            }}
          />
        </section>
      )}
      {row && (
        <InterfaceDaEmpresaForm
          initial={row.interface_settings}
          role={activeOrg.role}
        />
      )}
      {row && <ZonaDePerigoDaOrganizacao displayName={row.display_name} />}
    </div>
  );
}
