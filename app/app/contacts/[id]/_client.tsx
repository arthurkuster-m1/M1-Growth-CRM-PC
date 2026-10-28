"use client";

import { LinkVoltar } from "@/components/ui/LinkVoltar";
import { useLocaleDeData } from "@/hooks/i18n/useLocaleDeData";

import { useT } from "@/hooks/i18n/useT";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useDeleteContact } from "@/hooks/contacts/useDeleteContact";
import { format } from "date-fns";
import { DotsThree, ShieldCheck, LockOpen } from "@/lib/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TopoDoLead } from "@/components/contacts/ficha/TopoDoLead";
import { AnotacoesDoLead } from "@/components/contacts/ficha/AnotacoesDoLead";
import { AtendimentoDoLead } from "@/components/contacts/ficha/AtendimentoDoLead";
import { CadastroDoLead } from "@/components/contacts/ficha/CadastroDoLead";
import { OportunidadesDoLead } from "@/components/contacts/ficha/OportunidadesDoLead";
import { PainelDaVisaoGeral } from "@/components/contacts/ficha/PainelDaVisaoGeral";
import { LinhaDoTempoDoLead } from "@/components/contacts/ficha/LinhaDoTempoDoLead";
import { VendasDaFicha } from "@/components/contacts/ficha/VendasDaFicha";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AvisoDeNaoSalvoProvider,
  useSairComAviso,
} from "@/components/contacts/ficha/AvisoDeNaoSalvo";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useContact } from "@/hooks/contacts/useContact";
import { useUnblockContact } from "@/hooks/contacts/useUnblockContact";
import {
  useMarkPersonalContact,
  useUnmarkPersonalContact,
} from "@/hooks/contacts/usePersonalContact";
import { useHierarquiaDoAnuncio } from "@/hooks/contacts/useHierarquiaDoAnuncio";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useDefaultPipeline } from "@/hooks/pipelines/useDefaultPipeline";
import { camposDoFunil } from "@/lib/leads/campos-do-funil";
import { ROLE_RANK } from "@/lib/auth/types";
import { AnonymizeDialog } from "@/components/contacts/AnonymizeDialog";
import { PropostasDeDado } from "@/components/contacts/PropostasDeDado";
import { RoteirosDoContato } from "@/components/contacts/RoteirosDoContato";
import { rotuloDoContato } from "@/lib/contacts/rotulo-do-contato";
import { origemDoContato } from "@/lib/leads/origem-do-contato";
import { DialButton } from "@/components/voice/DialButton";

interface Props {
  contactId: string;
}

const ITEM_DO_MENU =
  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-secondary disabled:opacity-60";

export function ContactDetailClient({ contactId }: Props) {
  return (
    <AvisoDeNaoSalvoProvider>
      <ContactDetailInner contactId={contactId} />
    </AvisoDeNaoSalvoProvider>
  );
}

function ContactDetailInner({ contactId }: Props) {
  const localeDaData = useLocaleDeData();
  const t = useT();
  const q = useContact(contactId);
  const { user, activeOrg } = useAuth();
  const clientesLigado = activeOrg?.cliente_pela_agenda === true;
  // As DEFINIÇÕES continuam no funil (`crm_pipelines.settings.fields[]`) — só o
  // VALOR mora no contato. `camposDoFunil` é o mesmo leitor que o Kanban usa.
  const pipelineQuery = useDefaultPipeline(Boolean(activeOrg));
  const [anonOpen, setAnonOpen] = useState(false);
  const [confirmando, setConfirmando] = useState<"desbloquear" | "pessoal" | "excluir" | null>(
    null,
  );
  const abaDaUrl = useSearchParams().get("aba");
  const ABAS_VALIDAS = [
    "overview",
    "cadastro",
    "atendimento",
    "oportunidades",
    "vendas",
    "anotacoes",
    "timeline",
    "lgpd",
  ];
  const [aba, setAba] = useState(
    abaDaUrl && ABAS_VALIDAS.includes(abaDaUrl) ? abaDaUrl : "overview",
  );
  /** A tarefa que a Visão geral mandou abrir na aba Atendimento e Tarefas. */
  const [tarefaParaAbrir, setTarefaParaAbrir] = useState<string | null>(null);
  // Trocar de aba com algo digitado e não salvo pergunta antes (o que é do Cadastro, por ora).
  const sairComAviso = useSairComAviso();
  const irParaAba = (nova: string) => sairComAviso(() => setAba(nova));
  // Desfazer o descadastro é o override da regra W-02 — só admin, e auditado.
  // O hook fica ANTES dos early returns: chamá-lo depois mudaria a ordem dos
  // hooks entre renderizações e o React reprova.
  const desbloquear = useUnblockContact(contactId);
  // Marcar/desmarcar pessoal (spec 21, etapa 15): os hooks ficam aqui pelo
  // mesmo motivo do `desbloquear` acima.
  const marcarPessoal = useMarkPersonalContact(contactId);
  const desmarcarPessoal = useUnmarkPersonalContact(contactId);
  // Excluir o lead: vai para a Lixeira do CRM (7 dias) com tudo que depende dele.
  const excluir = useDeleteContact();
  const router = useRouter();

  /*
    Pede o nome da campanha SÓ quando há um anúncio e ainda não há nome.

    Quem chegou pelo site já trouxe os nomes na URL, e quem já foi resolvido uma
    vez tem `campaign_name` no metadata — nos dois casos, perguntar à plataforma
    gastaria cota para receber o que já está na tela. Cota é o recurso escasso
    desta conta, não latência.

    Derivado de `q.data` e não de `contact` porque hook não pode ficar depois de
    um `return` condicional — e os dois `if` de carregamento vêm logo abaixo.
  */
  const metadataDoContato = (q.data?.data.source_metadata ?? {}) as Record<string, unknown>;
  const temAnuncio =
    typeof metadataDoContato.ad_id === "string" && metadataDoContato.ad_id.trim() !== "";
  const jaTemNome = typeof metadataDoContato.campaign_name === "string";
  const hierarquia = useHierarquiaDoAnuncio(contactId, temAnuncio && !jaTemNome);

  if (q.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center text-sm text-error-fg">
          {t("Erro ao carregar contato.")}
        </Card>
      </div>
    );
  }

  const contact = q.data.data;
  const isAdmin =
    (user.is_platform_admin && !user.support) ||
    (activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin);
  // Gerente e dono marcam/desmarcam pessoal (spec 21, decisão 1, D3) — e este
  // gate fica LADO A LADO com o `isAdmin` do desbloquear, cada um com seu
  // motivo: desfazer descadastro reabre um canal que o cliente fechou (só
  // admin, LGPD); pessoal é decisão operacional (gerente pode).
  const podeMarcarPessoal =
    (user.is_platform_admin && !user.support) ||
    (activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager);

  // Uma decisão, um lugar (lib/contacts/rotulo-do-contato.ts). Esta tela era
  // uma das DUAS que ignoravam o telefone: contato com número e sem nome
  // aparecia como "Sem nome" aqui e com o número no inbox.
  const displayName = rotuloDoContato(contact, t);
  const podeEditarFicha =
    !contact.is_anonymized &&
    user.support?.access_mode !== "support_readonly" &&
    Boolean(activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.agent);

  // Os quatro níveis que quem opera tráfego lê. O jsonb já os recebia dos dois
  // caminhos de entrada — site e clique-para-WhatsApp — e nenhuma tela o abria.
  //
  // O que a plataforma respondeu entra COMO SE fosse metadata, e não como um
  // segundo caminho na tela: as três chaves resolvidas (`campaign_name`,
  // `adset_name`, `ad_name`) são exatamente as que `origemDoContato` já lê, no
  // degrau abaixo da UTM. Uma regra de precedência só, e ela já estava escrita.
  const origem = origemDoContato(
    hierarquia.data
      ? { ...(contact.source_metadata ?? {}), ...hierarquia.data }
      : contact.source_metadata,
    contact.source,
  );

  return (
    <div className="min-w-0 space-y-4 p-4 sm:p-6">
      {contact.is_anonymized && (
        <div
          role="alert"
          className="sticky top-0 z-20 flex items-center gap-3 rounded-md border border-error-fg/30 bg-error-bg p-3 text-sm text-error-fg"
        >
          <ShieldCheck size={18} weight="duotone" aria-hidden />
          <span>
            {t("Contato anonimizado (LGPD)")}
            {contact.anonymized_at &&
              ` em ${format(new Date(contact.anonymized_at), "dd/MM/yyyy", { locale: localeDaData })}`}
            {t(" — edição bloqueada.")}
          </span>
        </div>
      )}

      <header className="grid gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="grid min-w-0 gap-2">
            <LinkVoltar href="/app/clientes">{t("CRM")}</LinkVoltar>
            {/* Sem truncar: nome é dado que a tela existe pra mostrar. Deixa quebrar linha. */}
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">
              {displayName}
            </h1>
            {contact.is_blocked || contact.is_personal || contact.is_anonymized ? (
              <div className="flex flex-wrap gap-1">
                {contact.is_blocked && <Badge variant="warning">{t("Bloqueado")}</Badge>}
                {/* Selo lido da COLUNA, nunca da etiqueta (critério 5). */}
                {contact.is_personal && <Badge variant="secondary">{t("Pessoal")}</Badge>}
                {contact.is_anonymized && <Badge variant="destructive">{t("Anonimizado")}</Badge>}
              </div>
            ) : null}
          </div>
          {!contact.is_anonymized && user.support?.access_mode !== "support_readonly" && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={t("Mais ações")}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-card hover:bg-secondary"
                >
                  <DotsThree size={18} weight="bold" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1.5">
                <div className="grid gap-0.5">
                  {/* Só ADMIN desfaz o descadastro (regra W-02): reabre um canal que o cliente fechou. */}
                  {contact.is_blocked && isAdmin && (
                    <button
                      type="button"
                      className={ITEM_DO_MENU}
                      onClick={() => setConfirmando("desbloquear")}
                    >
                      <LockOpen size={15} weight="bold" aria-hidden />
                      {t("Desbloquear")}
                    </button>
                  )}
                  {/* PESSOAL (spec 21): gerente marca e desmarca. */}
                  {!contact.is_personal && podeMarcarPessoal && (
                    <button
                      type="button"
                      data-testid="marcar-pessoal"
                      className={ITEM_DO_MENU}
                      onClick={() => setConfirmando("pessoal")}
                    >
                      {t("Marcar como pessoal")}
                    </button>
                  )}
                  {contact.is_personal && podeMarcarPessoal && (
                    <button
                      type="button"
                      data-testid="desmarcar-pessoal"
                      disabled={desmarcarPessoal.isPending}
                      className={ITEM_DO_MENU}
                      onClick={() => desmarcarPessoal.mutate()}
                    >
                      {desmarcarPessoal.isPending ? t("Desmarcando...") : t("Desmarcar pessoal")}
                    </button>
                  )}
                  {podeEditarFicha && (
                    <button
                      type="button"
                      data-testid="excluir-lead"
                      className={`${ITEM_DO_MENU} text-error-fg`}
                      onClick={() => setConfirmando("excluir")}
                    >
                      {t("Excluir lead")}
                    </button>
                  )}
                  <DialButton contactId={contactId} hasPhone={!!contact.phone_number} />
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        <TopoDoLead
          contact={contact}
          camposDefinidos={camposDoFunil(pipelineQuery.data?.pipeline.settings ?? null)}
          podeEditar={podeEditarFicha}
        />
      </header>

      {/* As confirmações ficam fora do menu: o menu fecha ao clicar e levaria o diálogo junto. */}
      <AlertDialog
        open={confirmando === "desbloquear"}
        onOpenChange={(v) => !v && setConfirmando(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Desbloquear este contato?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "Este contato pediu para não receber mais mensagens. Desbloquear volta a permitir campanhas, follow-ups e respostas da IA para ele, e a ação fica registrada na auditoria em seu nome.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => desbloquear.mutate()}>
              {t("Desbloquear")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={confirmando === "pessoal"}
        onOpenChange={(v) => !v && setConfirmando(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Marcar este contato como pessoal?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "O contato sai da operação: conversas fecham, IA, follow-ups, campanha e envios param. O histórico continua no banco e volta à vista ao desmarcar; follow-ups e campanhas cancelados não voltam.",
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
      <AlertDialog
        open={confirmando === "excluir"}
        onOpenChange={(v) => !v && setConfirmando(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("Excluir")} {displayName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "O lead sai do CRM com todas as oportunidades, vendas (mesmo as pagas), conversas e compromissos dele. Fica 7 dias na Lixeira do CRM e pode ser restaurado nesse prazo; depois some de vez.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancelar")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                excluir.mutate(contactId, {
                  onSuccess: () => {
                    toast.success(t("Lead movido para a Lixeira"));
                    router.push("/app/clientes");
                  },
                })
              }
            >
              {t("Excluir lead")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ANTES das abas, e não dentro de uma delas: é o único conteúdo desta
          tela que PEDE uma ação. Enterrado numa aba, viraria pendência que só
          quem já sabe que existe encontra — e a fila deixaria de ser fila.
          Some sozinho quando não há nada aguardando. */}
      {!contact.is_anonymized && user.support?.access_mode !== "support_readonly" && (
        <PropostasDeDado
          contactId={contactId}
          podeDecidir={Boolean(activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.agent)}
          aoDecidir={() => void q.refetch()}
        />
      )}

      <Tabs value={aba} onValueChange={irParaAba} className="min-w-0">
        <TabsList className="h-auto w-full max-w-full [scrollbar-width:none] justify-start overflow-x-auto sm:w-fit [&::-webkit-scrollbar]:hidden [&>*]:shrink-0">
          <TabsTrigger value="overview">{t("Visão geral")}</TabsTrigger>
          <TabsTrigger value="cadastro">{t("Cadastro")}</TabsTrigger>
          <TabsTrigger value="atendimento">{t("Atendimento e Tarefas")}</TabsTrigger>
          <TabsTrigger value="oportunidades">{t("Oportunidades")}</TabsTrigger>
          <TabsTrigger value="vendas">{t("Vendas")}</TabsTrigger>
          <TabsTrigger value="anotacoes">{t("Anotações")}</TabsTrigger>
          <TabsTrigger value="timeline">{t("Linha do Tempo")}</TabsTrigger>
          {isAdmin && <TabsTrigger value="lgpd">LGPD</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <PainelDaVisaoGeral
            contactId={contactId}
            aoAbrir={irParaAba}
            podeEditar={podeEditarFicha}
            aoAbrirTarefa={(id) => {
              setTarefaParaAbrir(id);
              irParaAba("atendimento");
            }}
          />
          <div className="mt-4">
            <RoteirosDoContato contactId={contactId} />
          </div>
        </TabsContent>

        <TabsContent value="cadastro" className="mt-4">
          <CadastroDoLead
            contact={contact}
            origem={origem}
            podeEditar={podeEditarFicha}
            camposDefinidos={camposDoFunil(pipelineQuery.data?.pipeline.settings ?? null)}
            clientesLigado={clientesLigado}
            podeGerirCategorias={Boolean(podeMarcarPessoal)}
          />
        </TabsContent>

        <TabsContent value="atendimento" className="mt-4">
          <AtendimentoDoLead
            contactId={contactId}
            nomeDoContato={displayName}
            abrirTarefaId={tarefaParaAbrir}
          />
        </TabsContent>

        <TabsContent value="oportunidades" className="mt-4">
          <OportunidadesDoLead contactId={contactId} podeEditar={podeEditarFicha} />
        </TabsContent>

        <TabsContent value="vendas" className="mt-4">
          <VendasDaFicha contactId={contactId} nome={displayName} />
        </TabsContent>

        <TabsContent value="anotacoes" className="mt-4">
          <AnotacoesDoLead contactId={contactId} podeEditar={podeEditarFicha} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <LinhaDoTempoDoLead contactId={contactId} podeEditar={podeEditarFicha} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="lgpd" className="mt-4">
            <Card className="space-y-4 p-4">
              <div>
                <h2 className="text-lg font-semibold">{t("Direito ao esquecimento (LGPD)")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(
                    "A anonimização é irreversível. Use somente após confirmação formal do titular ou ordem judicial.",
                  )}
                </p>
              </div>
              {contact.is_anonymized ? (
                <p className="text-sm text-muted-foreground">
                  {t("Este contato já foi anonimizado")}
                  {contact.anonymized_at &&
                    ` em ${format(new Date(contact.anonymized_at), "dd/MM/yyyy HH:mm", { locale: localeDaData })}`}
                  .
                </p>
              ) : (
                <Button variant="destructive" onClick={() => setAnonOpen(true)}>
                  {t("Anonimizar contato")}
                </Button>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <AnonymizeDialog contactId={contactId} open={anonOpen} onOpenChange={setAnonOpen} />
    </div>
  );
}
