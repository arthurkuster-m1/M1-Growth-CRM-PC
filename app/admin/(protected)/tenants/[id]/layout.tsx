import { LinkVoltar } from "@/components/ui/LinkVoltar";
import type { ReactNode } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { corDoCliente } from "@/lib/agencia/cor-do-cliente";
import { iniciais } from "@/lib/admin/empresas";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";

import { TabNav } from "./_tab-nav";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
import { traduzir } from "@/lib/i18n/dicionario";

// ---------------------------------------------------------------------------
// Status badge helpers (same palette as TenantsTable)
// ---------------------------------------------------------------------------

const STATUS_COR: Record<string, CorDaOpcao> = {
  active: "green",
  onboarding: "blue",
  suspended: "orange",
  redacted: "red",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  onboarding: "Onboarding",
  suspended: "Suspensa",
  redacted: "Anonimizada",
};

// ---------------------------------------------------------------------------
// Sub-nav tabs definition
// ---------------------------------------------------------------------------

interface TabItem {
  label: string;
  href: string;
  disabled: boolean;
}

const TABS: TabItem[] = [
  { label: "Visão Geral", href: "", disabled: false },
  { label: "Agentes", href: "/agent", disabled: false },
  { label: "Conexões", href: "/conexoes", disabled: false },
  { label: "Equipe", href: "/team", disabled: false },
  { label: "Uso", href: "/uso", disabled: false },
  { label: "Configurações", href: "/configuracoes", disabled: false },
];

// ---------------------------------------------------------------------------
// Layout (Server Component — requirePlatformAdmin already handled by outer
// (protected) layout, but we call it here for the org load context)
// ---------------------------------------------------------------------------

interface TenantLayoutProps {
  children: ReactNode;
  params: Promise<{ id: string }>;
}

export default async function TenantDetailLayout({ children, params }: TenantLayoutProps) {
  // Auth check — outer (protected)/layout.tsx already guards, but we need
  // org data server-side for the header. requirePlatformAdmin is cheap (cached).
  const { user } = await requirePlatformAdmin();
  const idioma = normalizarIdioma((user.user_metadata?.locale as string | undefined) ?? null);

  const { id } = await params;
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organizations")
    .select(
      "id, slug, display_name, status, onboarded_at, cor_agencia:settings->>agencia_cor, cor_marca:settings->branding->>accent_hex",
    )
    .eq("id", id)
    .single();

  const basePath = `/admin/tenants/${id}`;
  const linha = org as unknown as {
    display_name: string;
    slug: string;
    status: string;
    onboarded_at: string | null;
    cor_agencia: string | null;
    cor_marca: string | null;
  } | null;
  // 'onboarding' não existe no banco: é derivado (ativa sem onboarding concluído).
  const situacao =
    linha?.status === "active" && !linha.onboarded_at ? "onboarding" : (linha?.status ?? "");
  const nome = linha?.display_name ?? id;

  return (
    <div className="space-y-5">
      <LinkVoltar href="/admin/tenants">{traduzir("Empresas", idioma)}</LinkVoltar>

      {/* Cabeçalho: a empresa, com a cor dela no Modo agência */}
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-base font-semibold text-white"
          style={{ backgroundColor: corDoCliente(linha?.cor_marca ?? linha?.cor_agencia, id) }}
        >
          {iniciais(nome)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{nome}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {linha?.slug ? (
              <code className="rounded-md bg-secondary px-2 py-0.5 font-mono text-xs text-text-muted">
                {linha.slug}
              </code>
            ) : null}
            {situacao ? (
              <Etiqueta cor={STATUS_COR[situacao] ?? "gray"} ponto>
                {traduzir(STATUS_LABELS[situacao] ?? situacao, idioma)}
              </Etiqueta>
            ) : null}
          </div>
        </div>
      </div>

      <TabNav basePath={basePath} tabs={TABS} />

      {children}
    </div>
  );
}
