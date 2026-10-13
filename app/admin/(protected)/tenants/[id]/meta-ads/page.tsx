import { notFound } from "next/navigation";
import { z } from "zod";

import { loadAuthUser } from "@/lib/auth/server";
import { lerCredencialDeLeitura } from "@/lib/plataformas-de-anuncio/credenciais-de-leitura";
import { listarContas } from "@/lib/plataformas-de-anuncio/meta/insights";
import { createAdminClient } from "@/lib/supabase/admin";

import { LiberarContas } from "./_client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contas de anúncio da organização" };

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Quais contas de anúncio do Meta ESTA organização pode usar. Só o administrador da plataforma
 * vê e muda: o token da agência alcança as contas de todos os clientes, e cada cliente só deve
 * enxergar as dele. Nenhum segredo vai ao navegador — o token é decifrado só aqui, no servidor.
 */
export default async function TenantMetaAdsPage({ params }: PageProps) {
  const usuario = await loadAuthUser();
  if (!usuario?.is_platform_admin) notFound();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const admin = createAdminClient();
  const { data: linha } = await admin
    .from("ad_insights_connections")
    .select("restrict_accounts, allowed_account_ids, default_account_id")
    .eq("organization_id", id)
    .eq("platform", "meta_ads")
    .maybeSingle();

  if (!linha) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Esta organização ainda não conectou o Meta Ads. Conecte em Configurações › Meta Ads dela (ou
        entre como suporte) e volte aqui para liberar as contas.
      </p>
    );
  }

  let contas: Array<{ id: string; nome: string; moeda: string; status: number }> = [];
  let aviso: string | null = null;
  const credencial = await lerCredencialDeLeitura(admin, id, "meta_ads");
  if (!credencial.ok) {
    aviso = "Não foi possível ler o token desta organização (confira a conexão).";
  } else {
    const lidas = await listarContas(credencial.credencial.accessToken);
    if (lidas.ok) contas = lidas.dados;
    else aviso = "O Meta não devolveu as contas deste token agora. Tente de novo em instantes.";
  }

  return (
    <LiberarContas
      organizationId={id}
      restringirInicial={(linha.restrict_accounts as boolean | null) === true}
      liberadasIniciais={(linha.allowed_account_ids as string[] | null) ?? []}
      contas={contas}
      aviso={aviso}
    />
  );
}
