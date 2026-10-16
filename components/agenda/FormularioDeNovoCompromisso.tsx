"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { toast } from "sonner";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import type { PedidoDeNovoCompromisso } from "@/lib/agenda/abrir-novo";
import { apiClient } from "@/lib/api/client";

import { CampoDeDataEHora } from "./CampoDeDataEHora";
import { VinculoDaMarcacao } from "./VinculoDaMarcacao";

export type ContextoDeMarcacao = {
  fuso: string;
  tipos: Array<{ id: string; nome: string; slug: string; duracaoMin: number; donoId: string | null }>;
  oportunidades: Array<{ id: string; titulo: string; funil: string | null; etapa: string | null; responsavel_id: string | null }>;
  responsavel_padrao: { user_id: string; origem: "oportunidade" | "cliente" } | null;
};

export type PessoaDaEquipe = { user_id: string; role: string; full_name: string | null };

export function usePessoasDaEquipe() {
  return useQuery({
    queryKey: ["agenda", "pessoas-nomes"],
    staleTime: 60_000,
    queryFn: async () => (await apiClient.get<{ data: PessoaDaEquipe[] }>("/api/v1/agenda/pessoas")).data,
  });
}

export function useContextoDeMarcacao(contactId: string, leadId: string) {
  return useQuery({
    queryKey: ["agenda", "contexto-de-marcacao", contactId, leadId],
    staleTime: 15_000,
    queryFn: async () => {
      const qs = new URLSearchParams({
        ...(contactId ? { contact_id: contactId } : {}),
        ...(leadId ? { lead_id: leadId } : {}),
      });
      return (await apiClient.get<{ data: ContextoDeMarcacao }>(`/api/v1/agenda/contexto-de-marcacao?${qs}`)).data;
    },
  });
}

export const ROTULO_DA_ORIGEM_DO_RESPONSAVEL = {
  oportunidade: "Responsável da oportunidade",
  cliente: "Responsável pelo relacionamento com o cliente",
} as const;

/**
 * O formulário de NOVO compromisso (dentro da página do compromisso): pede o cliente, a
 * oportunidade dele, o tipo de atendimento, a data e o horário e quem atende. O responsável
 * sugerido é o da oportunidade; sem ele, o do relacionamento com o cliente. Dá para trocar aqui
 * sem mexer no CRM nem na oportunidade.
 */
export function FormularioDeNovoCompromisso({
  inicial,
  usuarioId,
  aoCriar,
  aoCancelar,
}: {
  inicial: PedidoDeNovoCompromisso;
  usuarioId: string;
  aoCriar: (id: string) => void;
  aoCancelar: () => void;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const [contactId, setContactId] = React.useState(inicial.contactId ?? "");
  const [conversationId, setConversationId] = React.useState(inicial.conversationId ?? "");
  const [leadId, setLeadId] = React.useState(inicial.leadId ?? "");
  const [tipoId, setTipoId] = React.useState(inicial.eventTypeId ?? "");
  const [quando, setQuando] = React.useState<string | null>(inicial.startsAt ?? null);
  const [responsavelId, setResponsavelId] = React.useState("");
  const [responsavelTocado, setResponsavelTocado] = React.useState(false);
  const [notas, setNotas] = React.useState("");

  const contexto = useContextoDeMarcacao(contactId, leadId);
  const pessoas = usePessoasDaEquipe();
  const ctx = contexto.data;
  const tipo = ctx?.tipos.find((x) => x.id === tipoId) ?? ctx?.tipos[0] ?? null;

  // A oportunidade: a escolhida, senão a única/mais recente aberta do cliente.
  React.useEffect(() => {
    if (!ctx || !contactId) return;
    if (leadId && ctx.oportunidades.some((o) => o.id === leadId)) return;
    const padrao = ctx.oportunidades[0]?.id ?? "";
    if (padrao !== leadId) setLeadId(padrao);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx?.oportunidades, contactId]);

  // O responsável: da oportunidade escolhida (prioridade), senão do cliente, senão do tipo, senão quem marca.
  const daOportunidade = ctx?.oportunidades.find((o) => o.id === leadId)?.responsavel_id ?? null;
  const sugerido =
    daOportunidade ?? ctx?.responsavel_padrao?.user_id ?? tipo?.donoId ?? usuarioId;
  const origemDoSugerido: keyof typeof ROTULO_DA_ORIGEM_DO_RESPONSAVEL | null = daOportunidade
    ? "oportunidade"
    : ctx?.responsavel_padrao
      ? ctx.responsavel_padrao.origem
      : null;
  React.useEffect(() => {
    if (!responsavelTocado) setResponsavelId(sugerido);
  }, [sugerido, responsavelTocado]);

  const nomes = (pessoas.data ?? []).map((p) => ({
    id: p.user_id,
    rotulo: (p.full_name ?? "").trim() || t("Pessoa da equipe"),
  }));

  const criar = useMutation({
    mutationFn: async () =>
      apiClient.post<{ data: { id: string } }>("/api/v1/agenda/agendamentos", {
        event_type_id: tipo!.id,
        starts_at: quando!,
        owner_user_id: responsavelId || undefined,
        contact_id: contactId || undefined,
        lead_id: leadId || undefined,
        conversation_id: conversationId || undefined,
        notes: notas.trim() || undefined,
      }),
    onSuccess: (r) => {
      toast.success(t("Compromisso criado."));
      void qc.invalidateQueries({ queryKey: ["agenda"] });
      aoCriar(r.data.id);
    },
    onError: showApiError,
  });

  const fuso = ctx?.fuso ?? "America/Sao_Paulo";
  const pronto = Boolean(tipo && quando && responsavelId);

  return (
    <div data-testid="formulario-de-novo-compromisso" className="grid gap-5 p-6">
      <div>
        <h2 className="text-xl font-semibold">{t("Novo compromisso")}</h2>
        <p className="text-sm text-text-muted">
          {t("Escolha o cliente e a oportunidade, depois o dia e o horário.")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <VinculoDaMarcacao
            contactId={contactId}
            conversationId={conversationId}
            onChange={(c, v) => {
              setContactId(c);
              setConversationId(v);
              setLeadId("");
              setResponsavelTocado(false);
            }}
          />
        </div>

        <div className="grid gap-1">
          <p className="text-sm font-medium">{t("Oportunidade")}</p>
          <SeletorEmPopup
            rotulo={t("Oportunidade do compromisso")}
            valor={leadId}
            desabilitado={!contactId}
            placeholder={contactId ? undefined : t("Escolha o cliente primeiro")}
            rotuloVazio={t("Sem oportunidade (atendimento ao cliente)")}
            opcoes={(ctx?.oportunidades ?? []).map((o) => ({
              id: o.id,
              rotulo: `${o.titulo}${o.funil ? ` · ${o.funil}` : ""}${o.etapa ? ` › ${o.etapa}` : ""}`,
            }))}
            aoEscolher={(id) => {
              setLeadId(id);
              setResponsavelTocado(false);
            }}
          />
        </div>

        <div className="grid gap-1">
          <p className="text-sm font-medium">{t("Tipo de atendimento")}</p>
          <SeletorEmPopup
            rotulo={t("Tipo de atendimento")}
            valor={tipo?.id ?? ""}
            opcoes={(ctx?.tipos ?? []).map((x) => ({ id: x.id, rotulo: `${x.nome} · ${x.duracaoMin} min` }))}
            aoEscolher={(id) => {
              setTipoId(id);
              setResponsavelTocado(false);
            }}
          />
        </div>

        <div className="grid gap-1">
          <p className="text-sm font-medium">{t("Data e horário")}</p>
          <CampoDeDataEHora valor={quando} fuso={fuso} tag={tag} aoEscolher={setQuando} rotulo={t("Data e horário do compromisso")} />
        </div>

        <div className="grid gap-1">
          <p className="text-sm font-medium">{t("Responsável pela reunião")}</p>
          <SeletorEmPopup
            rotulo={t("Responsável pela reunião")}
            valor={responsavelId}
            opcoes={nomes}
            aoEscolher={(id) => {
              setResponsavelId(id);
              setResponsavelTocado(true);
            }}
          />
          <p className="text-xs text-text-muted">
            {responsavelTocado
              ? t("Só este compromisso muda: o CRM e a oportunidade continuam com o responsável deles.")
              : origemDoSugerido
                ? t(ROTULO_DA_ORIGEM_DO_RESPONSAVEL[origemDoSugerido])
                : t("Responsável do tipo de atendimento")}
          </p>
        </div>

        <label className="grid gap-1 sm:col-span-2">
          <span className="text-sm font-medium">{t("Anotações")}</span>
          <textarea
            value={notas}
            maxLength={2000}
            onChange={(e) => setNotas(e.target.value)}
            placeholder={t("Contexto para quem vai atender (opcional).")}
            className="min-h-20 w-full resize-y rounded-2xl border border-border bg-background px-3 py-2.5 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="rounded-xl" onClick={aoCancelar}>
          {t("Cancelar")}
        </Button>
        <Button
          type="button"
          className="rounded-xl"
          disabled={!pronto || criar.isPending}
          data-testid="criar-compromisso"
          onClick={() => criar.mutate()}
        >
          {criar.isPending ? t("Criando…") : t("Criar compromisso")}
        </Button>
      </div>
    </div>
  );
}
