import { clientesDaAgencia, clientesSelecionados } from "@/lib/agencia/acesso";
import { loadAuthUser } from "@/lib/auth/server";

import { TenantsClient } from "./_client";

export const metadata = { title: "Empresas — Admin Plataforma" };

export default async function AdminTenantsPage() {
  // A lista respeita o seletor de empresas do Modo agência: sem escolha, mostra todas.
  const user = await loadAuthUser();
  let selecionados: string[] = [];
  if (user) {
    const todos = await clientesDaAgencia(user);
    const escolhidos = await clientesSelecionados(todos);
    selecionados = escolhidos.length === todos.length ? [] : escolhidos.map((c) => c.id);
  }
  return <TenantsClient selecionados={selecionados} />;
}
