"use client";

import { useEffect, useState } from "react";

import { Etiqueta } from "@/components/motor/Etiqueta";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useContactList } from "@/hooks/contacts/useContactList";
import { useT } from "@/hooks/i18n/useT";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";

interface Props {
  /** O lead da tarefa; `null` = tarefa interna (a própria organização). */
  contactId: string | null;
  nome: string | null | undefined;
  /** O nome da organização, para "Interno · Organização". */
  organizacao: string;
  podeEditar: boolean;
  aoEscolher: (contato: { id: string | null; nome: string | null }) => void;
}

/**
 * O CLIENTE DA TAREFA: para quem ela é. Um lead do CRM ou, no trabalho interno, a própria
 * organização ("Interno · Nome da empresa"). Escolher busca entre os leads pelo nome ou telefone.
 */
export function CelulaDeCliente({ contactId, nome, organizacao, podeEditar, aoEscolher }: Props) {
  const t = useT();
  const [aberto, setAberto] = useState(false);

  const interno = `${t("Interno")} · ${organizacao}`;
  const exibicao = contactId ? (nome ?? t("Lead")) : interno;

  return (
    <Popover
      // Modal: a lista rola com o mouse e a tela de trás fica travada (no celular também).
      modal
      open={aberto}
      onOpenChange={(a) => {
        if (a && !podeEditar) return;
        setAberto(a);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!podeEditar}
          aria-label={t("Cliente da tarefa")}
          title={exibicao}
          className="block w-full min-w-0 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary disabled:hover:bg-transparent"
        >
          {contactId ? (
            <Etiqueta cor="purple">{exibicao}</Etiqueta>
          ) : (
            <Etiqueta cor="gray">{exibicao}</Etiqueta>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="grid w-72 max-w-[92vw] gap-2 p-2">
        <EscolherLead
          interno={interno}
          aoEscolher={(c) => {
            aoEscolher(c);
            setAberto(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** A lista de busca: só existe com o seletor aberto (a tabela não busca contatos por célula). */
function EscolherLead({
  interno,
  aoEscolher,
}: {
  interno: string;
  aoEscolher: (contato: { id: string | null; nome: string | null }) => void;
}) {
  const t = useT();
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setBusca(termo.trim()), 250);
    return () => clearTimeout(id);
  }, [termo]);

  const lista = useContactList(busca ? { search: busca } : { limit: 8 });
  const achados = (lista.data?.pages.flatMap((p) => p.data) ?? [])
    .filter((c) => !c.is_anonymized)
    .slice(0, 8);

  return (
    <>
      <input
        autoFocus
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
        placeholder={t("Procure o lead pelo nome ou telefone")}
        className="h-9 w-full rounded-lg border bg-background px-2.5 text-sm outline-hidden focus:border-primary/60"
      />
      <button
        type="button"
        onClick={() => aoEscolher({ id: null, nome: null })}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed px-2.5 py-1.5 text-left text-sm hover:bg-secondary"
      >
        <span className="truncate">{interno}</span>
      </button>
      <ul className="grid max-h-56 gap-0.5 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
        {achados.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => aoEscolher({ id: c.id, nome: rotuloDoContato(c, t) })}
              className="flex w-full flex-col items-start rounded-lg px-2.5 py-1.5 text-left hover:bg-secondary"
            >
              <span className="max-w-full truncate text-sm">{rotuloDoContato(c, t)}</span>
              {c.phone_number ? (
                <span className="text-xs text-muted-foreground">{c.phone_number}</span>
              ) : null}
            </button>
          </li>
        ))}
        {busca !== "" && achados.length === 0 && !lista.isLoading ? (
          <li className="px-2.5 py-1.5 text-xs text-muted-foreground">
            {t("Nenhum lead com esse nome ou telefone.")}
          </li>
        ) : null}
      </ul>
    </>
  );
}
