"use client";
/**
 * O painel lateral do Inbox: a ficha do contato da conversa aberta. O conteúdo é de
 * `FichaDoInbox` (a mesma ficha da página do lead, em versão estreita); aqui fica só a moldura
 * e o estado "nenhuma conversa selecionada".
 */
import Link from "next/link";

import { FichaDoInbox } from "@/components/inbox/FichaDoInbox";
import { Button } from "@/components/ui/button";
import type { ConversationWithContact } from "@/hooks/inbox/useConversationsRealtime";
import { useT } from "@/hooks/i18n/useT";
import { ArrowRight } from "@/lib/ui/icons";

interface Props {
  conversation: ConversationWithContact | null;
}

export function CRMSidePanel({ conversation }: Props) {
  const t = useT();
  const contactId = conversation?.contacts?.id ?? null;

  if (!conversation) {
    return (
      <aside className="flex h-full items-center justify-center border-l border-border p-4 text-center text-xs text-muted-foreground">
        {t("Selecione uma conversa para ver detalhes do contato.")}
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-w-0 flex-col gap-3 overflow-x-hidden overflow-y-auto border-l border-border bg-background p-3 pt-6 max-md:pt-8">
      {contactId ? (
        <>
          <FichaDoInbox
            key={contactId}
            contactId={contactId}
            conversationId={conversation.id}
          />
          <Button asChild size="sm" variant="ghost" className="self-start">
            <Link href={`/app/contacts/${contactId}`}>
              {t("Abrir a página completa do lead")}
              <ArrowRight size={12} className="ml-1" weight="regular" aria-hidden />
            </Link>
          </Button>
        </>
      ) : (
        <p className="p-2 text-center text-xs text-muted-foreground">
          {t("Esta conversa ainda não tem um contato ligado.")}
        </p>
      )}
    </aside>
  );
}
