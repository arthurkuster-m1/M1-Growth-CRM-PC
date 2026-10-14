"use client";

import { useState } from "react";

import { TarefasMotorClient } from "@/app/app/tarefas/_components/TarefasMotorClient";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { ROLE_RANK } from "@/lib/auth/types";

const FUSO_PADRAO = "America/Sao_Paulo";

/**
 * AS TAREFAS DO LEAD, com o mesmo motor da tela de Tarefas: escolher e ordenar propriedades,
 * filtrar, agrupar, mudar status, textos, prazos e abrir a tarefa. Só as tarefas deste lead; as
 * novas já nascem com ele como cliente.
 */
export function TarefasDoLead({
  contactId,
  nome,
  abrirInicial,
}: {
  contactId: string;
  nome: string;
  abrirInicial?: string | null;
}) {
  const { user, activeOrg } = useAuth();
  const [agoraIso] = useState(() => new Date().toISOString());
  const papel = activeOrg?.role ?? "viewer";
  const plataforma = Boolean(user.is_platform_admin && !user.support);
  const podeEditar =
    user.support?.access_mode !== "support_readonly" &&
    (plataforma || ROLE_RANK[papel] >= ROLE_RANK.agent);
  const podeConfigurar = plataforma || ROLE_RANK[papel] >= ROLE_RANK.manager;
  return (
    <TarefasMotorClient
      key={abrirInicial ?? "sem-abertura"}
      fuso={user.timezone || FUSO_PADRAO}
      usuarioId={user.id}
      podeEditar={podeEditar}
      podeConfigurar={podeConfigurar}
      agoraIso={agoraIso}
      nomeDaOrganizacao={activeOrg?.name ?? ""}
      contatoFixo={{ id: contactId, nome }}
      abrirInicial={abrirInicial ?? null}
    />
  );
}
