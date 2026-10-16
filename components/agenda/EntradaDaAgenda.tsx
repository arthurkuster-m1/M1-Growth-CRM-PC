"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { usePermission } from "@/hooks/auth/AuthProvider";
import { useEffect } from "react";
import { abrirNovoCompromisso } from "@/lib/agenda/abrir-novo";
import { PaginaDoCompromisso } from "./PaginaDoCompromisso";
export function EntradaDaAgenda({
  onContext: _onContext,
  onLead: _onLead,
}: {
  onContext?: (contact: string, conversation: string) => void;
  onLead?: (lead: string) => void;
}) {
  const podeEditar = usePermission("inbox.reply");
  const params = useSearchParams();
  const router = useRouter();
  const contact = params.get("contato");
  const conversation = params.get("conversa");
  const lead = params.get("lead");
  // Links com `?contato=`, `?conversa=` ou `?lead=` (o "Marcar compromisso" de antes) abrem o NOVO
  // compromisso e limpam a URL: o painel antigo de marcação não existe mais.
  useEffect(() => {
    if (!contact && !lead) return;
    if (podeEditar)
      abrirNovoCompromisso({ contactId: contact, conversationId: conversation, leadId: lead });
    const tipo = params.get("tipo");
    router.replace(tipo ? `/app/agenda?tipo=${encodeURIComponent(tipo)}` : "/app/agenda");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, conversation, lead]);
  return (
    <PaginaDoCompromisso
      key={params.get("compromisso")}
      podeEditar={podeEditar}
      id={params.get("compromisso")}
      onClose={() => {
        // O `?tipo=` escolhido na grade ATRAVESSA o fecho do detalhe: sem
        // esta linha, abrir um compromisso e fechar apagava a query inteira —
        // inclusive o tipo — e o F5 seguinte voltava ao primeiro (#1657).
        // Os demais parâmetros continuam fora, como sempre: fechar é voltar
        // para a agenda limpa.
        const tipo = params.get("tipo");
        router.replace(tipo ? `/app/agenda?tipo=${encodeURIComponent(tipo)}` : "/app/agenda");
      }}
    />
  );
}
