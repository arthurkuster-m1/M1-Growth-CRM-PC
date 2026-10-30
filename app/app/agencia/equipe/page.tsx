import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MatrizDaEquipe } from "@/components/agencia/MatrizDaEquipe";
import { NavegacaoDoModoAgencia } from "@/components/agencia/NavegacaoDoModoAgencia";
import { clientesDaAgencia, ehSuperAdminPleno } from "@/lib/agencia/acesso";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Modo agência · Equipe" };

/**
 * MODO AGÊNCIA · Equipe: o super-admin escolhe quais clientes cada pessoa da equipe gere. Acesso a
 * um cliente = a pessoa ser membro (gestor ou admin) da organização dele; cada pessoa, depois,
 * escolhe no seletor de clientes quais dos dela quer ver agora.
 */
export default async function EquipeDaAgenciaPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) redirect("/app");
  if (!ehSuperAdminPleno(user)) redirect("/403");
  const clientes = await clientesDaAgencia(user);
  const t = (s: string) => traduzir(s, user.idioma);

  const db = createAdminClient();
  const { data: membros } = await db
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", org.orgId)
    .is("revoked_at", null);
  const ids = ((membros ?? []) as Array<{ user_id: string }>)
    .map((m) => m.user_id)
    .filter((id) => id !== user.id);
  const [{ data: associacoes }, pessoas] = await Promise.all([
    ids.length
      ? db
          .from("user_organizations")
          .select("user_id, organization_id, role")
          .in("user_id", ids)
          .in("organization_id", clientes.map((c) => c.id))
          .is("revoked_at", null)
      : Promise.resolve({ data: [] as Array<{ user_id: string; organization_id: string; role: string }> }),
    Promise.all(
      ids.map(async (id) => {
        const { data } = await db.auth.admin.getUserById(id);
        const u = data?.user;
        return {
          id,
          nome: (u?.user_metadata?.full_name as string | undefined) || u?.email || id.slice(0, 8),
        };
      }),
    ),
  ]);
  const equipe = pessoas
    .map((p) => ({
      ...p,
      acessos: Object.fromEntries(
        ((associacoes ?? []) as Array<{ user_id: string; organization_id: string; role: string }>)
          .filter((a) => a.user_id === p.id)
          .map((a) => [a.organization_id, a.role]),
      ),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <div className="flex h-full flex-col gap-5 p-4 sm:p-6">
      <NavegacaoDoModoAgencia />
      <header>
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {t("Modo agência")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t("Equipe e clientes")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Escolha quais clientes cada pessoa da equipe gere. Ela escolhe, entre os dela, o que quer ver em cada momento.")}
        </p>
      </header>
      <MatrizDaEquipe
        equipe={equipe}
        clientes={clientes.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
