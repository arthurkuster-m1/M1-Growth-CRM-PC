"use client";

import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";

import { CompromissosDoLead } from "@/components/agenda/CompromissosDoLead";
import { BlocoRecolhivel } from "@/components/agenda/BlocoRecolhivel";
import { AnotacoesDoLead } from "@/components/contacts/ficha/AnotacoesDoLead";
import { BlocoDaFicha, EstiloDosBlocos } from "@/components/contacts/ficha/BlocoDaFicha";
import { CadastroDoLead } from "@/components/contacts/ficha/CadastroDoLead";
import { OportunidadesEVendasDoLead } from "@/components/contacts/ficha/OportunidadesEVendasDoLead";
import { RoteirosDoContato } from "@/components/contacts/RoteirosDoContato";
import { TarefasDaOportunidade } from "@/components/vendas/BlocosDaOportunidade";
import { NumeroQueCabe } from "@/components/ui/NumeroQueCabe";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import { valorPagoDaVenda, type Venda } from "@/lib/vendas";

const reais = (c: number) => moedaDoNumero(c / 100);

/**
 * A VISÃO GERAL DO LEAD, na ordem final: as métricas do dinheiro, os Compromissos e as Tarefas, e
 * depois, em toggles, Anotações, Oportunidades e vendas, Cadastro (com os links), Origem, Datas e Tags.
 */
export function VisaoGeralDoLead({
  contactId,
  nome: _nome,
  podeEditar,
  ...cadastro
}: {
  contactId: string;
  nome: string;
  podeEditar: boolean;
} & Omit<ComponentProps<typeof CadastroDoLead>, "podeEditar">) {
  const t = useT();

  const vendasQ = useQuery({
    queryKey: ["vendas-do-cliente", contactId],
    retry: false,
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contactId}`))
        .data.vendas,
  });
  const tarefasQ = useQuery({
    queryKey: ["tarefas-do-contato", contactId],
    staleTime: 10_000,
    queryFn: async () =>
      (
        await apiClient.get<{ data: { tasks: unknown[] } }>(
          `/api/v1/tasks?contact_id=${contactId}&aberto=true`,
        )
      ).data.tasks ?? [],
  });

  // As mesmas contas da antiga aba Vendas.
  const vendas = vendasQ.data ?? [];
  const realizadas = vendas.filter(
    (v) =>
      v.status === "comprometida" ||
      v.status === "concluida" ||
      v.status === "recorrencia_ativa" ||
      v.status === "recorrencia_encerrada" ||
      (v.parcelas ?? []).some((p) => p.status === "recebida"),
  );
  const foiPaga = (v: Venda) => {
    const p = (v.parcelas ?? []).filter((x) => x.status !== "cancelada");
    if (p.length === 0) return v.status === "concluida";
    return p.some((x) => x.status === "recebida");
  };
  const aReceberDe = (v: Venda) => {
    const p = v.parcelas ?? [];
    if (p.length === 0) return v.status === "comprometida" ? v.amount_cents : 0;
    return p.filter((x) => x.status === "prevista").reduce((a, x) => a + x.amount_cents, 0);
  };
  const pagas = realizadas.filter(foiPaga);
  const ltv = realizadas.reduce((s, v) => s + valorPagoDaVenda(v), 0);
  const aReceber = realizadas.reduce((s, v) => s + aReceberDe(v), 0);
  const emInteresse = vendas
    .filter((v) => v.status === "interesse")
    .reduce((s, v) => s + v.amount_cents, 0);
  const ticket =
    pagas.length > 0 ? Math.round(pagas.reduce((s, v) => s + v.amount_cents, 0) / pagas.length) : 0;

  const metricas: Array<[string, string]> = [
    [t("LTV atual"), reais(ltv)],
    [t("A receber"), reais(aReceber)],
    [t("Em interesse"), reais(emInteresse)],
    [t("Compras"), String(pagas.length)],
    [t("Ticket médio"), reais(ticket)],
    [t("Tarefas abertas"), String(tarefasQ.data?.length ?? 0)],
  ];

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {metricas.map(([rotulo, valor]) => (
          <div key={rotulo} className="min-w-0 rounded-2xl border border-border bg-card/50 p-3">
            <p className="truncate text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {rotulo}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              <NumeroQueCabe>{valor}</NumeroQueCabe>
            </p>
          </div>
        ))}
      </div>

      <EstiloDosBlocos.Provider value="cartao">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
          <BlocoDaFicha titulo={t("Compromissos")}>
            <CompromissosDoLead contactId={contactId} />
          </BlocoDaFicha>
          <BlocoDaFicha titulo={t("Tarefas")}>
            <TarefasDaOportunidade contactId={contactId} podeEditar={podeEditar} />
          </BlocoDaFicha>
        </div>
      </EstiloDosBlocos.Provider>

      <EstiloDosBlocos.Provider value="toggle">
        <div className="grid gap-4">
          <BlocoRecolhivel titulo={t("Anotações")}>
            <AnotacoesDoLead contactId={contactId} podeEditar={podeEditar} semBloco semNova />
          </BlocoRecolhivel>
          <OportunidadesEVendasDoLead contactId={contactId} podeEditar={podeEditar} />
          <CadastroDoLead {...cadastro} podeEditar={podeEditar} />
        </div>
      </EstiloDosBlocos.Provider>

      <RoteirosDoContato contactId={contactId} />
    </div>
  );
}
