"use client";
import { useState, type RefObject } from "react";
import { useT } from "@/hooks/i18n/useT";
import Link from "next/link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JanelaSelo } from "@/components/inbox/JanelaSelo";
import { ChannelLogo } from "@/components/inbox/ChannelLogo";
import { Phone, ArrowRight, DotsThree, MagnifyingGlass } from "@/lib/ui/icons";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useClaimConversation } from "@/hooks/inbox/useClaimConversation";
import { useReleaseConversation } from "@/hooks/inbox/useReleaseConversation";
import {
  useMarkPersonalContact,
  useUnmarkPersonalContact,
} from "@/hooks/contacts/usePersonalContact";
import { ROLE_RANK } from "@/lib/auth/types";
import {
  useArchiveConversation,
  useCloseConversation,
  useReopenConversation,
} from "@/hooks/inbox/useCloseConversation";
import { useResumeAiAttendance } from "@/hooks/inbox/useResumeAiAttendance";
import { usePauseAiAttendance } from "@/hooks/inbox/usePauseAiAttendance";
import { useAutomaticoAtivo } from "@/hooks/ai/useAutomaticoAtivo";
import { OwnerBadge } from "@/components/kanban/OwnerBadge";
import { comandoDaConversa, ROTULO_DO_MOTIVO } from "@/lib/inbox/comando-da-conversa";
import { ReassignDialog } from "@/components/inbox/ReassignDialog";
import { LembreteOutroDialog, SnoozeButton } from "@/components/inbox/SnoozeButton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DialButton } from "@/components/voice/DialButton";
import { VideoCallButton } from "@/components/inbox/VideoCallButton";
import { motivoDoContato } from "@/lib/inbox/motivo-do-envio-bloqueado";
import type { ConversationWithContact } from "@/hooks/inbox/useConversationsRealtime";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import { phoneForDisplay } from "@/lib/channels/phone-variants";

interface Props {
  conversation: ConversationWithContact;
  /**
   * A busca DENTRO da conversa (#1793): abre um campo que filtra só as
   * mensagens já carregadas. O ref devolve o foco a este botão quando o campo
   * fecha — senão o Esc largava o foco no `body`.
   */
  onBuscar?: () => void;
  buscaAberta?: boolean;
  botaoBuscaRef?: RefObject<HTMLButtonElement | null>;
  /** Seleciona outra conversa no Inbox — a aba Número do Transferir abre a do outro número. */
  onAbrirConversa?: (id: string) => void;
}

/**
 * O CHIP NOMEIA CICLO DE VIDA, NÃO COMANDO.
 *
 * Ele afirmava quem manda — "Automático atendendo", "Aguardando atendente" — a
 * 20px de um selo que responde a MESMA pergunta por outra fonte, e as duas se
 * contradiziam na tela: `conversations.status` não acompanha silêncio, trava de
 * contato nem atribuição, e o motor nunca o lê. Medido em 2026-08-30 num print
 * do dono: "Aguardando atendente" e "Automático" no mesmo cabeçalho.
 *
 * Quem responde "quem manda" é o `OwnerBadge`, que vem de `comandoDaConversa`.
 * Aqui fica só o que o status realmente sabe: o episódio está aberto ou acabou.
 *
 * Cobre os SETE valores do CHECK de propósito — o call site é
 * `t(STATUS_LABEL[status] ?? status)`, e um buraco imprime o token cru em inglês
 * no rosto do atendente. Vigiado pelo invariante de espelho.
 */
/** A linha de uma ação dentro do menu "Opções". */
const ITEM =
  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-secondary disabled:opacity-60";

const STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  pending: "Aberta",
  claimed: "Aberta",
  ai_handling: "Aberta",
  resolved: "Resolvida",
  closed: "Fechada",
  archived: "Arquivada",
};

export function ConversationHeader({
  conversation,
  onAbrirConversa,
  onBuscar,
  buscaAberta,
  botaoBuscaRef,
}: Props) {
  const t = useT();
  const { user, activeOrg } = useAuth();
  const claim = useClaimConversation();
  const release = useReleaseConversation();
  const close = useCloseConversation();
  const reopen = useReopenConversation();
  const arquivar = useArchiveConversation();
  const retomar = useResumeAiAttendance();
  const pausar = usePauseAiAttendance();
  // "Existe automático nesta org?" — sem isto o selo afirmava que o robô estava
  // atendendo em instalação que nunca configurou agente nenhum.
  const automaticoDaOrg = useAutomaticoAtivo();
  const [reassignOpen, setReassignOpen] = useState(false);
  const [confirmFecharOpen, setConfirmFecharOpen] = useState(false);
  const [confirmArquivarOpen, setConfirmArquivarOpen] = useState(false);
  const [confirmPessoalOpen, setConfirmPessoalOpen] = useState(false);
  const [opcoesAberto, setOpcoesAberto] = useState(false);
  const [lembreteOutroAberto, setLembreteOutroAberto] = useState(false);
  const fecharOpcoes = () => setOpcoesAberto(false);

  const c = conversation.contacts ?? null;
  const displayName = rotuloDoContato(c, t);
  const phone = c?.phone_number ? phoneForDisplay(c.phone_number) : null;
  const status = conversation.status;
  const isMineAssigned = conversation.assigned_to_user_id === user.id;
  const isOpen = status === "open" || conversation.assigned_to_user_id == null;

  // Marcar/desmarcar pessoal (spec 21, etapa 15 — botão no cabeçalho).
  //
  // GERENTE pode (spec decisão 1, D3): pessoal é decisão operacional — esconder
  // uma conversa da operação. Desbloquear exige ADMIN porque reabre um canal
  // que o cliente fechou (direito do titular, LGPD): dois gestos parecidos,
  // dois gates diferentes, cada um com seu motivo.
  //
  // Os hooks ficam AQUI, antes de qualquer early return (a ordem dos hooks não
  // pode mudar entre renderizações); com contato ausente o id vazio nunca
  // dispara porque o botão nem é desenhado.
  const ehPessoal = c?.is_personal === true;
  const podeMarcarPessoal =
    (user.is_platform_admin && !user.support) ||
    (activeOrg != null && ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager);
  const marcarPessoal = useMarkPersonalContact(c?.id ?? "");
  const desmarcarPessoal = useUnmarkPersonalContact(c?.id ?? "");

  /**
   * QUEM MANDA, uma pergunta com uma resposta.
   *
   * Este bloco era três leituras parciais. O selo e o botão de volta liam duas
   * travas (`bot_silenced_until || force_human`); a linha da lista lia uma, por
   * COR; o painel não lia nenhuma. Desde a 0173 há uma quarta situação —
   * "alguém assumiu" — e continuar somando condições à mão aqui é como as três
   * leituras divergiram em primeiro lugar. A regra mora em `lib/inbox`,
   * espelhando os gates que o MOTOR lê, e esta tela só a consome.
   */
  const { comando, automaticoAtivo, travaVigente, motivo } = comandoDaConversa({
    status,
    assigned_to_user_id: conversation.assigned_to_user_id,
    assigned_to_user_name: conversation.assigned_to_user_name ?? null,
    assignee_kind: conversation.assignee_kind ?? null,
    bot_silenced_until: conversation.bot_silenced_until ?? null,
    last_handoff_reason: conversation.last_handoff_reason ?? null,
    force_human: c?.force_human ?? null,
    is_blocked: conversation.contacts?.is_blocked ?? null,
    is_group: conversation.is_group ?? false,
    automaticoDaOrg: automaticoDaOrg.data,
  });

  const encerrada = status === "closed" || status === "archived" || status === "resolved";
  /**
   * A VOLTA aparece sempre que há algo a devolver — inclusive em conversa
   * ENCERRADA. Antes ela era condicionada a `status !== "closed"`, e o resultado
   * era um beco sem saída medido: atendente assume, fecha, sai de férias; a
   * conversa fica com o automático parado e, para qualquer colega, sem NENHUMA
   * porta — "Liberar" só existe para o próprio dono e a rota recusa quem não é.
   * `devolverAtendimentoAoAgente` funciona nesse estado (o status fechado está na
   * lista de reativáveis), então esconder o botão escondia uma ação que existe.
   *
   * A condição é `travaVigente`, e NÃO `!automaticoAtivo`: conversa encerrada tem
   * o automático inativo sem ter trava nenhuma, e sair do segundo faria o botão
   * aparecer em toda conversa fechada — clicá-lo REABRIRIA uma conversa que
   * ninguém pediu para reabrir. Oferecer uma ação que não deveria acontecer é
   * pior que não oferecer nenhuma.
   */
  const podeDevolver = travaVigente;
  /**
   * PAUSAR só aparece quando pausar é um gesto DIFERENTE de assumir.
   *
   * Desde a 0173 "Assumir" já cala o automático (a RPC grava o silêncio). Numa
   * conversa sem dono, portanto, "Assumir" e "Pausar o automático" teriam
   * exatamente o mesmo efeito — dois botões para um ato é a confusão que esta
   * entrega existe para acabar, não para dobrar.
   *
   * Sobra o caso em que ele é próprio: a conversa JÁ tem dono e o automático
   * continua de pé. Isso é real e não é raro — o rodízio (`reason='routing'`)
   * distribui sem calar, de propósito, senão uma org em round_robin ficaria sem
   * automático nenhum.
   */
  const podePausar = automaticoAtivo && !encerrada && conversation.assigned_to_user_id !== null;

  if (user.support?.access_mode === "support_readonly")
    return (
      <header className="flex items-center justify-between border-b p-4">
        <strong>{displayName}</strong>
        <span className="text-sm text-muted-foreground">
          {STATUS_LABEL[status] ?? status} · Somente leitura
        </span>
      </header>
    );
  return (
    // `flex-wrap` porque este header travava a LARGURA DA TELA INTEIRA. Ele
    // media 707px de `min-content` — a identidade do contato encolhia bem
    // (`min-w-0` + `truncate`), mas a barra de ações era `shrink-0` e não
    // quebrava. Como a coluna do meio do inbox é `1fr`, que é
    // `minmax(auto, 1fr)`, ela não podia ficar menor que esses 707px, e o
    // painel de CRM era empurrado 311px para fora da viewport em 1280px.
    //
    // Reorganizar em vez de esconder: acima de ~1440px o header fica IDÊNTICO ao
    // de antes (uma linha), e quando aperta a barra desce para a linha de baixo.
    // Nenhuma ação some — um menu "mais" esconderia o "Lembrar" que a spec
    // `canais-baseline` clica, e, pior, esconderia ação de quem atende.
    <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 sm:px-4 sm:py-3">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <ChannelLogo channel={conversation.channel_sessions} size={20} />
          <h2 className="min-w-0 truncate text-sm font-semibold" title={displayName}>
            {displayName}
          </h2>
          {/* Ao lado do nome, não escondido num painel: a pergunta "dá para escrever agora?" se
              faz ANTES de digitar, não depois de receber um `failed` com um código de cinco dígitos. */}
          <JanelaSelo
            provider={conversation.channel_sessions?.provider ?? null}
            lastInboundAt={conversation.last_inbound_at}
          />
        </div>
        {/* QUEM ESTÁ NO COMANDO, com nome e por GEOMETRIA — disco cheio para pessoa, anel vazado
            para o automático. É o mesmo componente do card do funil e do dossiê. */}
        <div
          className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground"
          data-testid="comando-da-conversa"
        >
          {comando.quem === "humano" ? (
            <OwnerBadge ownerKind="user" ownerName={comando.nome ?? t("Atendente")} />
          ) : comando.quem === "automatico" ? (
            <OwnerBadge ownerKind="ai" ownerName={t("Automático")} />
          ) : (
            <OwnerBadge ownerKind={null} ownerName={null} />
          )}
          {phone && (
            <span className="flex min-w-0 items-center gap-1 truncate">
              <Phone size={11} weight="regular" aria-hidden /> {phone}
            </span>
          )}
          <Badge variant="outline" className="h-4 shrink-0 px-1.5 text-[10px]">
            {t(STATUS_LABEL[status] ?? status)}
          </Badge>
          {/* O aviso pertence à operação automática. O testid é contrato:
              `escalacao-ciclo.spec.ts` o clica. */}
          {motivo !== null && (
            <Badge
              variant="outline"
              className="h-4 max-w-full truncate px-1.5 text-[10px]"
              title={t(ROTULO_DO_MOTIVO[motivo])}
              data-testid="badge-atendimento-humano"
            >
              {t(ROTULO_DO_MOTIVO[motivo])}
            </Badge>
          )}
        </div>
      </div>

      {/* O CABEÇALHO FICA LIMPO: o que a pessoa faz o tempo todo (Assumir) fica à vista; todo o
          resto mora no botão "Opções". */}
      <div className="flex shrink-0 items-center gap-1.5">
        {isOpen && (
          <Button
            size="sm"
            variant="default"
            disabled={claim.isPending}
            // O rótulo NÃO muda (é contrato: `inbox-header-nao-trava` e o dicionário de espanhol o
            // citam). Assumir também para o atendimento automático: o botão diz as duas coisas.
            title={t("Você passa a responder esta conversa e o atendimento automático para aqui.")}
            onClick={() =>
              claim.mutate({
                conversation_id: conversation.id,
                expected_assignee: conversation.assigned_to_user_id,
              })
            }
          >
            {t("Assumir")}
          </Button>
        )}
        <Popover open={opcoesAberto} onOpenChange={setOpcoesAberto}>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              aria-label={t("Opções")}
              data-testid="opcoes-da-conversa"
            >
              <DotsThree size={16} weight="bold" aria-hidden />
              <span className="max-sm:sr-only">{t("Opções")}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="max-h-[min(30rem,var(--radix-popover-content-available-height))] w-[min(92vw,19rem)] overflow-y-auto rounded-2xl p-1.5"
          >
            <div className="grid gap-0.5">
              {onBuscar && (
                <button
                  ref={botaoBuscaRef}
                  type="button"
                  className={ITEM}
                  onClick={() => {
                    fecharOpcoes();
                    onBuscar();
                  }}
                  aria-label={t("Buscar nesta conversa")}
                  title={t("Buscar nesta conversa")}
                  aria-expanded={buscaAberta}
                >
                  <MagnifyingGlass size={15} aria-hidden />
                  {t("Buscar nesta conversa")}
                </button>
              )}
              {/* A chamada usa o telefone da ficha. Grupos não representam uma pessoa para ligar. */}
              {!conversation.is_group && c?.id && (
                <DialButton contactId={c.id} hasPhone={!!c.phone_number} />
              )}
              {/* Videochamada (#2440): sem JITSI_SERVER_URL este botão não renderiza. */}
              <VideoCallButton
                conversationId={conversation.id}
                provider={conversation.channel_sessions?.provider ?? null}
                lastInboundAt={conversation.last_inbound_at}
                bloqueio={motivoDoContato(c, t)}
                encerrada={status === "closed"}
              />
              {isMineAssigned && (
                <button
                  type="button"
                  className={ITEM}
                  disabled={release.isPending}
                  onClick={() => {
                    fecharOpcoes();
                    release.mutate({ conversation_id: conversation.id });
                  }}
                >
                  {t("Liberar")}
                </button>
              )}
              {/* O INTERRUPTOR: um botão, dois rótulos, um slot. O `data-testid` do lado de VOLTA é
                  o mesmo de antes (`escalacao-ciclo` o clica). */}
              {podeDevolver && (
                <button
                  type="button"
                  className={ITEM}
                  disabled={retomar.isPending}
                  data-testid="devolver-ao-automatico"
                  // O ALCANCE DA VOLTA NÃO É SEMPRE O MESMO, e a tela precisa dizer qual é.
                  title={
                    motivo === "contato_travado"
                      ? t(
                          "Religa o atendimento automático para este cliente — vale para todas as conversas dele.",
                        )
                      : t("Devolve esta conversa ao atendimento automático.")
                  }
                  onClick={() => {
                    fecharOpcoes();
                    retomar.mutate({ conversation_id: conversation.id });
                  }}
                >
                  {retomar.isPending ? t("Devolvendo...") : t("Devolver ao automático")}
                </button>
              )}
              {podePausar && (
                <button
                  type="button"
                  className={ITEM}
                  disabled={pausar.isPending}
                  data-testid="pausar-o-automatico"
                  title={t("O atendimento automático para nesta conversa. O dono não muda.")}
                  onClick={() => {
                    fecharOpcoes();
                    pausar.mutate({ conversation_id: conversation.id });
                  }}
                >
                  {pausar.isPending ? t("Pausando...") : t("Pausar o automático")}
                </button>
              )}
              {!encerrada && (
                <button
                  type="button"
                  className={ITEM}
                  onClick={() => {
                    fecharOpcoes();
                    setReassignOpen(true);
                  }}
                >
                  {t("Transferir")}
                </button>
              )}
              {!encerrada && (
                <div className="mt-1 border-t pt-1">
                  <SnoozeButton
                    variante="lista"
                    conversationId={conversation.id}
                    snoozeUntil={conversation.snooze_until ?? null}
                    aoEscolher={fecharOpcoes}
                    aoEscolherOutro={() => setLembreteOutroAberto(true)}
                  />
                </div>
              )}
              <div className="mt-1 grid gap-0.5 border-t pt-1">
                {!encerrada && (
                  <button
                    type="button"
                    className={ITEM}
                    disabled={close.isPending}
                    onClick={() => {
                      fecharOpcoes();
                      setConfirmFecharOpen(true);
                    }}
                  >
                    {t("Fechar")}
                  </button>
                )}
                {encerrada && (
                  <button
                    type="button"
                    className={ITEM}
                    disabled={reopen.isPending}
                    onClick={() => {
                      fecharOpcoes();
                      reopen.mutate({
                        conversation_id: conversation.id,
                        expected_revision: conversation.service_revision,
                      });
                    }}
                  >
                    {t("Reabrir")}
                  </button>
                )}
                {/* ARQUIVAR (#923): tira da frente sem destruir. */}
                {status !== "archived" && (
                  <button
                    type="button"
                    className={ITEM}
                    disabled={arquivar.isPending}
                    onClick={() => {
                      fecharOpcoes();
                      setConfirmArquivarOpen(true);
                    }}
                  >
                    {arquivar.isPending ? t("Arquivando...") : t("Arquivar")}
                  </button>
                )}
                {/* PESSOAL (spec 21, etapa 15): o `data-testid` é contrato do e2e da spec. */}
                {podeMarcarPessoal && c?.id && !ehPessoal && (
                  <button
                    type="button"
                    className={ITEM}
                    disabled={marcarPessoal.isPending}
                    data-testid="marcar-pessoal"
                    title={t("Tira este contato da operação: a conversa sai do inbox.")}
                    onClick={() => {
                      fecharOpcoes();
                      setConfirmPessoalOpen(true);
                    }}
                  >
                    {t("Marcar como pessoal")}
                  </button>
                )}
                {podeMarcarPessoal && c?.id && ehPessoal && (
                  <button
                    type="button"
                    className={ITEM}
                    disabled={desmarcarPessoal.isPending}
                    data-testid="desmarcar-pessoal"
                    title={t("Devolve este contato à operação: a conversa volta ao inbox.")}
                    onClick={() => {
                      fecharOpcoes();
                      desmarcarPessoal.mutate();
                    }}
                  >
                    {desmarcarPessoal.isPending ? t("Desmarcando...") : t("Desmarcar pessoal")}
                  </button>
                )}
              </div>
              {/* Abaixo de 1280px o painel lateral de CRM não existe, e esta é a única porta para o
                  contato; acima, ele já tem o seu "Ver contato". */}
              {c?.id && (
                <Link
                  href={`/app/contacts/${c.id}`}
                  className={`${ITEM} xl:hidden`}
                  onClick={fecharOpcoes}
                >
                  {t("Ver contato")}
                  <ArrowRight size={12} weight="regular" aria-hidden className="ml-auto" />
                </Link>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <LembreteOutroDialog
        conversationId={conversation.id}
        aberto={lembreteOutroAberto}
        aoFechar={() => setLembreteOutroAberto(false)}
      />
      <ReassignDialog
        conversationId={conversation.id}
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        numero={
          onAbrirConversa && c?.id
            ? {
                contactId: c.id,
                contactPhone: c.phone_number ?? null,
                channelSessionId: conversation.channel_session_id,
                onAbrirConversa,
              }
            : undefined
        }
      />
      <AlertDialog open={confirmFecharOpen} onOpenChange={setConfirmFecharOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Fechar esta conversa?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("O atendimento é encerrado. Se o cliente escrever de novo, você pode reabrir.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                close.mutate({
                  conversation_id: conversation.id,
                  expected_revision: conversation.service_revision,
                })
              }
            >
              {t("Fechar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* A confirmação precisa dizer o que ACONTECE, e o que acontece depende
          do estado. `fn_conversation_set_status` trata `archived` como
          terminal: encerra o atendimento (grava `service_closed_at`,
          incrementa a revisão) e, com isso, desfaz a pausa do automático. Um
          atendente que leia "arquivar = tirar da vista, volto depois"
          encerraria o atendimento sem saber — e o robô voltaria a responder
          no próximo "oi" do cliente. Por isso a descrição só aparece quando
          `!encerrada`: quando já está encerrada, arquivar não muda o
          atendimento, só o lugar onde a conversa mora. */}
      <AlertDialog open={confirmArquivarOpen} onOpenChange={setConfirmArquivarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Arquivar esta conversa?")}</AlertDialogTitle>
            {!encerrada && (
              <AlertDialogDescription>
                {t(
                  "Arquivar encerra este atendimento e guarda a conversa no histórico. Se o cliente escrever de novo, ela volta.",
                )}
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                arquivar.mutate({
                  conversation_id: conversation.id,
                  expected_revision: conversation.service_revision,
                })
              }
            >
              {t("Arquivar")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* A confirmação diz o que ACONTECE ao marcar: a conversa fecha e sai do
          atendente, e o contato fica inutilizado para envio — sem apagar nada.
          Desmarcar é direto no botão porque só relista o que já está lá. */}
      <AlertDialog open={confirmPessoalOpen} onOpenChange={setConfirmPessoalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Marcar este contato como pessoal?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "A conversa sai do inbox e o contato fica fora da operação: sem IA, sem follow-up, sem campanha e sem envio. O histórico continua no banco e volta à vista ao desmarcar; follow-ups e campanhas cancelados não voltam.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => marcarPessoal.mutate()}>
              {t("Marcar como pessoal")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
