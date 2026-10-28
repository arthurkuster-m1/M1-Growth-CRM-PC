"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { rotuloDaChave } from "@/components/contacts/ficha/CadastroDoLead";
import type { CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";
import { CardDaOportunidade } from "@/components/contacts/ficha/OportunidadesDoLead";
import { AnotacoesDoLead } from "@/components/contacts/ficha/AnotacoesDoLead";
import { RegistrarAcaoEmMassaDialog } from "@/components/clientes/RegistrarAcaoEmMassaDialog";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAssignableMembers } from "@/hooks/inbox/useAssignableMembers";
import { COR_DO_CICLO, ehCicloDeVida, ROTULO_DO_CICLO } from "@/lib/ciclo-de-vida";
import { AbrirConversaDoLead } from "@/components/kanban/AbrirConversaDoLead";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { PREFIXO_DA_CHAVE } from "@/lib/leads/links-de-contato";
import { phoneForDisplay } from "@/lib/channels/phone-variants";
import type { Contact } from "@/lib/types/contacts";
import { ChatCircle, NotePencil, Phone, PencilSimple } from "@/lib/ui/icons";
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
  podeEditar = false,
}: {
  contact: Contact;
  camposDefinidos: CustomFieldDef[];
  podeEditar?: boolean;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const membros = useAssignableMembers(podeEditar);
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [acaoAberta, setAcaoAberta] = useState(false);
  const [anotacaoAberta, setAnotacaoAberta] = useState(false);

  // O ciclo de vida é calculado no banco (das oportunidades e dos pagamentos): aqui ele aparece
  // como etiqueta, com o porquê e o gestor de relacionamento (esse sim se edita).
  const ciclo = useQuery({
    queryKey: ["contato-ciclo", contact.id],
    staleTime: 15_000,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: {
            ciclo_de_vida: string | null;
            ciclo_motivo: string | null;
            dono_user_id: string | null;
          };
        }>(`/api/v1/contacts/${contact.id}/ciclo`)
      ).data,
  });
  async function mudarDono(id: string) {
    try {
      await apiClient.post("/api/v1/clientes/lote", {
        action: "dono",
        contact_ids: [contact.id],
        user_id: id || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["contato-ciclo", contact.id] });
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e) {
      showApiError(e);
    }
  }

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
          {ciclo.data && ehCicloDeVida(ciclo.data.ciclo_de_vida) ? (
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" aria-label={t("Ciclo de vida")} className="rounded-full">
                  <Etiqueta ponto cor={COR_DO_CICLO[ciclo.data.ciclo_de_vida]}>
                    {t(ROTULO_DO_CICLO[ciclo.data.ciclo_de_vida])}
                  </Etiqueta>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("Ciclo de vida")}
                </p>
                <p className="mt-1 text-sm">{ciclo.data.ciclo_motivo ?? "—"}</p>
                <label className="mt-3 grid gap-1 text-xs text-muted-foreground">
                  {t("Gestor de Relacionamento")}
                  <select
                    disabled={!podeEditar}
                    value={ciclo.data.dono_user_id ?? ""}
                    onChange={(e) => void mudarDono(e.target.value)}
                    className="h-9 rounded-xl border bg-card px-2 text-sm text-foreground disabled:opacity-60"
                  >
                    <option value="">{t("Sem dono")}</option>
                    {(membros.data ?? []).map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.full_name?.trim() || t("Sem nome")}
                      </option>
                    ))}
                  </select>
                </label>
              </PopoverContent>
            </Popover>
          ) : null}
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
          {podeEditar ? (
            <>
              <button type="button" className={botao} onClick={() => setAcaoAberta(true)}>
                <PencilSimple size={15} aria-hidden />
                {t("Registrar ação")}
              </button>
              <button type="button" className={botao} onClick={() => setAnotacaoAberta(true)}>
                <NotePencil size={15} aria-hidden />
                {t("Registrar anotação")}
              </button>
            </>
          ) : null}
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

      <RegistrarAcaoEmMassaDialog
        contatoIds={[contact.id]}
        aberto={acaoAberta}
        aoFechar={() => setAcaoAberta(false)}
        aoConcluir={() => {
          void queryClient.invalidateQueries({ queryKey: ["contact-timeline"] });
          void queryClient.invalidateQueries({ queryKey: ["timeline"] });
        }}
      />
      <Dialog open={anotacaoAberta} onOpenChange={setAnotacaoAberta}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("Registrar anotação")}</DialogTitle>
          </DialogHeader>
          <AnotacoesDoLead
            contactId={contact.id}
            podeEditar
            semBloco
            semLista
            aoAdicionar={() => setAnotacaoAberta(false)}
          />
        </DialogContent>
      </Dialog>

      {abertaId ? (
        <CardDaOportunidade leadId={abertaId} aoFechar={() => setAbertaId(null)} />
      ) : null}
    </div>
  );
}
