"use client";
/**
 * A FICHA DO CONTATO no painel lateral do Inbox: a mesma ficha da página do lead, em versão
 * estreita — dados de cima (nome, celular, oportunidades abertas, ciclo, MQL e as ações de
 * registrar), números (gasto e potencial), compromissos e tarefas com UM botão de criar, e os
 * blocos que abrem e fecham (Anotações, Tags, Origem, Atividade, Vendas).
 *
 * Tudo vem dos mesmos componentes e das mesmas rotas da página do lead: o que se edita aqui é o
 * que se vê lá.
 */
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";

import { BlocoRecolhivel } from "@/components/agenda/BlocoRecolhivel";
import { CompromissosDoLead } from "@/components/agenda/CompromissosDoLead";
import { AnotacoesDoLead } from "@/components/contacts/ficha/AnotacoesDoLead";
import { CardDaOportunidade } from "@/components/contacts/ficha/OportunidadesDoLead";
import { RegistrarAcaoDoLead } from "@/components/contacts/ficha/LinhaDoTempoDoLead";
import { TagsDoLead } from "@/components/contacts/ficha/TagsDoLead";
import { TopoDoLead } from "@/components/contacts/ficha/TopoDoLead";
import { TimelineView } from "@/components/contacts/TimelineView";
import { NumeroQueCabe } from "@/components/ui/NumeroQueCabe";
import { Skeleton } from "@/components/ui/skeleton";
import { TarefasDaOportunidade } from "@/components/vendas/BlocosDaOportunidade";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { useContact } from "@/hooks/contacts/useContact";
import { useT } from "@/hooks/i18n/useT";
import { useDefaultPipeline } from "@/hooks/pipelines/useDefaultPipeline";
import { abrirNovoCompromisso } from "@/lib/agenda/abrir-novo";
import { apiClient } from "@/lib/api/client";
import { ROLE_RANK } from "@/lib/auth/types";
import { camposDoFunil } from "@/lib/leads/campos-do-funil";
import { origemDoContato } from "@/lib/leads/origem-do-contato";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { Plus } from "@/lib/ui/icons";
import { nomeDaVenda, ROTULO_DO_STATUS_DA_VENDA, valorPagoDaVenda, type Venda } from "@/lib/vendas";

const reais = (c: number) => moedaDoNumero(c / 100);

export function FichaDoInbox({
  contactId,
  conversationId,
}: {
  contactId: string;
  conversationId: string;
}) {
  const t = useT();
  const { user, activeOrg } = useAuth();
  const contatoQ = useContact(contactId);
  const pipeline = useDefaultPipeline(Boolean(activeOrg));
  const [pedidoDeTarefa, setPedidoDeTarefa] = useState(0);
  const [oportunidadeAbertaId, setOportunidadeAbertaId] = useState<string | null>(null);

  const vendasQ = useQuery({
    queryKey: ["vendas-do-cliente", contactId],
    retry: false,
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contactId}`))
        .data.vendas,
  });
  const notasQ = useQuery({
    queryKey: ["anotacoes-do-lead", contactId, "todas"],
    staleTime: 10_000,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: Array<{ id: string; titulo: string; texto: string; fixada: boolean }>;
        }>(`/api/v1/contacts/${contactId}/anotacoes`)
      ).data,
  });

  const contact = contatoQ.data?.data;
  const vendas = vendasQ.data ?? [];
  const gasto = vendas.reduce((s, v) => s + valorPagoDaVenda(v), 0);
  // Potencial: o valor dos produtos de interesse (vendas ainda em "interesse").
  const potencial = vendas
    .filter((v) => v.status === "interesse")
    .reduce((s, v) => s + v.amount_cents, 0);
  const importantes = (notasQ.data ?? []).filter((n) => n.fixada);

  const podeEditar =
    Boolean(contact) &&
    !contact!.is_anonymized &&
    user.support?.access_mode !== "support_readonly" &&
    Boolean(activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.agent);
  const podeGerirCategorias = Boolean(activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager);

  const origem = useMemo(
    () => (contact ? origemDoContato(contact.source_metadata, contact.source) : null),
    [contact],
  );

  if (contatoQ.isLoading || !contact) {
    return (
      <div className="space-y-3" data-testid="ficha-do-inbox-carregando">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div
      className="flex max-w-full min-w-0 flex-col gap-3 overflow-x-hidden"
      data-testid="ficha-do-inbox"
    >
      <TopoDoLead
        contact={contact}
        camposDefinidos={camposDoFunil(pipeline.data?.pipeline.settings ?? null)}
        podeEditar={podeEditar}
        semInbox
        comNome
      />

      <div className="grid grid-cols-2 gap-2">
        <Numero rotulo={t("LTV (gasto)")} valor={reais(gasto)} />
        <Numero rotulo={t("Potencial LTV")} valor={reais(potencial)} />
      </div>

      {importantes.length > 0 ? (
        <section
          data-testid="inbox-notas-importantes"
          className="rounded-2xl border border-border p-3"
        >
          <h3 className="text-sm font-semibold">{t("Notas importantes")}</h3>
          <ul className="mt-2 grid gap-2">
            {importantes.map((n) => (
              <li key={n.id} className="text-xs">
                {n.titulo ? <p className="font-semibold break-words">{n.titulo}</p> : null}
                <p className="break-words whitespace-pre-wrap">{n.texto}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <BlocoRecolhivel titulo={t("Tarefas e compromissos")} inicialmenteAberto resumo={null}>
        {podeEditar ? (
          <div className="mb-3 flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Plus size={14} weight="bold" aria-hidden className="mr-1" />
                  {t("Novo")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => abrirNovoCompromisso({ contactId, conversationId })}
                >
                  {t("Novo compromisso")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setPedidoDeTarefa((n) => n + 1)}>
                  {t("Nova tarefa")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
        <div className="grid gap-3">
          <CompromissosDoLead contactId={contactId} semBotao />
          <TarefasDaOportunidade
            contactId={contactId}
            podeEditar={podeEditar}
            semBotao
            abrirCriacao={pedidoDeTarefa}
          />
        </div>
      </BlocoRecolhivel>

      <BlocoRecolhivel titulo={t("Anotações")}>
        <AnotacoesDoLead contactId={contactId} podeEditar={podeEditar} semBloco semNova />
      </BlocoRecolhivel>

      <BlocoRecolhivel titulo={t("Tags")}>
        <TagsDoLead
          contact={contact}
          podeEditar={podeEditar}
          podeGerirCategorias={podeGerirCategorias}
        />
      </BlocoRecolhivel>

      <BlocoRecolhivel titulo={t("Origem")}>
        {origem ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Campo rotulo={t("Origem")} valor={origem.origem} />
            <Campo rotulo={t("Campanha")} valor={origem.campanha} />
            <Campo rotulo={t("Conjunto")} valor={origem.conjunto} />
            <Campo rotulo={t("Anúncio")} valor={origem.anuncio} />
          </dl>
        ) : null}
        <Link
          href={`/app/contacts/${contactId}`}
          className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
        >
          {t("Ver landing page, rastreamento e alterar origem")}
        </Link>
      </BlocoRecolhivel>

      <BlocoRecolhivel titulo={t("Atividade")}>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
          <RegistrarAcaoDoLead contactId={contactId} podeEditar={podeEditar} semBloco />
          <TimelineView contactId={contactId} />
        </div>
      </BlocoRecolhivel>

      <BlocoRecolhivel
        titulo={t("Vendas")}
        resumo={vendas.length > 0 ? String(vendas.length) : null}
      >
        {vendasQ.isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : vendas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Sem vendas.")}</p>
        ) : (
          <ul className="grid gap-1.5">
            {vendas.map((v) => (
              <li key={v.id} className="min-w-0">
                <button
                  type="button"
                  disabled={!v.lead_id}
                  title={t("Abrir a oportunidade")}
                  onClick={() => v.lead_id && setOportunidadeAbertaId(v.lead_id)}
                  className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs hover:bg-secondary/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {nomeDaVenda(v) || t("Venda")}
                    </span>
                    <span className="block text-muted-foreground">
                      {t(ROTULO_DO_STATUS_DA_VENDA[v.status] ?? v.status)}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {reais(v.amount_cents)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </BlocoRecolhivel>
      {oportunidadeAbertaId ? (
        <CardDaOportunidade
          leadId={oportunidadeAbertaId}
          aoFechar={() => setOportunidadeAbertaId(null)}
        />
      ) : null}
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card/50 p-3">
      <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {rotulo}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums">
        <NumeroQueCabe>{valor}</NumeroQueCabe>
      </p>
    </div>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {rotulo}
      </dt>
      <dd className="break-words">{valor || "—"}</dd>
    </div>
  );
}
