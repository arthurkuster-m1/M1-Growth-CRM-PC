"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { BlocoRecolhivel } from "@/components/agenda/BlocoRecolhivel";
import { PaginaDoCompromisso, statusDoCompromisso } from "@/components/agenda/PaginaDoCompromisso";
import { useAcoesDoCompromisso } from "@/components/agenda/AcoesDoCompromisso";
import { MenuDeOpcoes, Tag } from "@/components/agenda/CamposDoCompromisso";
import { TarefasMotorClient } from "@/app/app/tarefas/_components/TarefasMotorClient";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { SeletorDeTagsEmMassa } from "@/components/clientes/SeletorDeTagsEmMassa";
import { ChipDeEtiqueta } from "@/components/tags/ChipDeEtiqueta";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpdateContact } from "@/hooks/contacts/useUpdateContact";
import { normalizarTags } from "@/lib/contacts/tag-normalizada";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { LeadTimeline } from "@/components/kanban/LeadTimeline";
import { useLeadTimeline } from "@/hooks/leads/useLeadTimeline";
import { useContact } from "@/hooks/contacts/useContact";
import { useT } from "@/hooks/i18n/useT";
import { abrirNovoCompromisso } from "@/lib/agenda/abrir-novo";
import { apiClient } from "@/lib/api/client";
import { ArrowSquareOut, CaretDown, ChatCircle, Phone, Plus, X } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const rotuloDaChave = (k: string) =>
  k.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/**
 * O CLIENTE da oportunidade: um campo que abre (toggle) e mostra celular, e-mail e os campos
 * personalizados (só o nome do campo e o valor). Os três atalhos de ícone — conversa no Inbox,
 * ligar e abrir a página do cliente — ficam no fim do mesmo campo, como na página do compromisso.
 */
export function ClienteDaOportunidade({ contactId, nome }: { contactId: string; nome: string }) {
  const t = useT();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const { data } = useContact(contactId);
  const contato = data?.data;
  const telefone = contato?.phone_number?.trim() || null;
  const email = contato?.email?.trim() || null;
  const extras = Object.entries(contato?.custom_fields ?? {}).filter(
    ([k, v]) => v !== null && v !== "" && typeof v !== "object" && !/^link_|^links?$/i.test(k),
  );

  async function abrirNoInbox() {
    if (!telefone) return;
    try {
      const res = await fetch("/api/v1/conversations/open-with-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId, phone_number: telefone }),
      });
      const json = (await res.json()) as { data?: { conversation_id: string } };
      if (!res.ok || !json.data?.conversation_id) throw new Error("falha");
      router.push(`/app/inbox?id=${json.data.conversation_id}`);
    } catch {
      toast.error(t("Não foi possível abrir a conversa."));
    }
  }

  const botaoDeIcone = "grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary";
  return (
    <div className="grid gap-1" data-testid="cliente-da-oportunidade">
      <span className="text-xs font-medium text-muted-foreground">{t("Cliente")}</span>
      <div className="rounded-xl border border-border bg-card">
        <div className="flex min-h-10 items-center gap-1 px-3">
          <button
            type="button"
            aria-expanded={aberto}
            onClick={() => setAberto((a) => !a)}
            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm"
          >
            <span className="truncate font-medium">{nome || "—"}</span>
            <CaretDown
              size={12}
              aria-hidden
              className={cn(
                "shrink-0 text-text-subtle transition-transform",
                !aberto && "-rotate-90",
              )}
            />
          </button>
          <span className="flex shrink-0 items-center gap-0.5">
            {telefone ? (
              <>
                <button
                  type="button"
                  aria-label={t("Abrir conversa no Inbox")}
                  title={t("Abrir conversa no Inbox")}
                  onClick={() => void abrirNoInbox()}
                  className={botaoDeIcone}
                >
                  <ChatCircle size={16} aria-hidden />
                </button>
                <a
                  href={`tel:${telefone}`}
                  aria-label={t("Ligar para o cliente")}
                  title={telefone}
                  className={botaoDeIcone}
                >
                  <Phone size={16} aria-hidden />
                </a>
              </>
            ) : null}
            <Link
              href={`/app/contacts/${contactId}`}
              aria-label={t("Abrir a página do cliente")}
              title={t("Abrir a página do cliente")}
              className={botaoDeIcone}
            >
              <ArrowSquareOut size={15} aria-hidden />
            </Link>
          </span>
        </div>
        {aberto ? (
          <dl className="grid gap-x-4 gap-y-2 border-t border-border px-3 py-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{t("Celular")}</dt>
              <dd className="break-words">{telefone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t("E-mail")}</dt>
              <dd className="break-words">{email ?? "—"}</dd>
            </div>
            {extras.map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{rotuloDaChave(k)}</dt>
                <dd className="break-words">{String(v)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </div>
  );
}

/** A probabilidade de fechar: vem da etapa do funil (ganho = 100%, perdido = 0%), mais o selo MQL. */
export function ScoreDaOportunidade({
  pipelineId,
  etapaId,
  ganho,
  perdido,
}: {
  pipelineId: string | null | undefined;
  etapaId: string | null | undefined;
  ganho: boolean;
  perdido: boolean;
}) {
  const t = useT();
  const etapas = useQuery({
    queryKey: ["pipelines", pipelineId, "stages"],
    enabled: Boolean(pipelineId),
    staleTime: 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: Array<{ id: string; win_probability: number | null; qualification: string | null }>;
        }>(`/api/v1/pipelines/${pipelineId}/stages`)
      ).data,
  });
  const etapa = (etapas.data ?? []).find((e) => e.id === etapaId);
  const probabilidade = ganho ? 100 : perdido ? 0 : (etapa?.win_probability ?? null);
  const mql = etapa?.qualification === "mql";
  if (!etapa && !ganho && !perdido) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
      data-testid="score-da-oportunidade"
    >
      <span className="text-xs font-medium text-muted-foreground">{t("Score")}</span>
      {mql ? <Tag cor="roxo">MQL</Tag> : null}
      {probabilidade === null ? (
        <span className="text-muted-foreground">{t("Sem probabilidade definida nesta etapa")}</span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary" aria-hidden>
            <span className="block h-full bg-primary" style={{ width: `${probabilidade}%` }} />
          </span>
          <strong className="tabular-nums">{probabilidade}%</strong>
          <span className="text-muted-foreground">{t("de chance de fechar")}</span>
        </span>
      )}
    </div>
  );
}

interface Compromisso {
  id: string;
  titulo: string;
  iniciaEm: string;
  situacao: "pending" | "confirmed" | "completed" | "no_show" | "cancelled";
  contatoNome: string | null;
}

/**
 * Os COMPROMISSOS da oportunidade, no mesmo formato do Início (hora em destaque, título, quem será
 * atendido), clicáveis, com o status editável em tag no canto direito.
 */
export function CompromissosDaOportunidade({
  contactId,
  leadId,
  vendeu,
  podeEditar = true,
}: {
  contactId: string | null;
  leadId: string;
  vendeu: boolean;
  podeEditar?: boolean;
}) {
  const t = useT();
  const qc = useQueryClient();
  const acoes = useAcoesDoCompromisso();
  const [aberto, setAberto] = useState<string | null>(null);
  // O "agora" é lido uma vez por abertura do painel: render puro.
  const [agora] = useState(() => Date.now());
  const confirmarDeNovo = useMutation({
    mutationFn: async (id: string) => {
      const atual = await apiClient.get<{ data: { revision: number } }>(
        `/api/v1/agenda/agendamentos/${id}`,
      );
      await apiClient.patch("/api/v1/agenda/agendamentos", {
        id,
        revision: atual.data.revision,
        status: "confirmed",
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["agenda"] }),
    onError: showApiError,
  });
  const consulta = useQuery({
    queryKey: ["agenda", "compromissos-do-lead", leadId, contactId],
    staleTime: 10_000,
    queryFn: async () => {
      const r = await apiClient.get<{ data: Compromisso[] }>(
        `/api/v1/agenda/agendamentos?${new URLSearchParams({ lead_id: leadId })}`,
      );
      return r.data ?? [];
    },
  });
  const lista = [...(consulta.data ?? [])].sort((a, b) => a.iniciaEm.localeCompare(b.iniciaEm));
  const quando = (iso: string) => {
    const d = new Date(iso);
    return {
      dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  return (
    <div className="grid gap-2" data-testid="compromissos-da-oportunidade">
      {lista.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("Nenhum compromisso agendado.")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((c) => {
            const status = statusDoCompromisso(
              { status: c.situacao, remarcado_para: null },
              vendeu,
            );
            const { dia, hora } = quando(c.iniciaEm);
            const comecou = Date.parse(c.iniciaEm) <= agora;
            return (
              <li
                key={c.id}
                className="relative flex items-center gap-3 rounded-xl border bg-card px-3 py-2 transition-colors hover:bg-secondary/60"
              >
                <button
                  type="button"
                  aria-label={`${t("Abrir compromisso")}: ${c.titulo}`}
                  onClick={() => setAberto(c.id)}
                  className="absolute inset-0 rounded-xl"
                />
                <span className="pointer-events-none w-11 shrink-0 text-xs font-semibold text-primary">
                  {hora}
                </span>
                <div className="pointer-events-none min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.titulo}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {dia} · {c.contatoNome || t("Agendamento")}
                  </p>
                </div>
                <span className="relative z-10 shrink-0">
                  {podeEditar && c.situacao !== "cancelled" ? (
                    <MenuDeOpcoes
                      alinhar="end"
                      gatilho={
                        <Tag cor={status.cor} editavel>
                          {t(status.rotulo)}
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
                        desabilitado: soDepois && !comecou,
                        dica:
                          soDepois && !comecou
                            ? t("Disponível quando a reunião começar")
                            : undefined,
                        aoEscolher: () =>
                          opcao === "confirmed"
                            ? c.situacao === "pending"
                              ? acoes.confirmar.mutate(c.id)
                              : confirmarDeNovo.mutate(c.id)
                            : acoes.resultado.mutate({ id: c.id, opcao, leadId }),
                      }))}
                    />
                  ) : (
                    <Tag cor={status.cor}>{t(status.rotulo)}</Tag>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div>
        <button
          type="button"
          data-testid="novo-compromisso-do-lead"
          // O compromisso já nasce com o cliente e a oportunidade escolhidos.
          onClick={() => abrirNovoCompromisso({ contactId, leadId })}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium hover:bg-secondary"
        >
          <Plus size={14} aria-hidden />
          {t("Novo compromisso")}
        </button>
      </div>
      {aberto ? (
        <PaginaDoCompromisso id={aberto} podeEditar={podeEditar} onClose={() => setAberto(null)} />
      ) : null}
    </div>
  );
}

interface TarefaDaOportunidade {
  id: string;
  title: string;
  due_date: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "in_progress" | "done" | "cancelled";
}

const COR_DA_PRIORIDADE: Record<TarefaDaOportunidade["priority"], string> = {
  low: "bg-muted-foreground/40",
  medium: "bg-info",
  high: "bg-warning",
  urgent: "bg-error",
};

/**
 * As TAREFAS da oportunidade, no formato da lista do Início (círculo para concluir, título,
 * prazo). Clicar abre a tarefa; a nova tarefa já nasce com o cliente e a oportunidade.
 */
export function TarefasDaOportunidade({
  contactId,
  leadId,
  podeEditar = true,
}: {
  contactId: string | null;
  /** Sem oportunidade: as tarefas do cliente todo (e a nova nasce só com o cliente). */
  leadId?: string;
  podeEditar?: boolean;
}) {
  const t = useT();
  const { user, activeOrg } = useAuth();
  const qc = useQueryClient();
  const [agora] = useState(() => Date.now());
  const [tarefaAbertaId, setTarefaAbertaId] = useState<string | null>(null);
  const [agoraIso] = useState(() => new Date().toISOString());
  const [criando, setCriando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [dia, setDia] = useState("");
  const consulta = useQuery({
    queryKey: ["crm_tasks", "da-oportunidade", leadId ?? `contato:${contactId}`],
    staleTime: 10_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { tasks: TarefaDaOportunidade[] } }>(
          leadId ? `/api/v1/tasks?lead_id=${leadId}` : `/api/v1/tasks?contact_id=${contactId}`,
        )
      ).data.tasks,
  });
  const abertas = (consulta.data ?? []).filter(
    (x) => x.status === "pending" || x.status === "in_progress",
  );
  const recarregar = () => void qc.invalidateQueries({ queryKey: ["crm_tasks"] });
  const concluir = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/api/v1/tasks/${id}`, { status: "done" }),
    onSuccess: recarregar,
    onError: showApiError,
  });
  const criar = useMutation({
    mutationFn: () =>
      apiClient.post("/api/v1/tasks", {
        title: titulo.trim(),
        due_date: dia ? new Date(`${dia}T09:00:00`).toISOString() : null,
        lead_id: leadId ?? null,
        contact_id: contactId,
        priority: "medium",
      }),
    onSuccess: () => {
      setTitulo("");
      setDia("");
      setCriando(false);
      recarregar();
    },
    onError: showApiError,
  });
  const prazo = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      : t("Sem prazo");

  return (
    <div className="grid gap-2" data-testid="tarefas-da-oportunidade">
      {abertas.length === 0 ? (
        // Com o botão "Nova tarefa" visível, o texto divide a linha com ele (como em Compromissos).
        podeEditar && !criando ? null : (
          <p className="text-sm text-muted-foreground">{t("Nenhuma tarefa pendente.")}</p>
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {abertas.map((x) => {
            const atrasada = Boolean(x.due_date) && Date.parse(x.due_date!) < agora;
            return (
              <li
                key={x.id}
                className="relative flex items-start gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors hover:bg-secondary/60"
              >
                <button
                  type="button"
                  aria-label={`${t("Abrir tarefa")}: ${x.title}`}
                  onClick={() => setTarefaAbertaId(x.id)}
                  className="absolute inset-0 rounded-xl"
                />
                <button
                  type="button"
                  aria-label={t("Concluir tarefa")}
                  disabled={!podeEditar || concluir.isPending}
                  onClick={() => concluir.mutate(x.id)}
                  className="relative z-10 mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 border-border-strong transition-colors hover:border-primary hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                />
                <div className="pointer-events-none min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{x.title}</p>
                  <p
                    className={cn(
                      "text-xs",
                      atrasada ? "font-medium text-error-fg" : "text-muted-foreground",
                    )}
                  >
                    {atrasada ? `${t("Atrasada")} · ` : ""}
                    {prazo(x.due_date)}
                  </p>
                </div>
                <span
                  aria-hidden
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    COR_DA_PRIORIDADE[x.priority],
                  )}
                />
              </li>
            );
          })}
        </ul>
      )}
      {podeEditar ? (
        criando ? (
          <div className="grid gap-2 rounded-xl border border-border p-3">
            <input
              value={titulo}
              maxLength={200}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={t("O que precisa ser feito?")}
              aria-label={t("Título da tarefa")}
              className="h-10 w-full rounded-xl border bg-card px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="date"
              value={dia}
              onChange={(e) => setDia(e.target.value)}
              aria-label={t("Prazo da tarefa")}
              className="h-10 w-full rounded-xl border bg-card px-3 text-sm sm:w-48"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCriando(false)}
                className="h-9 rounded-xl border px-3 text-sm hover:bg-secondary"
              >
                {t("Cancelar")}
              </button>
              <button
                type="button"
                disabled={!titulo.trim() || criar.isPending}
                onClick={() => criar.mutate()}
                className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {t("Criar tarefa")}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              abertas.length === 0 && "flex flex-wrap items-center justify-between gap-2",
            )}
          >
            {abertas.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("Nenhuma tarefa pendente.")}</p>
            ) : null}
            <button
              type="button"
              onClick={() => setCriando(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium hover:bg-secondary"
            >
              <Plus size={14} aria-hidden />
              {t("Nova tarefa")}
            </button>
          </div>
        )
      ) : null}
      {tarefaAbertaId ? (
        // Abre POR CIMA, no lugar: o mesmo painel da tela de Tarefas e do Início.
        <TarefasMotorClient
          key={tarefaAbertaId}
          soPainel
          abrirInicial={tarefaAbertaId}
          aoFecharPainel={() => setTarefaAbertaId(null)}
          fuso={activeOrg?.timezone || "America/Sao_Paulo"}
          usuarioId={user.id}
          podeEditar={podeEditar}
          podeConfigurar={false}
          agoraIso={agoraIso}
        />
      ) : null}
    </div>
  );
}

/**
 * As TAGS são do cliente (o lead), nunca da oportunidade: as mesmas etiquetas coloridas da ficha
 * do lead e o mesmo "Adicionar tag" (buscar as que existem, ou criar com a categoria escolhida).
 * Fechado, o bloco mostra só o título.
 */
export function TagsDoCliente({ contactId }: { contactId: string }) {
  const t = useT();
  const { activeOrg } = useAuth();
  const { data } = useContact(contactId);
  const atualizar = useUpdateContact(contactId);
  const [adicionando, setAdicionando] = useState(false);
  const [novas, setNovas] = useState<string[]>([]);
  const existentes = useQuery({
    queryKey: ["tags-existentes"],
    staleTime: 60_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { tags: string[] } }>("/api/v1/tags/existentes")).data.tags,
  });
  const tags = data?.data?.tags ?? [];
  if (!activeOrg) return null;
  const gravar = (lista: string[]) => atualizar.mutateAsync({ tags: lista }).catch(() => null);
  return (
    <BlocoRecolhivel titulo={t("Tags")}>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Sem tags.")}</p>
        ) : (
          tags.map((tag) => (
            <ChipDeEtiqueta key={tag} tag={tag} contorno>
              <button
                type="button"
                aria-label={`${t("Tirar")} ${tag}`}
                onClick={() => void gravar(tags.filter((x) => x !== tag))}
                className="ml-1.5 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X size={11} weight="bold" aria-hidden />
              </button>
            </ChipDeEtiqueta>
          ))
        )}
      </div>
      <Popover open={adicionando} onOpenChange={setAdicionando}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="mt-3">
            <Plus size={14} weight="bold" aria-hidden className="mr-1" />
            {t("Adicionar tag")}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(92vw,420px)] p-3">
          <SeletorDeTagsEmMassa
            existentes={existentes.data ?? []}
            escolhidas={novas}
            aoMudar={setNovas}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setNovas([]);
                setAdicionando(false);
              }}
            >
              {t("Cancelar")}
            </Button>
            <Button
              size="sm"
              disabled={novas.length === 0}
              onClick={() => {
                void gravar(normalizarTags([...tags, ...novas]));
                setNovas([]);
                setAdicionando(false);
              }}
            >
              {t("Aplicar")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </BlocoRecolhivel>
  );
}

/**
 * A ATIVIDADE da oportunidade: tudo o que aconteceu nela — mudança de etapa, reunião marcada ou
 * cancelada, conversa com o cliente e cada ação registrada. É o mesmo registro do histórico do lead,
 * filtrado só por esta oportunidade. Em toggle, e só carrega quando abre.
 */
export function AtividadeDaOportunidade({
  leadId,
  contactId,
}: {
  leadId: string;
  contactId: string | null;
}) {
  const t = useT();
  return (
    <BlocoRecolhivel titulo={t("Atividade")}>
      <AtividadeAberta leadId={leadId} contactId={contactId} />
    </BlocoRecolhivel>
  );
}

function AtividadeAberta({ leadId, contactId }: { leadId: string; contactId: string | null }) {
  const tl = useLeadTimeline(leadId, contactId);
  return (
    <LeadTimeline
      itens={tl.itens}
      chegouAoVivo={tl.chegouAoVivo}
      isLoading={tl.isLoading}
      isError={tl.isError}
    />
  );
}
