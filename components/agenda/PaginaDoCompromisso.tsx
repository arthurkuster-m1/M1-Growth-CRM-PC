"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SeletorDeContato } from "@/components/kanban/SeletorDeContato";
import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { toast } from "sonner";
import { DialogoDaVenda, type DadosDaVenda } from "@/components/vendas/DialogoDaVenda";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { modeloDoAtendimento } from "@/lib/agenda/atendimentos";
import { padraoDoModelo } from "@/lib/agenda/modelos-de-atendimento";
import { apiClient } from "@/lib/api/client";
import { rotuloDoLocal } from "@/lib/agenda/locais";
import { formatCents as formatMoney } from "@/lib/money";
import {
  ArrowSquareOut,
  CalendarBlank,
  ChatCircle,
  Copy,
  Flag,
  Funnel,
  LinkSimple,
  PencilSimple,
  Phone,
  Users,
} from "@/lib/ui/icons";
import { blocosDoModelo } from "@/lib/agenda/modelos-de-atendimento";
import { randomId } from "@/lib/random-id";
import type { Bloco } from "@/lib/marketing/blocos";
import { EditorDoCompromisso } from "./EditorDoCompromisso";
import { ROTULO_DO_LOCAL } from "@/lib/agenda/propriedades-do-compromisso";
import { pedirPagamentoDaOportunidade } from "@/lib/vendas-cliente";
import { useRouter } from "next/navigation";
import type { Venda } from "@/lib/vendas";
import { cn } from "@/lib/utils";

import { BotaoExcluir, useAcoesDoCompromisso } from "./AcoesDoCompromisso";
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

type VarianteDeTag = "default" | "warning" | "success" | "error" | "neutral";

/**
 * O STATUS ÚNICO do compromisso: o que a situação do banco e o resultado da reunião diziam em dois
 * lugares agora é uma tag só. Quem compareceu mostra se comprou ou não pela venda da oportunidade;
 * o compromisso que foi remarcado mostra "Remarcado".
 */
export function statusDoCompromisso(
  a: Pick<Detalhe, "status" | "remarcado_para">,
  vendeu: boolean,
): { rotulo: string; variante: VarianteDeTag } {
  if (a.remarcado_para) return { rotulo: "Remarcado", variante: "neutral" };
  switch (a.status) {
    case "pending":
      return { rotulo: "Aguardando confirmação", variante: "warning" };
    case "confirmed":
      return { rotulo: "Confirmado", variante: "default" };
    case "completed":
      return vendeu
        ? { rotulo: "Compareceu e Comprou", variante: "success" }
        : { rotulo: "Compareceu e Não comprou", variante: "warning" };
    case "no_show":
      return { rotulo: "Não compareceu", variante: "error" };
    default:
      return { rotulo: "Cancelado", variante: "neutral" };
  }
}

const VENDIDAS = new Set([
  "comprometida",
  "concluida",
  "recorrencia_ativa",
  "recorrencia_encerrada",
]);

const STATUS_DA_VENDA: Record<string, string> = {
  interesse: "Em interesse",
  comprometida: "Comprometida",
  concluida: "Paga",
  recorrencia_ativa: "Recorrência ativa",
  recorrencia_encerrada: "Recorrência encerrada",
  cancelada: "Não comprou",
};
const VARIANTE_DA_VENDA: Record<string, VarianteDeTag> = {
  interesse: "neutral",
  comprometida: "warning",
  concluida: "success",
  recorrencia_ativa: "success",
  recorrencia_encerrada: "neutral",
  cancelada: "error",
};

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

function Prop({
  icone: Icone,
  rotulo,
  children,
}: {
  icone: React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-9 grid-cols-[7rem_minmax(0,1fr)] items-start gap-x-2 py-0.5 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
      <div className="flex min-h-9 items-center gap-2 text-text-muted">
        <Icone size={16} aria-hidden />
        <span className="truncate">{rotulo}</span>
      </div>
      <div className="min-w-0 self-center">{children}</div>
    </div>
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
  const [editandoVenda, setEditandoVenda] = React.useState(false);

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
    mutationFn: async (status: "comprometida" | "cancelada") =>
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
  const vendeu = !!venda && VENDIDAS.has(venda.status);
  const statusUnico = a
    ? statusDoCompromisso(a, vendeu)
    : { rotulo: "", variante: "neutral" as VarianteDeTag };
  const fimDoCompromisso = a
    ? new Intl.DateTimeFormat(tag, {
        timeZone: a.time_zone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(a.ends_at))
    : "";
  // O local: link da reunião (Meet/vídeo) ou endereço; com o link pendente ou falho, diz isso no lugar.
  const ehVideo = a?.location_kind === "google_meet" || a?.location_kind === "video_link";
  const estadoDoLink = a?.meeting?.state ?? null;
  const valorDoLocal: string | null = !a
    ? null
    : ehVideo
      ? (link ??
        (estadoDoLink === "failed"
          ? t("Falha ao gerar o link")
          : estadoDoLink === "pending"
            ? t("Gerando o link…")
            : (a.location_details ?? null)))
      : (a.location_details ?? null);
  const destinoParaAbrir: string | null = !a
    ? null
    : link
      ? link
      : !ehVideo && a.location_details && a.location_kind === "in_person"
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.location_details)}`
        : ehVideo && a.location_details && /^https?:\/\//i.test(a.location_details)
          ? a.location_details
          : null;

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
            <header className="flex min-w-0 flex-col gap-2 px-4 pt-12 pb-2 sm:px-8 sm:pt-6 sm:pr-14">
              {/* o TIPO, em tag editável, no canto superior direito acima do título */}
              <div className="flex min-h-7 items-center justify-between gap-2">
                {podeEditar ? <BotaoExcluir id={a.id} aoExcluir={onClose} /> : <span />}
                {podeEditar && !encerrado && (tipos.data?.length ?? 0) > 0 ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        data-testid="tipo-do-compromisso"
                        aria-label={t("Tipo do compromisso")}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium whitespace-nowrap hover:bg-secondary"
                      >
                        {a.tipo?.cor ? (
                          <span
                            aria-hidden
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: a.tipo.cor }}
                          />
                        ) : null}
                        <span className="truncate">{a.tipo?.nome ?? t("Atendimento")}</span>
                        <PencilSimple size={12} aria-hidden />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 p-1.5">
                      {(tipos.data ?? []).map((x) => (
                        <button
                          key={x.id}
                          type="button"
                          disabled={trocarTipo.isPending}
                          onClick={() => x.id !== a.tipo?.id && trocarTipo.mutate(x.id)}
                          className={cn(
                            "flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-secondary",
                            x.id === a.tipo?.id && "bg-secondary font-medium",
                          )}
                        >
                          {x.color ? (
                            <span
                              aria-hidden
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: x.color }}
                            />
                          ) : null}
                          <span className="truncate">{x.name}</span>
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Badge variant="neutral" className="rounded-lg">
                    {a.tipo?.nome ?? t("Atendimento")}
                  </Badge>
                )}
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

            {/* As propriedades, como numa página do Notion: nome à esquerda, valor à direita. */}
            <div className="grid min-w-0 gap-0.5 px-4 pb-4 sm:px-8">
              <Prop icone={CalendarBlank} rotulo={t("Data e Hora")}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <div className="min-w-0 sm:w-64">
                    <CampoDeDataEHora
                      valor={a.starts_at}
                      fuso={a.time_zone}
                      tag={tag}
                      rotulo={t("Reagendar o compromisso")}
                      desabilitado={!podeEditar || encerrado || reagendar.isPending}
                      aoEscolher={(iso) => reagendar.mutate(iso)}
                      className="border-transparent bg-transparent hover:border-border"
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
                {podeEditar && !encerrado ? (
                  <p className="mt-0.5 text-[11px] text-text-muted">
                    {t(
                      "Trocar o horário remarca: o compromisso antigo fica como não compareceu e nasce um novo.",
                    )}
                  </p>
                ) : null}
              </Prop>

              <Prop icone={Flag} rotulo={t("Status")}>
                <div className="flex flex-wrap items-center gap-2">
                  {podeEditar && a.status !== "cancelled" && !a.remarcado_para ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          data-testid="status-do-compromisso"
                          className="rounded-lg"
                        >
                          <Badge
                            variant={statusUnico.variante}
                            className="cursor-pointer gap-1 rounded-lg"
                          >
                            {t(statusUnico.rotulo)}
                            <PencilSimple size={11} aria-hidden />
                          </Badge>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-64 p-1.5">
                        {(
                          [
                            ["confirmed", "Confirmado", false],
                            ["comprou", "Compareceu e Comprou", true],
                            ["nao_comprou", "Compareceu e Não comprou", true],
                            ["no_show", "Não compareceu", true],
                          ] as const
                        ).map(([opcao, rotulo, soDepois]) => (
                          <button
                            key={opcao}
                            type="button"
                            disabled={
                              salvar.isPending ||
                              acoes.resultado.isPending ||
                              (soDepois && !comecou)
                            }
                            title={
                              soDepois && !comecou
                                ? t("Disponível quando a reunião começar")
                                : undefined
                            }
                            onClick={() =>
                              opcao === "confirmed"
                                ? a.status === "pending"
                                  ? acoes.confirmar.mutate(a.id)
                                  : salvar.mutate({ status: "confirmed" })
                                : acoes.resultado.mutate({ id: a.id, opcao, leadId: a.lead_id })
                            }
                            className="flex min-h-9 w-full items-center rounded-md px-2 text-left text-sm hover:bg-secondary disabled:opacity-50"
                          >
                            {t(rotulo)}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Badge variant={statusUnico.variante} className="rounded-lg">
                      {t(statusUnico.rotulo)}
                    </Badge>
                  )}
                  {a.client_confirmation === "confirmed" && (
                    <Badge variant="success" className="rounded-lg">
                      {t("Cliente confirmou")}
                    </Badge>
                  )}
                </div>
              </Prop>

              <Prop icone={Users} rotulo={t("Responsável")}>
                {podeEditar && !encerrado ? (
                  <SeletorEmPopup
                    rotulo={t("Responsável pela reunião")}
                    valor={a.responsavel_id ?? ""}
                    className="border-transparent bg-transparent hover:border-border"
                    opcoes={(() => {
                      const doTipo = a.tipo ? atendentesDoTipoNaMatriz(matriz.data, a.tipo.id) : [];
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
                  <span>{nomeDoResponsavel ?? "—"}</span>
                )}
              </Prop>

              <Prop icone={Users} rotulo={t("Cliente")}>
                <div className="flex min-h-9 items-center gap-1">
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
              </Prop>

              <Prop icone={LinkSimple} rotulo={ehVideo ? t("Link da Reunião") : t("Endereço")}>
                <div className="flex min-h-9 items-center gap-2">
                  <Badge variant="neutral" className="shrink-0 rounded-md px-1.5 py-0 text-[11px]">
                    {t(
                      ROTULO_DO_LOCAL[a.location_kind ?? ""] ??
                        rotuloDoLocal(a.location_kind, null) ??
                        "—",
                    )}
                  </Badge>
                  <span
                    className={cn("min-w-0 flex-1 truncate", !valorDoLocal && "text-text-muted")}
                  >
                    {valorDoLocal ?? t("Sem link ou endereço")}
                  </span>
                  {valorDoLocal ? (
                    <>
                      <button
                        type="button"
                        aria-label={t("Copiar")}
                        title={t("Copiar")}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-secondary"
                        onClick={() => {
                          void navigator.clipboard?.writeText(valorDoLocal);
                          toast.success(t("Copiado."));
                        }}
                      >
                        <Copy size={15} aria-hidden />
                      </button>
                      {destinoParaAbrir ? (
                        <a
                          href={destinoParaAbrir}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={t("Abrir")}
                          title={t("Abrir")}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-secondary"
                        >
                          <ArrowSquareOut size={15} aria-hidden />
                        </a>
                      ) : null}
                    </>
                  ) : null}
                </div>
                {a.google_sync || a.meeting ? (
                  <details className="mt-1 rounded-xl border border-border px-3 py-2 text-sm">
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
              </Prop>
            </div>

            {cfg.blocos.oportunidade ? (
              <div className="grid min-w-0 gap-4 px-4 pb-4 sm:px-8">
                {/* Oportunidade: nome + etapa do funil na mesma linha, e o funil; sempre do cliente */}
                <section>
                  <h3 className="mb-1 text-lg font-semibold">{t("Oportunidade")}</h3>
                  {!a.contact_id ? (
                    <p className="text-sm text-text-muted">{t("Sem cliente, sem oportunidade.")}</p>
                  ) : (
                    <div className="grid gap-0.5">
                      {podeEditar &&
                      !encerrado &&
                      (contexto.data?.oportunidades ?? []).length > 1 ? (
                        <div className="mb-1 sm:max-w-md">
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
                        <>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="min-w-0 truncate font-medium">
                              {a.oportunidade_titulo ||
                                venda.name ||
                                venda.product_name ||
                                t("Oportunidade")}
                            </span>
                            {venda.etapa ? (
                              <Badge variant="neutral" className="rounded-lg">
                                {venda.etapa}
                              </Badge>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-text-muted">
                            <Funnel size={14} aria-hidden />
                            {venda.funil ?? "—"}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </section>

                {/* Venda: produto de interesse + valor + status na mesma linha; o pagamento abre embaixo */}
                {venda ? (
                  <section>
                    <h3 className="mb-1 text-lg font-semibold">{t("Venda")}</h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                      <span className="min-w-0 flex-1 truncate">
                        {venda.product_name || venda.name || t("Produto de interesse")}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatMoney(venda.amount_cents, venda.currency)}
                      </span>
                      {podeEditar && a.lead_id ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              data-testid="status-da-venda"
                              className="rounded-lg"
                            >
                              <Badge
                                variant={VARIANTE_DA_VENDA[venda.status] ?? "neutral"}
                                className="cursor-pointer gap-1 rounded-lg"
                              >
                                {t(STATUS_DA_VENDA[venda.status] ?? venda.status)}
                                <PencilSimple size={11} aria-hidden />
                              </Badge>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-56 p-1.5">
                            {(
                              [
                                ["comprometida", "Comprometida"],
                                ["concluida", "Paga"],
                                ["cancelada", "Não comprou"],
                              ] as const
                            ).map(([novo, rotulo]) => (
                              <button
                                key={novo}
                                type="button"
                                disabled={mudarVenda.isPending || venda.status === novo}
                                onClick={() =>
                                  novo === "concluida"
                                    ? pedirPagamentoDaOportunidade(a.lead_id!)
                                    : mudarVenda.mutate(novo)
                                }
                                className="flex min-h-9 w-full items-center rounded-md px-2 text-left text-sm hover:bg-secondary disabled:opacity-50"
                              >
                                {t(rotulo)}
                              </button>
                            ))}
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Badge
                          variant={VARIANTE_DA_VENDA[venda.status] ?? "neutral"}
                          className="rounded-lg"
                        >
                          {t(STATUS_DA_VENDA[venda.status] ?? venda.status)}
                        </Badge>
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
                                <Badge
                                  variant={p.status === "recebida" ? "success" : "warning"}
                                  className="rounded-lg"
                                >
                                  {p.status === "recebida" ? t("Pago") : t("Comprometido")}
                                </Badge>
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
                            onClick={() => setEditandoVenda(true)}
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

        {editandoVenda && venda ? (
          <DialogoDaVenda
            key={venda.id}
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
