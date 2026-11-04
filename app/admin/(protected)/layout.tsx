import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { AdminShell } from "@/components/admin/AdminShell";
import { AuthProvider } from "@/hooks/auth/AuthProvider";
import { IdiomaProvider } from "@/lib/i18n/IdiomaProvider";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const { user: authUser } = await requirePlatformAdmin();
  // Mesmo padrão de `app/app/layout.tsx`: o idioma envolve a árvore inteira e
  // recebe o código PRONTO. Sem este Provider, `useT()` nos componentes do
  // admin cai no padrão do Context (pt-BR) e nenhuma tradução aparece, não
  // importa quantas entradas o dicionário tenha — um admin de plataforma é a
  // MESMA conta que o dono do tenant (o install.sh promove o dono a platform
  // admin), então o `user_metadata.locale` dele já existe e é o mesmo lido em
  // `lib/auth/server.ts`.
  const locale = (authUser.user_metadata?.locale as string | undefined) ?? null;

  // O menu e a barra de cima são os do app (Modo agência) e leem o usuário e a organização
  // ativa pelo `AuthProvider` — o mesmo snapshot que `app/app/layout.tsx` monta. Sem os portões
  // de onboarding/suspensão de lá, de propósito: o painel de plataforma precisa abrir justamente
  // para administrar uma empresa suspensa ou ainda sem onboarding.
  const user = await loadAuthUser();
  if (!user) redirect("/login");
  const activeOrg = await resolveActiveOrg(user);
  const collapsed = (await cookies()).get("sidebar_collapsed")?.value === "1";

  return (
    <IdiomaProvider locale={locale}>
      <AuthProvider user={user} activeOrg={activeOrg}>
        <AdminShell sidebarCollapsed={collapsed}>{children}</AdminShell>
      </AuthProvider>
    </IdiomaProvider>
  );
}
