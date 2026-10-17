"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import * as React from "react";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { SeletorEmPopup } from "@/components/ui/SeletorEmPopup";
import { toast } from "sonner";
import { DialogoDaVenda, type DadosDaVenda } from "@/components/vendas/DialogoDaVenda";
import { useTagDeIdioma } from "@/hooks/i18n/useLocaleDeData";
import { useT } from "@/hooks/i18n/useT";
import { ROTULO_DO_MODELO, modeloDoAtendimento } from "@/lib/agenda/atendimentos";
import { padraoDoModelo } from "@/lib/agenda/modelos-de-atendimento";
import { apiClient } from "@/lib/api/client";
import { rotuloDoLocal } from "@/lib/agenda/locais";
import { formatCents as formatMoney } from "@/lib/money";
import { ArrowSquareOut, Copy, EnvelopeSimple, Phone, Sparkle, VideoCamera } from "@/lib/ui/icons";
import type { Venda } from "@/lib/vendas";
import { cn } from "@/lib/utils";

import { BotaoConfirmado, BotaoExcluir, BotaoResultado } from "./AcoesDoCompromisso";
import { useAuth } from "@/hooks/auth/AuthProvider";
import type { PedidoDeNovoCompromisso } from "@/lib/agenda/abrir-novo";
import { CampoDeDataEHora } from "./CampoDeDataEHora";
import { useModelosDeAtendimento } from "./modelos-hooks";
import { atendentesDoTipoNaMatriz, useAtendentesLivres, useMatrizDeAtendentes } from "./equipe-hooks";
import { FormularioDeNovoCompromisso, useContextoDeMarcacao, usePessoasDaEquipe } from "./FormularioDeNovoCompromisso";
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
  tipo: { id: string; nome: string; slug: string } | null;
  responsavel_id: string | null;
  eh_responsavel: boolean;
  meeting?: MeetingDetail | null;
  google_sync?: SyncDetail;
  client_confirmation?: "confirmed" | "reschedule" | "cancel" | null;
};

const SITUACAO: Record<Detalhe["status"], { rotulo: string; variante: "default" | "warning" | "success" | "error" | "neutral" }> = {
  pending: { rotulo: "Aguardando confirmação", variante: "warning" },
  confirmed: { rotulo: "Agendado", variante: "default" },
  completed: { rotulo: "Compareceu", variante: "success" },
  no_show: { rotulo: "Não compareceu", variante: "error" },
  cancelled: { rotulo: "Cancelado", variante: "neutral" },
};

const STATUS_DA_VENDA: Record<string, string> = {
  interesse: "Possível venda",
  comprometida: "Comprometido",
  concluida: "Pago",
  recorrencia_ativa: "Recorrência ativa",
  recorrencia_encerrada: "Recorrência encerrada",
  cancelada: "Cancelado",
};

function Bloco({ titulo, acao, children, className }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-border bg-surface p-4", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs text-text-muted">{rotulo}</div>
      <div className="min-h-9 rounded-xl border border-border bg-background px-3 py-2 text-sm">{children}</div>
    </div>
  );
}

/**
 * A página única do compromisso: abre no centro da tela, de qualquer lugar da Agenda. Tem tudo que o
 * atendente precisa para atender dentro do app. O miolo do atendimento muda com o TIPO do compromisso.
 */
function PaginaExistente({
  id,
  onClose,
  podeEditar = true,
}: {
  id: string | null;
  onClose: () => void;
  podeEditar?: boolean;
}) {
  const t = useT();
  const tag = useTagDeIdioma();
  const qc = useQueryClient();
  const [editandoVenda, setEditandoVenda] = React.useState(false);
  const [anotacao, setAnotacao] = React.useState<string | null>(null);
  const [feitos, setFeitos] = React.useState<Record<number, boolean>>({});

  const consulta = useQuery({
    queryKey: ["agenda", "detalhe", id],
    enabled: !!id,
    refetchInterval: 8000,
    queryFn: async () => (await apiClient.get<{ data: Detalhe }>(`/api/v1/agenda/agendamentos/${id}`)).data,
  });
  const a = consulta.data;

  const pessoas = usePessoasDaEquipe();
  const nomeDoResponsavel = pessoas.data?.find((p) => p.user_id === a?.responsavel_id)?.full_name ?? null;
  const contexto = useContextoDeMarcacao(a?.contact_id ?? "", "");
  const matriz = useMatrizDeAtendentes();
  const modelosDosTipos = useModelosDeAtendimento();
  const livresNoHorario = useAtendentesLivres(a?.tipo?.id ?? null, a?.starts_at ?? null, a?.id);

  const oportunidade = useQuery({
    queryKey: ["venda-da-oportunidade", a?.lead_id],
    enabled: !!a?.lead_id,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?lead=${a!.lead_id}`)).data.vendas[0] ?? null,
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
      apiClient.patch("/api/v1/agenda/agendamentos", { id, revision: a?.revision, starts_at: iso }),
    onSuccess: () => {
      toast.success(t("Compromisso reagendado."));
      recarregar();
    },
    onError: showApiError,
  });
  const trocarResponsavel = useMutation({
    mutationFn: async (userId: string) =>
      apiClient.patch<{ data: { google?: string } }>(`/api/v1/agenda/agendamentos/${id}/responsavel`, { user_id: userId }),
    onSuccess: (r) => {
      const g = r.data?.google;
      toast.success(
        g === "movido"
          ? t("Responsável trocado. O evento saiu da agenda do Google de quem tinha e foi para a do novo.")
          : g === "so_no_app"
            ? t("Responsável trocado. Ele não conectou o Google: o compromisso fica só na agenda do app.")
            : g === "remocao_pendente"
              ? t("Responsável trocado. Não consegui remover o evento da agenda do Google anterior: apague lá à mão.")
              : t("Responsável do compromisso trocado."),
      );
      recarregar();
    },
    onError: showApiError,
  });
  const trocarOportunidade = useMutation({
    mutationFn: async (leadId: string) =>
      apiClient.patch(`/api/v1/agenda/agendamentos/${id}/oportunidade`, { lead_id: leadId || null }),
    onSuccess: () => {
      toast.success(t("Oportunidade do compromisso atualizada."));
      recarregar();
    },
    onError: showApiError,
  });

  if (!id) return null;
  // A página de atendimento do TIPO (configurada na Agenda); sem configuração, o padrão do modelo.
  const cfg = (a?.tipo && modelosDosTipos.data?.[a.tipo.id]) || padraoDoModelo(modeloDoAtendimento(a?.tipo ?? null));
  const modelo = cfg.modelo;
  const comecou = a ? Date.parse(a.starts_at) <= Date.now() : false;
  const encerrado = a ? ["cancelled", "completed", "no_show"].includes(a.status) : false;
  const quando = a
    ? new Intl.DateTimeFormat(tag, { timeZone: a.time_zone, dateStyle: "full", timeStyle: "short", hourCycle: "h23" }).formatRange(
        new Date(a.starts_at),
        new Date(a.ends_at),
      )
    : "";
  const link = a?.meeting?.url ?? null;
  const parcelas = (venda?.parcelas ?? []).filter((p) => p.status !== "cancelada");
  const pago = parcelas.filter((p) => p.status === "recebida").reduce((s, p) => s + p.amount_cents, 0);
  const total = parcelas.reduce((s, p) => s + p.amount_cents, 0);
  const saiuVenda = pago > 0;
  const textoDaAnotacao = anotacao ?? a?.notes ?? "";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        data-testid="pagina-do-compromisso"
        className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-4xl grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto overflow-x-hidden rounded-3xl bg-background p-0 sm:rounded-3xl"
      >
        <DialogTitle className="sr-only">{a?.cliente?.nome ?? a?.title ?? t("Compromisso")}</DialogTitle>
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
            <header className="flex min-w-0 flex-col items-center gap-3 border-b border-border px-4 pb-4 pt-12 text-center sm:items-start sm:px-6 sm:pr-14 sm:pt-6 sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <Badge variant="neutral" className="h-auto max-w-full whitespace-normal rounded-lg">
                  {a.tipo?.nome ?? t("Atendimento")} · {t(ROTULO_DO_MODELO[modelo])}
                </Badge>
                <Badge variant={SITUACAO[a.status].variante} className="rounded-lg">
                  {t(SITUACAO[a.status].rotulo)}
                </Badge>
                {a.client_confirmation === "confirmed" && (
                  <Badge variant="success" className="rounded-lg">{t("Cliente confirmou")}</Badge>
                )}
                {saiuVenda && <Badge variant="success" className="rounded-lg">{t("Saiu venda nesta reunião")}</Badge>}
              </div>
              <div className="min-w-0 max-w-full">
                <h2 className="break-words text-xl font-semibold">{a.cliente?.nome ?? a.title}</h2>
                <p className="mt-0.5 text-sm text-text-muted first-letter:uppercase">{quando}</p>
              </div>
              {podeEditar && (
                <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {link && (
                    <Button asChild size="sm" className="gap-1.5 rounded-xl">
                      <a href={link} target="_blank" rel="noreferrer">
                        <VideoCamera size={16} weight="bold" aria-hidden />
                        {t("Entrar na reunião")}
                      </a>
                    </Button>
                  )}
                  {!encerrado && <BotaoConfirmado id={a.id} jaConfirmou={a.client_confirmation === "confirmed"} />}
                  {a.status !== "cancelled" && <BotaoResultado id={a.id} leadId={a.lead_id} jaComecou={comecou} />}
                  <BotaoExcluir id={a.id} aoExcluir={onClose} className="sm:ml-auto" />
                </div>
              )}
            </header>

            <div className="grid min-w-0 gap-4 p-3 sm:p-6 md:grid-cols-2">
              <Bloco titulo={t("Compromisso")}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo={t("Cliente")}>
                    {a.contact_id ? (
                      <Link href={`/app/contacts/${a.contact_id}`} className="inline-flex items-center gap-1 underline">
                        {a.cliente?.nome ?? t("Ver contato")}
                        <ArrowSquareOut size={12} aria-hidden />
                      </Link>
                    ) : (
                      <span className="text-text-muted">{t("Compromisso pessoal, sem cliente")}</span>
                    )}
                  </Campo>
                  <div className="min-w-0">
                    <div className="mb-1 text-xs text-text-muted">{t("Responsável pela reunião")}</div>
                    {podeEditar && !encerrado ? (
                      <SeletorEmPopup
                        rotulo={t("Responsável pela reunião")}
                        valor={a.responsavel_id ?? ""}
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
                        aoEscolher={(uid) => uid && uid !== a.responsavel_id && trocarResponsavel.mutate(uid)}
                      />
                    ) : (
                      <div className="min-h-9 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                        {nomeDoResponsavel ?? "—"}
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-text-muted">
                      {t("Só aparecem atendentes do tipo que estão livres neste horário. Trocar vale só para este compromisso: o CRM e a oportunidade não mudam, e o evento muda de agenda no Google.")}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 text-xs text-text-muted">{t("Data e horário")}</div>
                    <CampoDeDataEHora
                      valor={a.starts_at}
                      fuso={a.time_zone}
                      tag={tag}
                      rotulo={t("Reagendar o compromisso")}
                      desabilitado={!podeEditar || encerrado || reagendar.isPending}
                      aoEscolher={(iso) => reagendar.mutate(iso)}
                      horariosLivres={
                        a.tipo
                          ? { eventTypeId: a.tipo.id, ownerId: a.responsavel_id, ignorarId: a.id }
                          : undefined
                      }
                    />
                    {podeEditar && !encerrado && (
                      <p className="mt-1 text-[11px] text-text-muted">{t("Escolher outra data ou horário reagenda o compromisso.")}</p>
                    )}
                  </div>
                  <Campo rotulo={t("Telefone")}>
                    {a.cliente?.telefone ? (
                      <a href={`tel:${a.cliente.telefone}`} className="inline-flex items-center gap-1.5">
                        <Phone size={14} aria-hidden />
                        {a.cliente.telefone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </Campo>
                  <Campo rotulo={t("E-mail")}>
                    {a.cliente?.email ? (
                      <a href={`mailto:${a.cliente.email}`} className="inline-flex min-w-0 items-center gap-1.5">
                        <EnvelopeSimple size={14} aria-hidden />
                        <span className="truncate">{a.cliente.email}</span>
                      </a>
                    ) : (
                      "—"
                    )}
                  </Campo>
                  <div className="sm:col-span-2">
                    <Campo rotulo={t("Link da reunião")}>
                      {link ? (
                        <span className="flex items-center justify-between gap-2">
                          <a href={link} target="_blank" rel="noreferrer" className="truncate underline">
                            {link}
                          </a>
                          <button
                            type="button"
                            aria-label={t("Copiar link")}
                            className="shrink-0 rounded-lg p-1 hover:bg-accent-soft"
                            onClick={() => void navigator.clipboard?.writeText(link)}
                          >
                            <Copy size={14} aria-hidden />
                          </button>
                        </span>
                      ) : (
                        <span className="text-text-muted">{rotuloDoLocal(a.location_kind, a.location_details) ?? t("Sem link")}</span>
                      )}
                    </Campo>
                  </div>
                </div>
                {podeEditar && a.status !== "cancelled" && (
                  <div className="mt-4">
                    <div className="mb-1.5 text-xs text-text-muted">{t("Status do compromisso")}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          ["confirmed", "Agendado"],
                          ["completed", "Compareceu"],
                          ["no_show", "Não compareceu"],
                        ] as const
                      ).map(([s, rotulo]) => (
                        <Button
                          key={s}
                          type="button"
                          size="sm"
                          variant={a.status === s ? "primary" : "outline"}
                          className="rounded-xl"
                          disabled={salvar.isPending || a.status === s || (s !== "confirmed" && !comecou)}
                          title={s !== "confirmed" && !comecou ? t("Disponível quando a reunião começar") : undefined}
                          onClick={() => salvar.mutate({ status: s })}
                        >
                          {t(rotulo)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {(a.google_sync || a.meeting) && (
                  <details className="mt-4 rounded-xl border border-border px-3 py-2 text-sm">
                    <summary className="cursor-pointer text-text-muted">{t("Google Agenda e Meet")}</summary>
                    <div className="mt-2 space-y-3">
                      {a.google_sync && (
                        <SincronizacaoDoCompromisso key={a.id} id={a.id} sync={a.google_sync} onSaved={() => void consulta.refetch()} />
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
                )}
              </Bloco>

              {cfg.blocos.oportunidade ? (
              <Bloco
                titulo={t("Oportunidade")}
                acao={
                  venda && podeEditar ? (
                    <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={() => setEditandoVenda(true)}>
                      {t("Editar venda e parcelas")}
                    </Button>
                  ) : undefined
                }
              >
                {podeEditar && !encerrado && a.contact_id ? (
                  <div className="mb-3">
                    <SeletorEmPopup
                      rotulo={t("Oportunidade do compromisso")}
                      valor={a.lead_id ?? ""}
                      rotuloVazio={t("Sem oportunidade (atendimento ao cliente)")}
                      desabilitado={trocarOportunidade.isPending}
                      opcoes={(contexto.data?.oportunidades ?? []).map((o) => ({
                        id: o.id,
                        rotulo: `${o.titulo}${o.funil ? ` · ${o.funil}` : ""}${o.etapa ? ` › ${o.etapa}` : ""}`,
                      }))}
                      aoEscolher={(lid) => lid !== (a.lead_id ?? "") && trocarOportunidade.mutate(lid)}
                    />
                  </div>
                ) : null}
                {!a.lead_id ? (
                  <p className="text-sm text-text-muted">{t("Este compromisso não está ligado a uma oportunidade.")}</p>
                ) : oportunidade.isPending ? (
                  <p className="text-sm text-text-muted">{t("Carregando…")}</p>
                ) : !venda ? (
                  <p className="text-sm text-text-muted">{t("Oportunidade indisponível.")}</p>
                ) : (
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{venda.name || venda.product_name || t("Oportunidade")}</div>
                        <div className="text-xs text-text-muted">
                          {venda.funil ?? "—"} · {venda.etapa ?? "—"}
                        </div>
                      </div>
                      <Badge variant={saiuVenda ? "success" : "neutral"} className="rounded-lg">
                        {t(STATUS_DA_VENDA[venda.status] ?? venda.status)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        [t("Valor"), formatMoney(venda.amount_cents, venda.currency)],
                        [t("Pago"), formatMoney(pago, venda.currency)],
                        [t("A receber"), formatMoney(Math.max(total - pago, 0), venda.currency)],
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
                          <li key={p.id ?? p.number} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                            <span className="tabular-nums">
                              {p.number}ª · {new Date(`${p.due_on}T12:00:00`).toLocaleDateString(tag)}
                            </span>
                            <span className="tabular-nums">{formatMoney(p.amount_cents, venda.currency)}</span>
                            <Badge variant={p.status === "recebida" ? "success" : "warning"} className="rounded-lg">
                              {p.status === "recebida" ? t("Pago") : t("Comprometido")}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-text-muted">
                      {saiuVenda
                        ? t("O pagamento registrado aqui conta como venda desta reunião nas análises.")
                        : t("Se sair venda, registre o pagamento: ela fica atrelada a este compromisso.")}
                    </p>
                  </div>
                )}
              </Bloco>
              ) : null}

              {(cfg.blocos.roteiro && cfg.roteiro.length > 0) || cfg.blocos.anotacoes || cfg.blocos.ia ? (
              <Bloco
                titulo={t(ROTULO_DO_MODELO[modelo])}
                className="md:col-span-2"
                acao={
                  podeEditar && a.status !== "cancelled" ? (
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-xl"
                      disabled={salvar.isPending || anotacao === null || anotacao === (a.notes ?? "")}
                      onClick={() => salvar.mutate({ notes: textoDaAnotacao.slice(0, 2000) }, { onSuccess: () => setAnotacao(null) })}
                    >
                      {t("Salvar anotações")}
                    </Button>
                  ) : undefined
                }
              >
                <div className={cn("grid gap-4", (cfg.blocos.roteiro || cfg.blocos.ia) && cfg.blocos.anotacoes && "lg:grid-cols-[1fr_1.2fr]")}>
                  {(cfg.blocos.roteiro || cfg.blocos.ia) && (
                    <div className="space-y-3">
                      {cfg.blocos.roteiro && cfg.roteiro.length > 0 ? (
                      <div>
                        <div className="mb-1.5 text-xs font-medium text-text-muted">{t("Roteiro de atendimento")}</div>
                        <ol className="space-y-1.5">
                          {cfg.roteiro.map((e, i) => (
                            <li key={`${i}-${e.titulo}`}>
                              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-background px-3 py-2">
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  checked={!!feitos[i]}
                                  onChange={(ev) => setFeitos((f) => ({ ...f, [i]: ev.target.checked }))}
                                />
                                <span className="text-sm">
                                  <span className={cn("font-medium", feitos[i] && "line-through opacity-60")}>{t(e.titulo)}</span>
                                  <span className="block text-xs text-text-muted">{t(e.dica)}</span>
                                </span>
                              </label>
                            </li>
                          ))}
                        </ol>
                      </div>
                      ) : null}
                      {cfg.blocos.ia ? (
                      <div className="flex items-start gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-text-muted">
                        <Sparkle size={16} weight="bold" className="mt-0.5 shrink-0" aria-hidden />
                        <span>{t("Recomendações da IA ao vivo, durante a reunião: em breve.")}</span>
                      </div>
                      ) : null}
                    </div>
                  )}
                  {cfg.blocos.anotacoes ? (
                  <div>
                    <div className="mb-1.5 text-xs font-medium text-text-muted">{t("Anotações do atendimento")}</div>
                    <textarea
                      data-testid="anotacoes-do-atendimento"
                      value={textoDaAnotacao}
                      readOnly={!podeEditar || a.status === "cancelled"}
                      maxLength={2000}
                      onChange={(e) => setAnotacao(e.target.value)}
                      placeholder={t("Escreva aqui o que foi falado, as objeções e o combinado.")}
                      className="min-h-48 w-full resize-y rounded-2xl border border-border bg-background px-3 py-2.5 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  ) : null}
                </div>
              </Bloco>
              ) : null}
            </div>
          </>
        )}

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
        className="max-h-[92dvh] w-[calc(100vw-1.5rem)] max-w-3xl grid-cols-[minmax(0,1fr)] gap-0 overflow-y-auto overflow-x-hidden rounded-3xl bg-background p-0 sm:rounded-3xl"
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
