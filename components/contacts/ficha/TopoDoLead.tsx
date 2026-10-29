"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { CampoInline } from "@/components/contacts/ficha/CampoInline";
import {
  useDadosDosNegocios,
  useQualificacaoDoContato,
} from "@/components/contacts/ficha/dados-da-ficha";
import { telefoneE164 } from "@/components/leads/FichaDoLead";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { rotuloDaChave } from "@/components/contacts/ficha/CadastroDoLead";
import type { CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";
import { CardDaOportunidade } from "@/components/contacts/ficha/OportunidadesDoLead";
import { OportunidadeNaFicha } from "@/components/contacts/ficha/OportunidadeNaFicha";
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
import {
  Check,
  ChatCircle,
  Copy,
  EnvelopeSimple,
  NotePencil,
  PencilSimple,
  Phone,
  Plus,
} from "@/lib/ui/icons";
import { toast } from "sonner";
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
  semInbox = false,
  comNome = false,
}: {
  contact: Contact;
  camposDefinidos: CustomFieldDef[];
  podeEditar?: boolean;
  /** Na ficha DENTRO do Inbox a conversa já está aberta: o atalho "Inbox" levaria para a mesma tela. */
  semInbox?: boolean;
  /**
   * Ficha do Inbox: o nome (editável) abre a ficha e a ordem é nome, telefone, e-mail, campos
   * personalizados, etiquetas (ciclo de vida, gestor, MQL) e os botões. Fora do Inbox o nome já
   * está no cabeçalho da página e o telefone divide a primeira linha com as etiquetas.
   */
  comNome?: boolean;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const membros = useAssignableMembers(true);
  const atualizar = useUpdateContact(contact.id);
  const qual = useQualificacaoDoContato(contact.id);
  const negocios = useDadosDosNegocios((qual.data?.funis ?? []).map((f) => f.lead_id));
  const [novoCampo, setNovoCampo] = useState<{ nome: string; valor: string } | null>(null);
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
  // MQL: a etiqueta ao lado do ciclo de vida; um clique marca ou desmarca.
  async function alternarMql() {
    try {
      await apiClient.put(`/api/v1/contacts/${contact.id}/qualificacao`, {
        is_mql: !qual.data?.is_mql,
      });
      await queryClient.invalidateQueries({ queryKey: ["qualificacao-do-lead", contact.id] });
      await queryClient.invalidateQueries({ queryKey: ["clientes"] });
    } catch (e) {
      showApiError(e);
    }
  }
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
  // Os campos do contato e os dos funis dele, juntos (o mesmo que o Cadastro mostra).
  const juntos = new Map<string, unknown>();
  for (const [k, v] of Object.entries(contact.custom_fields ?? {})) {
    if (k.startsWith(PREFIXO_DA_CHAVE) || k.startsWith("_")) continue;
    if (v === null || v === "" || typeof v === "object") continue;
    juntos.set(k, v);
  }
  for (const n of negocios.dados) {
    for (const [k, v] of Object.entries(n.custom_fields ?? {})) {
      if (v === null || v === "" || (typeof v === "object" && !Array.isArray(v))) continue;
      if (!juntos.has(k)) juntos.set(k, v);
    }
  }
  const campos = [...juntos.entries()];
  const rotuloDo = (k: string) =>
    rotulos[k] ??
    camposDefinidos.find((d) => d.key === k)?.label ??
    negocios.dados.flatMap((n) => n.negocio.field_defs).find((d) => d.key === k)?.label ??
    rotuloDaChave(k);

  async function gravarContato(corpo: Record<string, unknown>): Promise<boolean> {
    try {
      await atualizar.mutateAsync(corpo);
      return true;
    } catch {
      return false; // o hook já avisou
    }
  }
  const chaveDoNome = (nome: string): string => {
    const base = nome
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 36);
    return /^[a-z]/.test(base) ? base : `campo_${base}`;
  };
  /** Grava um campo personalizado (novo ou existente) e o repete nos funis que já o têm. */
  async function gravarCampo(chave: string, valor: string, rotulo?: string): Promise<boolean> {
    const atuais: Record<string, unknown> = { ...(contact.custom_fields ?? {}) };
    const nomes: Record<string, string> = { ...rotulos };
    atuais[chave] = valor;
    if (rotulo) nomes[chave] = rotulo;
    if (Object.keys(nomes).length > 0) atuais._rotulos = nomes;
    const ok = await gravarContato({ custom_fields: atuais });
    if (!ok) return false;
    try {
      for (const n of negocios.dados) {
        if (chave in (n.custom_fields ?? {})) {
          await apiClient.patch(`/api/v1/leads/${n.lead_id}`, {
            custom_fields: { [chave]: valor },
          });
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["ficha-do-lead"] });
    } catch (e) {
      showApiError(e);
      return false;
    }
    return true;
  }
  async function criarCampo() {
    if (!novoCampo) return;
    const nome = novoCampo.nome.trim();
    if (!nome) return;
    const chave = chaveDoNome(nome);
    if (juntos.has(chave)) {
      showApiError(new Error(t("Já existe um campo com esse nome.")));
      return;
    }
    if (await gravarCampo(chave, novoCampo.valor.trim(), nome)) setNovoCampo(null);
  }

  const telefone = contact.phone_number;
  const [copiado, setCopiado] = useState<"telefone" | "email" | null>(null);
  async function copiar(qual: "telefone" | "email", texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      toast.success(qual === "email" ? t("E-mail copiado") : t("Telefone copiado"));
      setTimeout(() => setCopiado(null), 1500);
    } catch {
      toast.error(t("Não consegui copiar. Selecione o texto e copie à mão."));
    }
  }
  const botaoIcone =
    "inline-flex size-7 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground";
  const botao =
    "inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm font-medium hover:bg-secondary";

  const telefoneEl = (
    <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
      <Phone size={15} aria-hidden className="shrink-0" />
      <CampoInline
        valor={telefone ? phoneForDisplay(telefone) : ""}
        placeholder={t("Adicionar telefone")}
        rotulo={t("Telefone")}
        type="tel"
        inputMode="tel"
        podeEditar={podeEditar}
        className="max-w-44"
        aoSalvar={async (novo) => {
          const fone = telefoneE164(novo);
          if (!fone) return false;
          return gravarContato({ phone_number: fone });
        }}
      />
      {telefone ? (
        <button
          type="button"
          aria-label={t("Copiar telefone")}
          title={t("Copiar telefone")}
          onClick={() => void copiar("telefone", phoneForDisplay(telefone))}
          className={botaoIcone}
        >
          {copiado === "telefone" ? (
            <Check size={14} aria-hidden />
          ) : (
            <Copy size={14} aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  );
  const tagsEl = (
    <>
      {ciclo.data && ehCicloDeVida(ciclo.data.ciclo_de_vida) ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("Ciclo de vida")}
              className="max-w-full min-w-0 rounded-full"
            >
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
          </PopoverContent>
        </Popover>
      ) : null}
      {ciclo.data && (ciclo.data.dono_user_id || podeEditar) ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t("Gestor de Relacionamento")}
              title={t("Gestor de Relacionamento")}
              className="max-w-full min-w-0 rounded-full"
            >
              <Etiqueta ponto cor={ciclo.data.dono_user_id ? "purple" : "gray"}>
                {ciclo.data.dono_user_id
                  ? ((membros.data ?? [])
                      .find((m) => m.user_id === ciclo.data!.dono_user_id)
                      ?.full_name?.trim() ?? t("Fora da equipe"))
                  : t("Sem gestor de relacionamento")}
              </Etiqueta>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-3">
            <label className="grid gap-1 text-xs text-muted-foreground">
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
      {qual.data && (qual.data.is_mql || podeEditar) ? (
        <button
          type="button"
          disabled={!podeEditar}
          onClick={() => void alternarMql()}
          aria-pressed={qual.data.is_mql}
          title={
            qual.data.is_mql
              ? t("Lead qualificado (MQL) — clique para desmarcar")
              : t("Marcar como lead qualificado (MQL)")
          }
          className="max-w-full min-w-0 rounded-full disabled:cursor-default"
        >
          {qual.data.is_mql ? (
            <Etiqueta ponto cor="green">
              MQL
            </Etiqueta>
          ) : (
            <span className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-secondary">
              + MQL
            </span>
          )}
        </button>
      ) : null}
    </>
  );

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      {/* A ficha: o telefone (com Ligar e Inbox) e as etiquetas do ciclo e do gestor na primeira
          linha; o e-mail (com Copiar) na segunda; os demais campos na terceira. */}
      {comNome ? (
        <CampoInline
          valor={contact.name ?? contact.display_name ?? ""}
          placeholder={t("Adicionar nome")}
          rotulo={t("Nome")}
          podeEditar={podeEditar}
          classeDoTexto="text-base font-semibold text-foreground"
          className="max-w-full"
          aoSalvar={(novo) => (novo ? gravarContato({ name: novo }) : false)}
        />
      ) : null}
      {comNome ? (
        telefoneEl
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {telefoneEl}
          {tagsEl}
        </div>
      )}

      <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        <EnvelopeSimple size={15} aria-hidden className="shrink-0" />
        <CampoInline
          valor={contact.email ?? ""}
          placeholder={t("Adicionar e-mail")}
          rotulo={t("E-mail")}
          type="email"
          inputMode="email"
          podeEditar={podeEditar}
          classeDoTexto="break-all"
          className="max-w-72"
          aoSalvar={(novo) => (novo ? gravarContato({ email: novo }) : false)}
        />
        {contact.email ? (
          <button
            type="button"
            aria-label={t("Copiar e-mail")}
            title={t("Copiar e-mail")}
            onClick={() => void copiar("email", contact.email!)}
            className={botaoIcone}
          >
            {copiado === "email" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          </button>
        ) : null}
      </div>

      {campos.length > 0 || podeEditar ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {campos.map(([k, v]) => (
            <span
              key={k}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"
            >
              <span className="shrink-0 text-muted-foreground">{rotuloDo(k)}:</span>
              <CampoInline
                valor={textoDoValor(v)}
                placeholder={rotuloDo(k)}
                rotulo={rotuloDo(k)}
                podeEditar={podeEditar}
                className="h-7 max-w-48 py-0 text-xs"
                aoSalvar={(novo) => gravarCampo(k, novo)}
              />
            </span>
          ))}
          {podeEditar && !novoCampo ? (
            <button
              type="button"
              aria-label={t("Adicionar campo")}
              title={t("Adicionar campo")}
              onClick={() => setNovoCampo({ nome: "", valor: "" })}
              className="inline-flex size-6 items-center justify-center rounded-full border border-dashed text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Plus size={12} weight="bold" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      {novoCampo ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void criarCampo();
          }}
        >
          <input
            autoFocus
            value={novoCampo.nome}
            maxLength={40}
            placeholder={t("Nome do campo")}
            onChange={(e) => setNovoCampo({ ...novoCampo, nome: e.target.value })}
            className="h-9 w-40 rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60"
          />
          <input
            value={novoCampo.valor}
            maxLength={200}
            placeholder={t("Valor")}
            onChange={(e) => setNovoCampo({ ...novoCampo, valor: e.target.value })}
            className="h-9 w-44 rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60"
          />
          <button type="submit" className={botao} disabled={!novoCampo.nome.trim()}>
            {t("Salvar")}
          </button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:underline"
            onClick={() => setNovoCampo(null)}
          >
            {t("Cancelar")}
          </button>
        </form>
      ) : null}

      {comNome ? <div className="flex min-w-0 flex-wrap items-center gap-1.5">{tagsEl}</div> : null}

      {!contact.is_anonymized ? (
        <div className="flex flex-wrap items-center gap-2">
          {telefone ? (
            <a href={`tel:${telefone}`} className={botao}>
              <Phone size={15} aria-hidden />
              {t("Ligar")}
            </a>
          ) : null}
          {semInbox ? null : contact.conversa ? (
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
        <ul className="grid min-w-0 gap-2" aria-label={t("Oportunidades abertas")}>
          {abertas.map((v) => (
            <li key={v.id} className="min-w-0">
              <OportunidadeNaFicha
                venda={v}
                contactId={contact.id}
                podeEditar={podeEditar}
                aoAbrir={() => setAbertaId(v.id)}
              />
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
