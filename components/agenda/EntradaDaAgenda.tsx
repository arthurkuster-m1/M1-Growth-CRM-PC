"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { usePermission } from "@/hooks/auth/AuthProvider";
import { useEffect } from "react";
import { PaginaDoCompromisso } from "./PaginaDoCompromisso";
export function EntradaDaAgenda({
  onContext,
  onLead,
}: {
  onContext: (contact: string, conversation: string) => void;
  /** A oportunidade que a rota carrega (`?lead=`), quando o link veio dela. */
  onLead?: (lead: string) => void;
}) {
  const podeEditar = usePermission("inbox.reply");
  const params = useSearchParams();
  const router = useRouter();
  const contact = params.get("contato");
  const conversation = params.get("conversa");
  const lead = params.get("lead");
  // ⚠️ SEMPRE avisa, inclusive quando a rota NÃO traz contexto.
  //
  // Era `if (contact) onContext(...)`, e a guarda era o defeito: quem abria
  // "Marcar compromisso" de dentro de uma conversa e depois ia para a Agenda
  // pelo menu continuava com aquele cliente no painel. A rota mudava
  // (`?contato=` sumia), mas esta é a MESMA rota do App Router — o componente
  // não remonta, só a query muda —, e sem a chamada ninguém contava ao painel
  // que o contexto tinha acabado. Quem decide abrir é o `onContext`, pelo
  // valor de `contact`; aqui é só o recado.
  useEffect(() => {
    onContext(contact ?? "", conversation ?? "");
  }, [contact, conversation, onContext]);
  useEffect(() => {
    onLead?.(lead ?? "");
  }, [lead, onLead]);
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
