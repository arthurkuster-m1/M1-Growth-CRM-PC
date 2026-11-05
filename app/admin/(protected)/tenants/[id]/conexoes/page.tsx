import { notFound } from "next/navigation";
import { z } from "zod";

import { Etiqueta } from "@/components/motor/Etiqueta";
import { loadAuthUser } from "@/lib/auth/server";
import { lerCredencialDeLeitura } from "@/lib/plataformas-de-anuncio/credenciais-de-leitura";
import { lerEstadoDaConexaoGoogle } from "@/lib/plataformas-de-anuncio/google/estado-da-conexao";
import { listarContas } from "@/lib/plataformas-de-anuncio/meta/insights";
import { createAdminClient } from "@/lib/supabase/admin";

import { LiberarContas } from "./_client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conexões da empresa — Modo agência" };

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * CONEXÕES da empresa (Meta Ads e Google Ads). Só o administrador da plataforma vê e muda: o
 * token da agência alcança as contas de todos os clientes, e cada cliente só deve enxergar as
 * dele. Nenhum segredo vai ao navegador — o token é decifrado só aqui, no servidor.
 *
 * Meta Ads: quais contas de anúncio a empresa pode usar. Google Ads: o estado da conexão (hoje
 * não há lista de contas para liberar como no Meta).
 */
export default async function TenantConexoesPage({ params }: PageProps) {
  const usuario = await loadAuthUser();
  if (!usuario?.is_platform_admin) notFound();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const admin = createAdminClient();
  const [{ data: linha }, google] = await Promise.all([
    admin
      .from("ad_insights_connections")
      .select("restrict_accounts, allowed_account_ids, default_account_id")
      .eq("organization_id", id)
      .eq("platform", "meta_ads")
      .maybeSingle(),
    lerEstadoDaConexaoGoogle(admin, id).catch(() => null),
  ]);

  let metaConteudo: React.ReactNode;
  if (!linha) {
    metaConteudo = (
      <p className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-text-muted">
        Esta empresa ainda não conectou o Meta Ads. Conecte em Conexões › Meta Ads dela (entre na
        empresa pelo trocador do alto) e volte aqui para liberar as contas.
      </p>
    );
  } else {
    let contas: Array<{ id: string; nome: string; moeda: string; status: number }> = [];
    let aviso: string | null = null;
    const credencial = await lerCredencialDeLeitura(admin, id, "meta_ads");
    if (!credencial.ok) {
      aviso = "Não foi possível ler o token desta empresa (confira a conexão).";
    } else {
      const lidas = await listarContas(credencial.credencial.accessToken);
      if (lidas.ok) contas = lidas.dados;
      else aviso = "O Meta não devolveu as contas deste token agora. Tente de novo em instantes.";
    }
    metaConteudo = (
      <LiberarContas
        organizationId={id}
        restringirInicial={(linha.restrict_accounts as boolean | null) === true}
        liberadasIniciais={(linha.allowed_account_ids as string[] | null) ?? []}
        contas={contas}
        aviso={aviso}
      />
    );
  }

  const googleAutorizado = google?.temRefreshToken === true;
  const titulo = "text-xs font-medium tracking-wide text-text-muted uppercase";
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className={titulo}>Meta Ads</h2>
        {metaConteudo}
      </section>
      <section className="space-y-2">
        <h2 className={titulo}>Google Ads</h2>
        <div className="rounded-2xl border border-border bg-card p-4 text-sm sm:p-5">
          {google === null ? (
            <p className="text-text-muted">Não foi possível ler a conexão do Google Ads agora.</p>
          ) : !googleAutorizado ? (
            <p className="text-text-muted">
              Esta empresa ainda não conectou o Google Ads. A conexão é feita em Conexões › Google
              Ads dela (entre na empresa pelo trocador do alto).
            </p>
          ) : (
            <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-text-muted">Conexão</dt>
                <dd className="mt-1">
                  <Etiqueta cor="green" ponto>
                    Autorizada
                  </Etiqueta>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Envio de conversões</dt>
                <dd className="mt-1">
                  <Etiqueta cor={google.habilitada ? "green" : "gray"} ponto>
                    {google.habilitada ? "Ligado" : "Desligado"}
                  </Etiqueta>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Conta (customer id)</dt>
                <dd className="mt-1 font-mono text-xs">{google.customerId ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted">Conta gerente (login customer id)</dt>
                <dd className="mt-1 font-mono text-xs">{google.loginCustomerId ?? "—"}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>
    </div>
  );
}
