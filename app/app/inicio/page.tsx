import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";

import { InicioClient } from "./_components/InicioClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Início" };

const FUSO_PADRAO = "America/Sao_Paulo";

/**
 * INÍCIO — a primeira tela do dia: saudação, o que vence hoje, a semana e os alertas.
 *
 * Só LÊ o que as outras telas já sabem (tarefas, agenda, central de avisos): não
 * tem tabela nem rota própria. Por isso nenhuma permissão nova — cada cartão usa
 * a rota e a regra da tela de origem.
 *
 * O "agora" nasce AQUI, no servidor, e desce como texto: o cliente hidrata com o
 * mesmo instante que o servidor pintou. Com `new Date()` nos dois lados, a
 * saudação poderia divergir na virada de uma hora (React #418).
 */
export default async function InicioPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  const podeEditar =
    (user.is_platform_admin && !user.support) || ROLE_RANK[activeOrg.role] >= ROLE_RANK.agent;
  const primeiroNome = user.full_name?.trim().split(/\s+/)[0] || user.email.split("@")[0] || "";

  return (
    <InicioClient
      nome={primeiroNome}
      fuso={user.timezone || FUSO_PADRAO}
      usuarioId={user.id}
      podeEditar={podeEditar}
      agoraIso={new Date().toISOString()}
    />
  );
}
