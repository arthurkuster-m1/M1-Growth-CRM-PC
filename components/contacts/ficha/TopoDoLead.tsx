"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { rotuloDaChave } from "@/components/contacts/ficha/CadastroDoLead";
import type { CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";
import { CardDaOportunidade } from "@/components/contacts/ficha/OportunidadesDoLead";
import { AbrirConversaDoLead } from "@/components/kanban/AbrirConversaDoLead";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { PREFIXO_DA_CHAVE } from "@/lib/leads/links-de-contato";
import { phoneForDisplay } from "@/lib/channels/phone-variants";
import type { Contact } from "@/lib/types/contacts";
import { ChatCircle, Phone } from "@/lib/ui/icons";
import { nomeDaVenda, type Venda } from "@/lib/vendas";

const textoDoValor = (v: unknown): string =>
  Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v ?? "");

/**
 * O TOPO DA FICHA DO LEAD, enxuto: telefone e e-mail, os campos personalizados (só os campos, sem
 * título), os atalhos de Ligar e Inbox e as oportunidades abertas — uma linha por oportunidade, com
 * o funil e o status dele.
 */
export function TopoDoLead({
  contact,
  camposDefinidos,
}: {
  contact: Contact;
  camposDefinidos: CustomFieldDef[];
}) {
  const t = useT();
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const oportunidades = useQuery({
    queryKey: ["vendas-do-cliente", contact.id],
    retry: false,
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contact.id}`))
        .data.vendas,
  });
  const abertas = (oportunidades.data ?? []).filter(
    (v) => (v.lead_status ?? "open") === "open" && v.lead_id,
  );

  const rotulos =
    contact.custom_fields && typeof contact.custom_fields._rotulos === "object"
      ? (contact.custom_fields._rotulos as Record<string, string>)
      : {};
  const campos = Object.entries(contact.custom_fields ?? {}).filter(
    ([k, v]) =>
      !k.startsWith(PREFIXO_DA_CHAVE) &&
      !k.startsWith("_") &&
      v !== null &&
      v !== "" &&
      typeof v !== "object",
  );
  const rotuloDo = (k: string) =>
    rotulos[k] ?? camposDefinidos.find((d) => d.key === k)?.label ?? rotuloDaChave(k);

  const telefone = contact.phone_number;
  const botao =
    "inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-medium hover:bg-secondary";

  return (
    <div className="grid gap-3">
      {telefone || contact.email ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {telefone ? <span>{phoneForDisplay(telefone)}</span> : null}
          {contact.email ? <span className="break-all">{contact.email}</span> : null}
        </div>
      ) : null}

      {campos.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {campos.map(([k, v]) => (
            <span
              key={k}
              className="max-w-full rounded-full bg-secondary px-2.5 py-1 text-xs break-words"
            >
              <span className="text-muted-foreground">{rotuloDo(k)}:</span> {textoDoValor(v)}
            </span>
          ))}
        </div>
      ) : null}

      {!contact.is_anonymized ? (
        <div className="flex flex-wrap items-center gap-2">
          {telefone ? (
            <a href={`tel:${telefone}`} className={botao}>
              <Phone size={15} aria-hidden />
              {t("Ligar")}
            </a>
          ) : null}
          {contact.conversa ? (
            <Link href={`/app/inbox?id=${contact.conversa.id}`} className={botao}>
              <ChatCircle size={15} aria-hidden />
              {t("Inbox")}
              {contact.conversa.unread > 0 ? (
                <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground tabular-nums">
                  {contact.conversa.unread}
                </span>
              ) : null}
            </Link>
          ) : (
            <AbrirConversaDoLead contactId={contact.id} phone={telefone} variante="botao" />
          )}
        </div>
      ) : null}

      {abertas.length > 0 ? (
        <ul className="grid gap-2" aria-label={t("Oportunidades abertas")}>
          {abertas.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setAbertaId(v.id)}
                className="flex w-full min-w-0 items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2 text-left hover:bg-secondary/50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {nomeDaVenda(v) || t("Oportunidade")}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {v.funil ?? "—"}
                  </span>
                </span>
                {v.etapa ? (
                  <Etiqueta ponto cor="blue">
                    {v.etapa}
                  </Etiqueta>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {abertaId ? (
        <CardDaOportunidade leadId={abertaId} aoFechar={() => setAbertaId(null)} />
      ) : null}
    </div>
  );
}
