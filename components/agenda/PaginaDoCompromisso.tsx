"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SeletorDeContato } from "@/components/kanban/SeletorDeContato";
import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { toast } from "sonner";
import { DialogoDaVenda, type DadosDaVenda } from "@/components/vendas/DialogoDaVenda";
import { TituloDaOportunidade } from "@/components/vendas/TituloDaOportunidade";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { modeloDoAtendimento } from "@/lib/agenda/atendimentos";
import { padraoDoModelo } from "@/lib/agenda/modelos-de-atendimento";
import { apiClient } from "@/lib/api/client";
import { formatCents as formatMoney } from "@/lib/money";
import { ArrowSquareOut, ChatCircle, Funnel, PencilSimple, Phone } from "@/lib/ui/icons";
import { blocosDoModelo } from "@/lib/agenda/modelos-de-atendimento";
import { randomId } from "@/lib/random-id";
import type { Bloco } from "@/lib/marketing/blocos";
import { EditorDoCompromisso } from "./EditorDoCompromisso";
import { pedirPagamentoDaOportunidade } from "@/lib/vendas-cliente";
import { useRouter } from "next/navigation";
import {
  ROTULO_DO_STATUS_DA_VENDA,
  STATUS_DA_VENDA,
  nomeDaVenda,
  type StatusDaVenda,
  type Venda,
} from "@/lib/vendas";

import { AtalhosDaOportunidade } from "./AtalhosDaOportunidade";
import { LoseLeadDialog } from "@/components/kanban/LoseLeadDialog";
import { corDoTipo } from "@/lib/agenda/cor-do-tipo";
import { BotaoExcluir, useAcoesDoCompromisso } from "./AcoesDoCompromisso";
import { Campo, LocalEditavel, MenuDeOpcoes, Tag, type CorDaTag } from "./CamposDoCompromisso";
import { useAuth } from "@/hooks/auth/AuthProvider";
import type { PedidoDeNovoCompromisso } from "@/lib/agenda/abrir-novo";
import { CampoDeDataEHora } from "./CampoDeDataEHora";
import { useModelosDeAtendimento } from "./modelos-hooks";
import {
  atendentesDoTipoNaMatriz,
  useAtendentesLivres,
  useMatrizDeAtendentes,
} from "./equipe-hooks";
import {
  FormularioDeNovoCompromisso,
  useContextoDeMarcacao,
  usePessoasDaEquipe,
} from "./FormularioDeNovoCompromisso";
import { MeetDoCompromisso, type MeetingDetail } from "./MeetDoCompromisso";
import { SincronizacaoDoCompromisso, type SyncDetail } from "./SincronizacaoDoCompromisso";

type Detalhe = {
  id: string;
  title: string;
  notes: string | null;
  description: string | null;
  location_kind: string | null;
  location_details: string | null;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  status: "pending" | "confirmed" | "completed" | "no_show" | "cancelled";
  revision: number;
  contact_id: string | null;
  lead_id: string | null;
  cliente: { nome: string | null; telefone: string | null; email: string | null } | null;
  blocos?: Bloco[] | null;
  tipo: { id: string; nome: string; slug: string; cor?: string | null } | null;
  remarcado_para?: string | null;
  oportunidade_titulo?: string | null;
  responsavel_id: string | null;
  eh_responsavel: boolean;
  meeting?: MeetingDetail | null;
  google_sync?: SyncDetail;
  client_confirmation?: "confirmed" | "reschedule" | "cancel" | null;
};

/**
 * O STATUS ÚNICO do compromisso, sempre um destes cinco: Não confirmado, Confirmado, Compareceu e
 * Comprou, Compareceu e Não comprou, Não compareceu. Quem compareceu mostra se comprou ou não pela
 * venda da oportunidade. (O compromisso remarcado fica como "Não compareceu", que é o que ele é no
 * banco; "Cancelado" só existe para o que foi cancelado e some das listas de trabalho.)
 */
export function statusDoCompromisso(
  a: Pick<Detalhe, "status"> & { remarcado_para?: string | null },
  vendeu: boolean,
): { rotulo: string; cor: CorDaTag } {
  switch (a.status) {
    case "pending":
      return { rotulo: "Não confirmado", cor: "amarelo" };
    case "confirmed":
      return { rotulo: "Confirmado", cor: "azul" };
    case "completed":
      return vendeu
        ? { rotulo: "Compareceu e Comprou", cor: "verde" }
        : { rotulo: "Compareceu e Não comprou", cor: "amarelo" };
    case "no_show":
      return { rotulo: "Não compareceu", cor: "vermelho" };
    default:
      return { rotulo: "Cancelado", cor: "cinza" };
  }
}

export const VENDIDAS = new Set([
  "comprometida",
  "concluida",
  "recorrencia_ativa",
  "recorrencia_encerrada",
]);

/** As mesmas cores do status na página da venda (roxo, laranja, verde, azul, marrom, cinza). */
const COR_DA_VENDA: Record<string, CorDaTag> = {
  interesse: "roxo",
  comprometida: "laranja",
  concluida: "verde",
  recorrencia_ativa: "azul",
  recorrencia_encerrada: "marrom",
  cancelada: "cinza",
};

type EtapaDoFunil = {
  id: string;
  name: string;
  color: string | null;
  is_won: boolean;
  is_lost: boolean;
  qualification: "mql" | "disqualified" | null;
};
/** Sem cor própria, a etapa de ganho é verde, a de perda vermelha, e as demais azuis. */
const corDaEtapa = (e: Pick<EtapaDoFunil, "is_won" | "is_lost">): CorDaTag =>
  e.is_won ? "verde" : e.is_lost ? "vermelho" : "azul";

/**
 * O título do compromisso, no topo da página: um campo que se edita no lugar (grava ao sair
 * do campo ou no Enter). Quem não pode editar vê só o texto.
 */
function TituloEditavel({
  valor,
  podeEditar,
  aoSalvar,
}: {
  valor: string;
  podeEditar: boolean;
  aoSalvar: (titulo: string) => void;
}) {
  const t = useT();
  const [rascunho, setRascunho] = React.useState<string | null>(null);
  if (!podeEditar) return <h2 className="text-xl font-semibold break-words">{valor}</h2>;
  const texto = rascunho ?? valor;
  const gravar = () => {
    const limpo = texto.trim();
    setRascunho(null);
    if (limpo && limpo !== valor) aoSalvar(limpo);
  };
  return (
    <input
      value={texto}
      maxLength={200}
      aria-label={t("Título do compromisso")}
      placeholder={t("Ex.: R1 · Nome do cliente")}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={gravar}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setRascunho(null);
          e.currentTarget.blur();
        }
      }}
      className="-mx-2 w-full min-w-0 rounded-xl border border-transparent bg-transparent px-2 py-1 text-xl font-semibold outline-hidden transition-colors hover:border-border focus:border-primary/50 focus:bg-background focus:ring-2 focus:ring-primary/20"
    />
  );
}

/**
 * A página única do compromisso: abre no centro da tela, de qualquer lugar da Agenda. Tem tudo que o
 * atendente precisa para atender dentro do app. O miolo do atendimento muda com o TIPO do compromisso.
 */
function PaginaExistente({
  id: idDaPagina,
  onClose,
  podeEditar = true,
}: {
  id: string | null;
  onClose: () => void;
  podeEditar?: boolean;
}) {
  // Remarcar cria OUTRO compromisso: a página passa a mostrar o novo, sem o pai precisar saber.
  const [idLocal, setIdLocal] = React.useState<string | null>(null);
  const id = idLocal ?? idDaPagina;
  const router = useRouter();
  const [trocandoCliente, setTrocandoCliente] = React.useState(false);
  const acoes = useAcoesDoCompromisso();
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const [editandoVenda, setEditandoVenda] = React.useState<false | { status?: StatusDaVenda }>(
    false,
  );
  const [abrindoOportunidade, setAbrindoOportunidade] = React.useState(false);

  const consulta = useQuery({
    queryKey: ["agenda", "detalhe", id],
    enabled: !!id,
    refetchInterval: 8000,
    queryFn: async () =>
      (await apiClient.get<{ data: Detalhe }>(`/api/v1/agenda/agendamentos/${id}`)).data,
  });
  const a = consulta.data;

  const pessoas = usePessoasDaEquipe();
  const nomeDoResponsavel =
    pessoas.data?.find((p) => p.user_id === a?.responsavel_id)?.full_name ?? null;
  const contexto = useContextoDeMarcacao(a?.contact_id ?? "", "");
  const matriz = useMatrizDeAtendentes();
  const modelosDosTipos = useModelosDeAtendimento();
  const livresNoHorario = useAtendentesLivres(a?.tipo?.id ?? null, a?.starts_at ?? null, a?.id);

  const oportunidade = useQuery({
    queryKey: ["venda-da-oportunidade", a?.lead_id],
    enabled: !!a?.lead_id,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?lead=${a!.lead_id}`)).data
        .vendas[0] ?? null,
  });
  const venda = oportunidade.data;

  const salvar = useMutation({
    mutationFn: async (patch: Record<string, unknown>) =>
      apiClient.patch("/api/v1/agenda/agendamentos", { id, revision: a?.revision, ...patch }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agenda"] });
    },
    onError: showApiError,
  });

  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ["agenda"] });
    void qc.invalidateQueries({ queryKey: ["venda-da-oportunidade"] });
    void consulta.refetch();
  };
  const reagendar = useMutation({
    mutationFn: async (iso: string) =>
      apiClient.patch<{ data: { id?: string } }>("/api/v1/agenda/agendamentos", {
        id,
        revision: a?.revision,
        starts_at: iso,
      }),
    onSuccess: (r) => {
      toast.success(t("Compromisso reagendado: o horário antigo ficou como não compareceu."));
      const novo = r.data?.id;
      if (novo && novo !== id) setIdLocal(novo);
      recarregar();
    },
    onError: showApiError,
  });
  const trocarResponsavel = useMutation({
    mutationFn: async (userId: string) =>
      apiClient.patch<{ data: { google?: string } }>(
        `/api/v1/agenda/agendamentos/${id}/responsavel`,
        { user_id: userId },
      ),
    onSuccess: (r) => {
      const g = r.data?.google;
      toast.success(
        g === "movido"
          ? t(
              "Responsável trocado. O evento saiu da agenda do Google de quem tinha e foi para a do novo.",
            )
          : g === "so_no_app"
            ? t(
                "Responsável trocado. Ele não conectou o Google: o compromisso fica só na agenda do app.",
              )
            : g === "remocao_pendente"
              ? t(
                  "Responsável trocado. Não consegui remover o evento da agenda do Google anterior: apague lá à mão.",
                )
              : t("Responsável do compromisso trocado."),
      );
      recarregar();
    },
    onError: showApiError,
  });
  const trocarOportunidade = useMutation({
    mutationFn: async (leadId: string) =>
      apiClient.patch(`/api/v1/agenda/agendamentos/${id}/oportunidade`, {
        lead_id: leadId || null,
      }),
    onSuccess: () => {
      toast.success(t("Oportunidade do compromisso atualizada."));
      recarregar();
    },
    onError: showApiError,
  });

  const tipos = useQuery({
    queryKey: ["agenda", "tipos-da-pagina"],
    enabled: !!id && podeEditar,
    staleTime: 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: Array<{ id: string; name: string; color?: string | null; is_active?: boolean }>;
        }>("/api/v1/agenda/tipos")
      ).data.filter((x) => x.is_active !== false),
  });
  const trocarTipo = useMutation({
    mutationFn: async (tipoId: string) =>
      apiClient.patch(`/api/v1/agenda/agendamentos/${id}/tipo`, { event_type_id: tipoId }),
    onSuccess: () => {
      toast.success(t("Tipo do compromisso atualizado."));
      recarregar();
    },
    onError: showApiError,
  });
  const trocarCliente = useMutation({
    mutationFn: async (contactId: string) =>
      apiClient.patch(`/api/v1/agenda/agendamentos/${id}/cliente`, { contact_id: contactId }),
    onSuccess: () => {
      toast.success(t("Cliente trocado: a oportunidade e a venda acompanham o novo cliente."));
      setTrocandoCliente(false);
      recarregar();
      void qc.invalidateQueries({ queryKey: ["agenda", "contexto-de-marcacao"] });
    },
    onError: showApiError,
  });
  const mudarVenda = useMutation({
    mutationFn: async (status: StatusDaVenda) =>
      apiClient.patch(`/api/v1/vendas/${a?.lead_id}`, { status }),
    onSuccess: () => {
      toast.success(t("Venda atualizada."));
      recarregar();
    },
    onError: showApiError,
  });
  async function abrirNoInbox() {
    const telefone = a?.cliente?.telefone?.trim();
    if (!telefone) return;
    try {
      const res = await fetch("/api/v1/conversations/open-with-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: a?.contact_id || undefined, phone_number: telefone }),
      });
      const json = (await res.json()) as { data?: { conversation_id: string } };
      if (!res.ok || !json.data?.conversation_id) throw new Error("falha");
      router.push(`/app/inbox?id=${json.data.conversation_id}`);
    } catch {
      toast.error(t("Não foi possível abrir a conversa."));
    }
  }

  const oport = useQuery({
    queryKey: ["agenda", "oportunidade-do-compromisso", id, a?.lead_id],
    enabled: !!id && !!a?.lead_id,
    staleTime: 10_000,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: {
            lead: {
              id: string;
              pipeline_id: string;
              stage_id: string;
              status: string;
              updated_at: string;
              proxima_acao: string | null;
              proxima_acao_em: string | null;
              expected_close_date: string | null;
            } | null;
            etapas: EtapaDoFunil[];
          };
        }>(`/api/v1/agenda/agendamentos/${id}/oportunidade`)
      ).data,
  });
  const [perdendo, setPerdendo] = React.useState<{
    leadId: string;
    funilId: string;
    etapaId?: string;
  } | null>(null);
  const mudarEtapa = useMutation({
    mutationFn: async (etapa: EtapaDoFunil) => {
      const lead = oport.data?.lead;
      if (!lead) return;
      // As mesmas regras do CRM: perda e desqualificação pedem o motivo; ganho exige o pagamento.
      if (etapa.is_lost) return setPerdendo({ leadId: lead.id, funilId: lead.pipeline_id });
      if (etapa.qualification === "disqualified")
        return setPerdendo({ leadId: lead.id, funilId: lead.pipeline_id, etapaId: etapa.id });
      if (etapa.is_won) {
        try {
          await apiClient.post(`/api/v1/leads/${lead.id}/win`, {});
        } catch (e) {
          if ((e as { code?: string }).code === "comprou_exige_pagamento")
            return pedirPagamentoDaOportunidade(lead.id);
          throw e;
        }
        return;
      }
      await apiClient.post(`/api/v1/leads/${lead.id}/move`, {
        stage_id: etapa.id,
        position_in_stage: new Date().getTime(),
        expected_updated_at: lead.updated_at,
      });
    },
    onSuccess: () => {
      toast.success(t("Etapa da oportunidade atualizada."));
      recarregar();
      void qc.invalidateQueries({ queryKey: ["clientes"] });
      void qc.invalidateQueries({ queryKey: ["board"] });
    },
    onError: showApiError,
  });
  const trocarLocal = useMutation({
    mutationFn: async (corpo: { location_kind: string; location_details: string }) =>
      apiClient.patch(`/api/v1/agenda/agendamentos/${id}/local`, corpo),
    onSuccess: () => {
      toast.success(t("Local atualizado."));
      recarregar();
    },
    onError: showApiError,
  });

  if (!id) return null;
  // A página de atendimento do TIPO (configurada na Agenda); sem configuração, o padrão do modelo.
  const cfg =
    (a?.tipo && modelosDosTipos.data?.[a.tipo.id]) ||
    padraoDoModelo(modeloDoAtendimento(a?.tipo ?? null));
  const comecou = a ? Date.parse(a.starts_at) <= Date.now() : false;
  const encerrado = a ? ["cancelled", "completed", "no_show"].includes(a.status) : false;
  const link = a?.meeting?.url ?? null;
  const parcelas = (venda?.parcelas ?? []).filter((p) => p.status !== "cancelada");
  const pago = parcelas
    .filter((p) => p.status === "recebida")
    .reduce((s, p) => s + p.amount_cents, 0);
  const total = parcelas.reduce((s, p) => s + p.amount_cents, 0);
  const etapasDoFunil = oport.data?.etapas ?? [];
  const etapaAtual = etapasDoFunil.find((e) => e.id === oport.data?.lead?.stage_id) ?? null;
  const vendeu = !!venda && VENDIDAS.has(venda.status);
  const statusUnico = a ? statusDoCompromisso(a, vendeu) : { rotulo: "", cor: "cinza" as CorDaTag };
  const fimDoCompromisso = a
    ? new Intl.DateTimeFormat(tag, {
        timeZone: a.time_zone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(a.ends_at))
    : "";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        data-testid="pagina-do-compromisso"
        className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-4xl grid-cols-[minmax(0,1fr)] gap-0 overflow-x-hidden overflow-y-auto rounded-3xl bg-background p-0 sm:rounded-3xl"
      >
        <DialogTitle className="sr-only">
          {a?.title ?? a?.cliente?.nome ?? t("Compromisso")}
        </DialogTitle>
        <DialogDescription className="sr-only">{t("Página do compromisso")}</DialogDescription>

        {consulta.isPending ? (
          <p className="p-8 text-sm text-text-muted">{t("Carregando…")}</p>
        ) : consulta.isError || !a ? (
          <div role="alert" className="space-y-3 p-8">
            <p>{t("Este compromisso está indisponível para você.")}</p>
            <Button onClick={() => void consulta.refetch()}>{t("Tentar novamente")}</Button>
          </div>
        ) : (
          <>
            <header className="flex min-w-0 flex-col gap-3 px-4 pt-4 pb-2 sm:px-6">
              {/* O TIPO em tag colorida e editável, depois a lixeira; o X da página fica logo depois. */}
              <div className="flex min-h-9 items-center justify-end gap-1 pr-11">
                {podeEditar && !encerrado && (tipos.data?.length ?? 0) > 0 ? (
                  <MenuDeOpcoes
                    alinhar="end"
                    gatilho={
                      <Tag
                        data-testid="tipo-do-compromisso"
                        hex={a.tipo ? corDoTipo(a.tipo.id) : null}
                        cor="azul"
                        editavel
                      >
                        {a.tipo?.nome ?? t("Atendimento")}
                      </Tag>
                    }
                    opcoes={(tipos.data ?? []).map((x) => ({
                      id: x.id,
                      rotulo: x.name,
                      desabilitado: x.id === a.tipo?.id || trocarTipo.isPending,
                      aoEscolher: () => trocarTipo.mutate(x.id),
                    }))}
                  />
                ) : (
                  <Tag hex={a.tipo ? corDoTipo(a.tipo.id) : null} cor="azul">
                    {a.tipo?.nome ?? t("Atendimento")}
                  </Tag>
                )}
                {podeEditar ? <BotaoExcluir id={a.id} aoExcluir={onClose} soIcone /> : null}
              </div>
              <div className="max-w-full min-w-0">
                <TituloEditavel
                  key={a.id}
                  valor={a.title !== a.tipo?.nome ? a.title : (a.cliente?.nome ?? a.title)}
                  podeEditar={podeEditar}
                  aoSalvar={(titulo) =>
                    salvar.mutate({ title: titulo }, { onSuccess: () => void consulta.refetch() })
                  }
                />
              </div>
            </header>

            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 px-4 pb-4 sm:px-6">
              <Campo rotulo={t("Data e hora")}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <div className="min-w-0 sm:w-64">
                    <CampoDeDataEHora
                      valor={a.starts_at}
                      fuso={a.time_zone}
                      tag={tag}
                      rotulo={t("Reagendar o compromisso")}
                      desabilitado={!podeEditar || encerrado || reagendar.isPending}
                      aoEscolher={(iso) => reagendar.mutate(iso)}
                      className="min-h-9 border-transparent bg-transparent px-1 hover:border-border"
                      horariosLivres={
                        a.tipo
                          ? { eventTypeId: a.tipo.id, ownerId: a.responsavel_id, ignorarId: a.id }
                          : undefined
                      }
                    />
                  </div>
                  <span className="whitespace-nowrap text-text-muted">
                    {t("até")} {fimDoCompromisso}
                  </span>
                </div>
              </Campo>

              <div className="grid gap-4 sm:grid-cols-2">
                <Campo rotulo={t("Status")}>
                  <div className="flex flex-wrap items-center gap-2">
                    {podeEditar && a.status !== "cancelled" && !a.remarcado_para ? (
                      <MenuDeOpcoes
                        gatilho={
                          <Tag data-testid="status-do-compromisso" cor={statusUnico.cor} editavel>
                            {t(statusUnico.rotulo)}
                          </Tag>
                        }
                        opcoes={(
                          [
                            ["confirmed", "Confirmado", false],
                            ["comprou", "Compareceu e Comprou", true],
                            ["nao_comprou", "Compareceu e Não comprou", true],
                            ["no_show", "Não compareceu", true],
                          ] as const
                        ).map(([opcao, rotulo, soDepois]) => ({
                          id: opcao,
                          rotulo: t(rotulo),
                          desabilitado:
                            salvar.isPending || acoes.resultado.isPending || (soDepois && !comecou),
                          dica:
                            soDepois && !comecou
                              ? t("Disponível quando a reunião começar")
                              : undefined,
                          aoEscolher: () =>
                            opcao === "confirmed"
                              ? a.status === "pending"
                                ? acoes.confirmar.mutate(a.id)
                                : salvar.mutate({ status: "confirmed" })
                              : acoes.resultado.mutate({ id: a.id, opcao, leadId: a.lead_id }),
                        }))}
                      />
                    ) : (
                      <Tag cor={statusUnico.cor}>{t(statusUnico.rotulo)}</Tag>
                    )}
                    {a.client_confirmation === "confirmed" && (
                      <Tag cor="verde">{t("Cliente confirmou")}</Tag>
                    )}
                  </div>
                </Campo>

                <div className="min-w-0">
                  <div className="mb-1 text-xs font-medium text-text-muted">{t("Responsável")}</div>
                  {podeEditar && !encerrado ? (
                    <SeletorEmPopup
                      rotulo={t("Responsável pela reunião")}
                      valor={a.responsavel_id ?? ""}
                      opcoes={(() => {
                        const doTipo = a.tipo
                          ? atendentesDoTipoNaMatriz(matriz.data, a.tipo.id)
                          : [];
                        const livres = new Set((livresNoHorario.data ?? []).map((l) => l.user_id));
                        return (pessoas.data ?? [])
                          .filter(
                            (p) =>
                              p.user_id === a.responsavel_id ||
                              ((doTipo.length === 0 || doTipo.includes(p.user_id)) &&
                                (!livresNoHorario.isSuccess || livres.has(p.user_id))),
                          )
                          .map((p) => ({
                            id: p.user_id,
                            rotulo: (p.full_name ?? "").trim() || t("Pessoa da equipe"),
                          }));
                      })()}
                      desabilitado={trocarResponsavel.isPending}
                      aoEscolher={(uid) =>
                        uid && uid !== a.responsavel_id && trocarResponsavel.mutate(uid)
                      }
                    />
                  ) : (
                    <div className="flex min-h-10 items-center rounded-xl border border-border bg-card px-3 text-sm">
                      {nomeDoResponsavel ?? "—"}
                    </div>
                  )}
                </div>
              </div>

              <Campo rotulo={t("Cliente")}>
                <div className="flex min-h-8 items-center gap-1">
                  {a.contact_id ? (
                    <Link
                      href={`/app/contacts/${a.contact_id}`}
                      className="inline-flex min-w-0 items-center gap-1 underline"
                    >
                      <span className="truncate">{a.cliente?.nome ?? t("Ver contato")}</span>
                      <ArrowSquareOut size={12} className="shrink-0" aria-hidden />
                    </Link>
                  ) : (
                    <span className="min-w-0 truncate text-text-muted">
                      {t("Compromisso pessoal, sem cliente")}
                    </span>
                  )}
                  <span className="ml-auto flex shrink-0 items-center gap-0.5">
                    {a.cliente?.telefone ? (
                      <>
                        <button
                          type="button"
                          aria-label={t("Abrir conversa no Inbox")}
                          title={t("Abrir conversa no Inbox")}
                          onClick={() => void abrirNoInbox()}
                          className="grid h-7 w-7 place-items-center rounded-lg hover:bg-secondary"
                        >
                          <ChatCircle size={16} aria-hidden />
                        </button>
                        <a
                          href={`tel:${a.cliente.telefone}`}
                          aria-label={t("Ligar para o cliente")}
                          title={a.cliente.telefone}
                          className="grid h-7 w-7 place-items-center rounded-lg hover:bg-secondary"
                        >
                          <Phone size={16} aria-hidden />
                        </a>
                      </>
                    ) : null}
                    {podeEditar && !encerrado ? (
                      <button
                        type="button"
                        aria-label={t("Trocar o cliente")}
                        title={t("Trocar o cliente")}
                        onClick={() => setTrocandoCliente(true)}
                        className="grid h-7 w-7 place-items-center rounded-lg hover:bg-secondary"
                      >
                        <PencilSimple size={14} aria-hidden />
                      </button>
                    ) : null}
                  </span>
                </div>
              </Campo>

              <div className="min-w-0">
                <Campo rotulo={t("Reunião")}>
                  <LocalEditavel
                    key={`${a.id}-${a.location_kind}-${a.location_details}`}
                    tipo={a.location_kind}
                    detalhes={a.location_details}
                    linkDoMeet={link}
                    estadoDoLink={a.meeting?.state ?? null}
                    podeEditar={podeEditar && a.status !== "cancelled"}
                    aoSalvar={(kind, texto) =>
                      trocarLocal.mutate({ location_kind: kind, location_details: texto })
                    }
                  />
                </Campo>
                {a.google_sync || a.meeting ? (
                  <details className="mt-2 rounded-xl border border-border px-3 py-2 text-sm">
                    <summary className="cursor-pointer text-text-muted">
                      {t("Google Agenda e Meet")}
                    </summary>
                    <div className="mt-2 space-y-3">
                      {a.google_sync && (
                        <SincronizacaoDoCompromisso
                          key={a.id}
                          id={a.id}
                          sync={a.google_sync}
                          onSaved={() => void consulta.refetch()}
                        />
                      )}
                      {a.meeting && (
                        <MeetDoCompromisso
                          id={a.id}
                          revision={a.google_sync?.revision ?? String(a.revision)}
                          meeting={a.meeting}
                          onSaved={() => void consulta.refetch()}
                        />
                      )}
                    </div>
                  </details>
                ) : null}
              </div>
            </div>

            {cfg.blocos.oportunidade ? (
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 px-4 pb-4 sm:px-6">
                <section
                  className="min-w-0 rounded-2xl border border-border bg-card/50 p-3 sm:p-4"
                  data-testid="secao-oportunidade"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">{t("Oportunidade")}</h3>
                    {a.lead_id ? (
                      // O popup da oportunidade abre POR CIMA do compromisso (a página antiga do funil
                      // não existe mais): fechar volta exatamente para cá.
                      <button
                        type="button"
                        data-testid="abrir-oportunidade"
                        disabled={!venda}
                        onClick={() => setAbrindoOportunidade(true)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium whitespace-nowrap hover:bg-secondary disabled:opacity-50"
                      >
                        <ArrowSquareOut size={14} aria-hidden />
                        {t("Abrir oportunidade")}
                      </button>
                    ) : null}
                  </div>
                  {!a.contact_id ? (
                    <p className="text-sm text-text-muted">{t("Sem cliente, sem oportunidade.")}</p>
                  ) : (
                    <div className="grid gap-2">
                      {podeEditar &&
                      !encerrado &&
                      (contexto.data?.oportunidades ?? []).length > 1 ? (
                        <div className="sm:max-w-md">
                          <SeletorEmPopup
                            rotulo={t("Oportunidade do compromisso")}
                            valor={a.lead_id ?? ""}
                            rotuloVazio={t("Sem oportunidade (atendimento ao cliente)")}
                            desabilitado={trocarOportunidade.isPending}
                            opcoes={(contexto.data?.oportunidades ?? []).map((o) => ({
                              id: o.id,
                              rotulo: `${o.titulo}${o.funil ? ` · ${o.funil}` : ""}${o.etapa ? ` › ${o.etapa}` : ""}`,
                            }))}
                            aoEscolher={(lid) =>
                              lid !== (a.lead_id ?? "") && trocarOportunidade.mutate(lid)
                            }
                          />
                        </div>
                      ) : null}
                      {!a.lead_id ? (
                        <p className="text-sm text-text-muted">
                          {t("Este compromisso não está ligado a uma oportunidade.")}
                        </p>
                      ) : oportunidade.isPending ? (
                        <p className="text-sm text-text-muted">{t("Carregando…")}</p>
                      ) : !venda ? (
                        <p className="text-sm text-text-muted">{t("Oportunidade indisponível.")}</p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:flex-nowrap">
                          <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                            <TituloDaOportunidadeDoCompromisso venda={venda} podeEditar={podeEditar} />
                          </div>
                          {etapaAtual ? (
                            podeEditar && etapasDoFunil.length > 0 ? (
                              <MenuDeOpcoes
                                alinhar="end"
                                gatilho={
                                  <Tag
                                    data-testid="etapa-da-oportunidade"
                                    hex={etapaAtual.color}
                                    cor={corDaEtapa(etapaAtual)}
                                    editavel
                                  >
                                    {etapaAtual.name}
                                  </Tag>
                                }
                                opcoes={etapasDoFunil.map((e) => ({
                                  id: e.id,
                                  rotulo: e.name,
                                  desabilitado: e.id === etapaAtual.id || mudarEtapa.isPending,
                                  aoEscolher: () => mudarEtapa.mutate(e),
                                }))}
                              />
                            ) : (
                              <Tag hex={etapaAtual.color} cor={corDaEtapa(etapaAtual)}>
                                {etapaAtual.name}
                              </Tag>
                            )
                          ) : venda.etapa ? (
                            <Tag cor="azul">{venda.etapa}</Tag>
                          ) : null}
                          <span className="inline-flex items-center gap-1.5 text-text-muted">
                            <Funnel size={14} aria-hidden />
                            {venda.funil ?? "—"}
                          </span>
                        </div>
                      )}
                      {a.lead_id && venda ? (
                        <AtalhosDaOportunidade
                          key={a.lead_id}
                          leadId={a.lead_id}
                          podeEditar={podeEditar}
                          proximaAcao={oport.data?.lead?.proxima_acao ?? null}
                          proximaAcaoEm={oport.data?.lead?.proxima_acao_em ?? null}
                          previsao={oport.data?.lead?.expected_close_date ?? null}
                          aoSalvar={() => {
                            void oport.refetch();
                            void qc.invalidateQueries({ queryKey: ["venda-da-oportunidade"] });
                          }}
                        />
                      ) : null}
                    </div>
                  )}
                </section>

                {venda ? (
                  <section
                    className="min-w-0 rounded-2xl border border-border bg-card/50 p-3 sm:p-4"
                    data-testid="secao-venda"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-base font-semibold">{t("Venda")}</h3>
                      {/* Abre só a página da venda (a oportunidade tem o seu próprio botão). */}
                      <button
                        type="button"
                        data-testid="abrir-venda"
                        aria-label={t("Abrir a venda")}
                        title={t("Abrir a venda")}
                        onClick={() => setEditandoVenda({})}
                        className="grid size-8 place-items-center rounded-lg border border-border hover:bg-secondary"
                      >
                        <ArrowSquareOut size={14} aria-hidden />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm sm:flex-nowrap">
                      <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                        <TituloDaOportunidadeDoCompromisso venda={venda} podeEditar={podeEditar} />
                      </div>
                      <span className="text-base font-semibold tabular-nums">
                        {formatMoney(venda.amount_cents, venda.currency)}
                      </span>
                      {podeEditar && a.lead_id ? (
                        <MenuDeOpcoes
                          alinhar="end"
                          gatilho={
                            <Tag
                              data-testid="status-da-venda"
                              cor={COR_DA_VENDA[venda.status] ?? "cinza"}
                              editavel
                            >
                              {t(ROTULO_DO_STATUS_DA_VENDA[venda.status] ?? venda.status)}
                            </Tag>
                          }
                          // O MESMO campo e as MESMAS opções da página da venda. Pago, Cancelado e
                          // Recorrência encerrada abrem a página da venda (pagamento ou motivo); os
                          // demais gravam na hora.
                          opcoes={STATUS_DA_VENDA.map((novo) => ({
                            id: novo,
                            rotulo: t(ROTULO_DO_STATUS_DA_VENDA[novo]),
                            desabilitado: mudarVenda.isPending || venda.status === novo,
                            aoEscolher: () =>
                              novo === "concluida" ||
                              novo === "cancelada" ||
                              novo === "recorrencia_encerrada"
                                ? setEditandoVenda({ status: novo })
                                : mudarVenda.mutate(novo),
                          }))}
                        />
                      ) : (
                        <Tag cor={COR_DA_VENDA[venda.status] ?? "cinza"}>
                          {t(ROTULO_DO_STATUS_DA_VENDA[venda.status] ?? venda.status)}
                        </Tag>
                      )}
                    </div>
                    {venda.status === "concluida" ||
                    venda.status === "comprometida" ||
                    parcelas.length > 0 ? (
                      <div className="mt-3 space-y-2 rounded-xl border border-border p-3 text-sm">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {[
                            [t("Valor"), formatMoney(venda.amount_cents, venda.currency)],
                            [t("Pago"), formatMoney(pago, venda.currency)],
                            [
                              t("A receber"),
                              formatMoney(Math.max(total - pago, 0), venda.currency),
                            ],
                          ].map(([r, v]) => (
                            <div key={r} className="rounded-xl bg-background px-2 py-2">
                              <div className="text-[11px] text-text-muted">{r}</div>
                              <div className="font-semibold tabular-nums">{v}</div>
                            </div>
                          ))}
                        </div>
                        {parcelas.length > 0 && (
                          <ul className="divide-y divide-border rounded-xl border border-border">
                            {parcelas.map((p) => (
                              <li
                                key={p.id ?? p.number}
                                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                              >
                                <span className="tabular-nums">
                                  {p.number}ª ·{" "}
                                  {new Date(`${p.due_on}T12:00:00`).toLocaleDateString(tag)}
                                </span>
                                <span className="tabular-nums">
                                  {formatMoney(p.amount_cents, venda.currency)}
                                </span>
                                <Tag cor={p.status === "recebida" ? "verde" : "amarelo"}>
                                  {p.status === "recebida" ? t("Pago") : t("Comprometido")}
                                </Tag>
                              </li>
                            ))}
                          </ul>
                        )}
                        {podeEditar ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setEditandoVenda({})}
                          >
                            {t("Editar venda e parcelas")}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                ) : null}
              </div>
            ) : null}

            {/* O editor de blocos: abre com o modelo do tipo e se adapta só neste compromisso */}
            <div className="border-t border-border px-4 pt-4 pb-6 sm:px-8">
              <EditorDoCompromisso
                key={a.id}
                id={a.id}
                salvos={a.blocos ?? null}
                modelo={blocosDoModelo(cfg, randomId)}
                notasAntigas={a.notes}
                podeEditar={podeEditar}
                titulo={a.title}
                aoSalvar={() =>
                  void qc.invalidateQueries({ queryKey: ["agenda", "detalhe", a.id] })
                }
              />
            </div>
          </>
        )}

        {perdendo ? (
          <LoseLeadDialog
            open
            leadId={perdendo.leadId}
            pipelineId={perdendo.funilId}
            stageId={perdendo.etapaId}
            onOpenChange={(aberto) => {
              if (aberto) return;
              setPerdendo(null);
              recarregar();
              void qc.invalidateQueries({ queryKey: ["clientes"] });
            }}
          />
        ) : null}

        {trocandoCliente ? (
          <Dialog open onOpenChange={(o) => !o && setTrocandoCliente(false)}>
            <DialogContent className="max-w-md rounded-3xl">
              <DialogTitle>{t("Trocar o cliente")}</DialogTitle>
              <DialogDescription>
                {t("A oportunidade e a venda do compromisso passam a ser as do novo cliente.")}
              </DialogDescription>
              <SeletorDeContato
                escolhido={null}
                onEscolher={(c) => c && trocarCliente.mutate(c.id)}
              />
            </DialogContent>
          </Dialog>
        ) : null}

        {abrindoOportunidade && venda ? (
          <DialogoDaVenda
            key={`oportunidade-${venda.id}`}
            modo="oportunidade"
            venda={venda}
            contatoInicial={{ contact_id: venda.contact_id, nome: venda.cliente?.nome ?? "" }}
            clientes={[]}
            negocio={
              etapasDoFunil.length > 0
                ? {
                    etapas: etapasDoFunil.map((e) => ({ id: e.id, nome: e.name })),
                    etapaId: oport.data?.lead?.stage_id ?? null,
                    aoMoverEtapa: async (etapaId: string) => {
                      const etapa = etapasDoFunil.find((e) => e.id === etapaId);
                      if (etapa) await mudarEtapa.mutateAsync(etapa);
                    },
                  }
                : undefined
            }
            aoFechar={() => {
              setAbrindoOportunidade(false);
              recarregar();
            }}
            aoSalvar={async (v: DadosDaVenda) => {
              try {
                const { id: vid, contact_id: _c, ...resto } = v;
                await apiClient.patch(`/api/v1/vendas/${vid ?? venda.id}`, resto);
                await qc.invalidateQueries();
                setAbrindoOportunidade(false);
                return true;
              } catch (e) {
                showApiError(e);
                return false;
              }
            }}
          />
        ) : null}

        {editandoVenda && venda ? (
          <DialogoDaVenda
            key={venda.id}
            modo="venda"
            abrirComStatus={editandoVenda.status}
            venda={venda}
            contatoInicial={{ contact_id: venda.contact_id, nome: venda.cliente?.nome ?? "" }}
            clientes={[]}
            aoFechar={() => setEditandoVenda(false)}
            aoSalvar={async (v: DadosDaVenda) => {
              try {
                const { id: vid, contact_id: _c, ...resto } = v;
                await apiClient.patch(`/api/v1/vendas/${vid ?? venda.id}`, resto);
                await qc.invalidateQueries();
                setEditandoVenda(false);
                return true;
              } catch (e) {
                showApiError(e);
                return false;
              }
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * A página do compromisso. Com `id`, abre o compromisso; com `novo`, abre o formulário de um
 * compromisso novo e, ao criar, passa para a página dele.
 */
/**
 * O título da oportunidade na página do compromisso: o MESMO campo do popup da oportunidade e da
 * venda (`TituloDaOportunidade`, o `name` da venda). Aparece nas seções Oportunidade e Venda e edita
 * o mesmo dado: grava ao sair do campo.
 */
function TituloDaOportunidadeDoCompromisso({
  venda,
  podeEditar,
}: {
  venda: Venda;
  podeEditar: boolean;
}) {
  const qc = useQueryClient();
  const nome = nomeDaVenda(venda);
  const [rascunho, setRascunho] = React.useState<string | null>(null);
  const gravar = useMutation({
    mutationFn: async (novo: string) => apiClient.patch(`/api/v1/vendas/${venda.id}`, { name: novo }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["venda-da-oportunidade"] });
      void qc.invalidateQueries({ queryKey: ["agenda"] });
    },
    onError: showApiError,
    onSettled: () => setRascunho(null),
  });
  return (
    <TituloDaOportunidade
      // Mesmo campo e mesmo dado do título; aqui só no tamanho de um texto normal.
      className="w-full text-sm font-normal"
      valor={rascunho ?? nome}
      desabilitado={!podeEditar}
      aoMudar={setRascunho}
      aoSair={() => {
        const novo = (rascunho ?? "").trim();
        if (rascunho === null || novo === nome || novo === "") {
          setRascunho(null);
          return;
        }
        gravar.mutate(novo);
      }}
    />
  );
}

export function PaginaDoCompromisso({
  id,
  novo,
  onClose,
  onCriado,
  podeEditar = true,
}: {
  id?: string | null;
  novo?: PedidoDeNovoCompromisso | null;
  onClose: () => void;
  /** Avisa o id do compromisso recém-criado (quem abriu decide se continua com ele aberto). */
  onCriado?: (id: string) => void;
  podeEditar?: boolean;
}) {
  const { user } = useAuth();
  if (id) return <PaginaExistente id={id} onClose={onClose} podeEditar={podeEditar} />;
  if (!novo) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        data-testid="pagina-do-compromisso"
        className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-3xl grid-cols-[minmax(0,1fr)] gap-0 overflow-x-hidden overflow-y-auto rounded-3xl bg-background p-0 sm:rounded-3xl"
      >
        <DialogTitle className="sr-only">Novo compromisso</DialogTitle>
        <DialogDescription className="sr-only">Formulário de novo compromisso</DialogDescription>
        <FormularioDeNovoCompromisso
          inicial={novo}
          usuarioId={user.id}
          aoCancelar={onClose}
          aoCriar={(novoId) => onCriado?.(novoId)}
        />
      </DialogContent>
    </Dialog>
  );
}
