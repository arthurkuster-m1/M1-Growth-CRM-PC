"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";

import { BlocoDaFicha, SeloDaFicha } from "@/components/contacts/ficha/BlocoDaFicha";
import { BarraDeConsulta, type CampoDaBarra } from "@/components/motor/BarraDeConsulta";
import {
  aplicarConsulta,
  consultaAtiva,
  type CampoConsultavel,
  type ConsultaDaTabela,
} from "@/lib/motor/consulta";
import { showApiError } from "@/components/feedback/ApiErrorToast";
import { CardDaOportunidade } from "@/components/contacts/ficha/OportunidadesDoLead";
import { LoseLeadDialog } from "@/components/kanban/LoseLeadDialog";
import { CirculoDeRecebida } from "@/components/vendas/CirculoDeRecebida";
import { useMarcarParcela } from "@/hooks/vendas/useMarcarParcela";
import { Etiqueta } from "@/components/motor/Etiqueta";
import { SeletorDeOpcao } from "@/components/motor/SeletorDeOpcao";
import { resumoDaVenda } from "@/lib/vendas-tabela";
import { useRotuloDaForma } from "@/hooks/financeiro/useTaxasDePagamento";
import { useT } from "@/hooks/i18n/useT";
import { apiClient } from "@/lib/api/client";
import { moedaDoNumero } from "@/lib/marketing/produtos-csv";
import type { CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";
import {
  STATUS_DA_VENDA,
  nomeDaVenda,
  valorPagoDaVenda,
  valorPrevistoDaVenda,
  type StatusDaVenda,
  type Venda,
} from "@/lib/vendas";

const reais = (c: number) => moedaDoNumero(c / 100);
const dataBr = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

const ROTULO: Record<StatusDaVenda, string> = {
  interesse: "Possível venda",
  comprometida: "Comprometido",
  concluida: "Pago",
  recorrencia_ativa: "Recorrência ativa",
  recorrencia_encerrada: "Recorrência encerrada",
  cancelada: "Cancelado",
};
const COR_DA_OPCAO: Record<StatusDaVenda, CorDaOpcao> = {
  interesse: "blue",
  comprometida: "yellow",
  concluida: "green",
  recorrencia_ativa: "blue",
  recorrencia_encerrada: "brown",
  cancelada: "gray",
};
const COR: Record<StatusDaVenda, "blue" | "yellow" | "green" | "gray"> = {
  interesse: "blue",
  comprometida: "yellow",
  concluida: "green",
  recorrencia_ativa: "blue",
  recorrencia_encerrada: "gray",
  cancelada: "gray",
};

/**
 * A ABA VENDAS: o resumo do dinheiro do cliente (LTV atual, LTV previsto, vendas, ticket médio) e a
 * tabela de todas as vendas, com status editável na própria linha e cadastro de venda nova.
 */
export function VendasDaFicha({ contactId, nome }: { contactId: string; nome: string }) {
  const t = useT();
  const rotuloDaFormaDe = useRotuloDaForma();
  const queryClient = useQueryClient();
  const marcarParcela = useMarcarParcela();
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<Venda | null>(null);
  const [busca, setBusca] = useState("");
  const [consultaDaTabela, setConsultaDaTabela] = useState<ConsultaDaTabela>({});

  const consulta = useQuery({
    queryKey: ["vendas-do-cliente", contactId],
    retry: false,
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: { vendas: Venda[] } }>(`/api/v1/vendas?contato=${contactId}`)).data
        .vendas,
  });
  if (consulta.isError) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        {t("Você não tem permissão para ver as vendas deste cliente.")}
      </p>
    );
  }
  const vendas = consulta.data ?? [];
  // Entram as vendas de pé e as que já receberam algo (um sinal de venda cancelada não volta).
  const realizadas = vendas.filter(
    (v) =>
      v.status === "comprometida" ||
      v.status === "concluida" ||
      v.status === "recorrencia_ativa" ||
      v.status === "recorrencia_encerrada" ||
      (v.parcelas ?? []).some((p) => p.status === "recebida"),
  );
  /** O que já entrou: as parcelas recebidas (ou o total, na venda concluída sem parcelas). */
  const recebido = valorPagoDaVenda;
  /** O que falta entrar: o total menos o que já entrou (venda cancelada não deve nada). */
  const faltando = valorPrevistoDaVenda;
  const aReceber = (v: Venda) => {
    const p = v.parcelas ?? [];
    if (p.length === 0) return v.status === "comprometida" ? v.amount_cents : 0;
    return p.filter((x) => x.status === "prevista").reduce((a, x) => a + x.amount_cents, 0);
  };
  /** Uma venda "conta" quando algo foi pago: ao menos uma parcela recebida (um sinal já vale). */
  const foiPaga = (v: Venda) => {
    const p = (v.parcelas ?? []).filter((x) => x.status !== "cancelada");
    if (p.length === 0) return v.status === "concluida";
    return p.some((x) => x.status === "recebida");
  };
  const pagas = realizadas.filter(foiPaga);
  const ltv = realizadas.reduce((s, v) => s + recebido(v), 0);
  const previsto = realizadas.reduce((s, v) => s + aReceber(v), 0);
  const emInteresse = vendas
    .filter((v) => v.status === "interesse")
    .reduce((s, v) => s + v.amount_cents, 0);
  const totalVendido = pagas.reduce((s, v) => s + v.amount_cents, 0);
  const ticket = pagas.length > 0 ? Math.round(totalVendido / pagas.length) : 0;

  // ── Busca, filtro, agrupamento e ordem (o mesmo motor das outras tabelas) ──
  const campos: Array<
    CampoConsultavel<Venda> & {
      titulo: string;
      opcoes?: { id: string; rotulo: string }[];
    }
  > = [
    { id: "nome", titulo: t("Nome"), tipo: "texto", valorDe: (v) => nomeDaVenda(v) },
    { id: "produto", titulo: t("Produto"), tipo: "texto", valorDe: (v) => v.product_name },
    { id: "funil", titulo: t("Funil"), tipo: "texto", valorDe: (v) => v.funil ?? "" },
    {
      id: "status",
      titulo: t("Status"),
      tipo: "opcao",
      valorDe: (v) => v.status,
      opcoes: STATUS_DA_VENDA.map((s) => ({ id: s, rotulo: t(ROTULO[s]) })),
      rotuloDoValor: (v) => t(ROTULO[v as StatusDaVenda] ?? v),
      ordemDoValor: (v) => STATUS_DA_VENDA.indexOf(v as StatusDaVenda),
    },
    { id: "total", titulo: t("Valor total"), tipo: "numero", valorDe: (v) => v.amount_cents / 100 },
    { id: "pago", titulo: t("Valor pago"), tipo: "numero", valorDe: (v) => recebido(v) / 100 },
    { id: "falta", titulo: t("Previsto"), tipo: "numero", valorDe: (v) => faltando(v) / 100 },
    { id: "etapa", titulo: t("Etapa"), tipo: "texto", valorDe: (v) => v.etapa ?? "" },
    {
      id: "previsao",
      titulo: t("Previsão de fechamento"),
      tipo: "data",
      valorDe: (v) => v.expected_close_date,
    },
    { id: "compromisso", titulo: t("Compromisso"), tipo: "data", valorDe: (v) => v.expected_on },
    { id: "pago_em", titulo: t("Pago em"), tipo: "data", valorDe: (v) => v.paid_on },
    { id: "pagamento", titulo: t("Pagamento"), tipo: "texto", valorDe: (v) => v.payment_method },
  ];
  const camposDaBarra: CampoDaBarra[] = campos.map((c) => ({
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    opcoes: c.opcoes,
  }));
  const termo = busca
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
  const buscadas = termo
    ? vendas.filter((v) =>
        `${nomeDaVenda(v)} ${v.product_name} ${v.funil ?? ""} ${v.payment_method} ${v.notes} ${v.reference}`
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .includes(termo),
      )
    : vendas;
  const resultado = aplicarConsulta(buscadas, campos, consultaDaTabela, {
    hoje: new Date().toISOString().slice(0, 10),
  });
  const grupos = resultado.grupos?.map((g) => {
    const campo = campos.find((c) => c.id === consultaDaTabela.agrupar);
    const rotulo =
      g.chave === ""
        ? t("Sem valor")
        : (campo?.opcoes?.find((o) => o.id === g.chave)?.rotulo ?? g.rotulo);
    return { chave: g.chave || "__vazio", rotulo, linhas: g.linhas };
  });

  async function atualizar() {
    await queryClient.invalidateQueries({ queryKey: ["vendas-do-cliente", contactId] });
    await queryClient.invalidateQueries({ queryKey: ["vendas"] });
    await queryClient.invalidateQueries({ queryKey: ["clientes"] });
  }
  async function mudarStatus(v: Venda, status: StatusDaVenda) {
    try {
      await apiClient.patch(`/api/v1/vendas/${v.id}`, { status });
      await atualizar();
    } catch (e) {
      showApiError(e);
    }
  }

  const cartoes: Array<[string, string, "green" | "blue" | "purple" | "orange" | "yellow"]> = [
    [t("LTV atual"), reais(ltv), "green"],
    [t("A receber"), reais(previsto), "blue"],
    [t("LTV em interesse"), reais(emInteresse), "yellow"],
    [t("Vendas"), String(pagas.length), "purple"],
    [t("Ticket médio"), reais(ticket), "orange"],
  ];
  const BARRA = {
    green: "border-l-green-500",
    blue: "border-l-blue-500",
    purple: "border-l-purple-500",
    orange: "border-l-orange-500",
    yellow: "border-l-yellow-500",
  } as const;

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {cartoes.map(([rotulo, valor, cor]) => (
          <div key={rotulo} className={`rounded-2xl border border-l-4 bg-card p-4 shadow-sm ${BARRA[cor]}`}>
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{rotulo}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p>
          </div>
        ))}
      </div>

      <BlocoDaFicha
        titulo={t("Vendas e interesses")}
        cor="green"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="relative min-w-0 flex-1 basis-56">
            <span className="sr-only">{t("Buscar")}</span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={t("Buscar venda")}
              className="h-9 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </label>
          <BarraDeConsulta
            compacta
            campos={camposDaBarra}
            consulta={consultaDaTabela}
            aoMudar={setConsultaDaTabela}
          />
        </div>

        {consulta.isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-secondary" />
        ) : vendas.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("Nenhuma venda ou interesse cadastrado.")}</p>
        ) : resultado.linhas.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            {t("Nada combina com a busca e os filtros.")}
            {consultaAtiva(consultaDaTabela) || busca ? (
              <button
                type="button"
                className="ml-2 font-medium text-primary hover:underline"
                onClick={() => {
                  setBusca("");
                  setConsultaDaTabela({});
                }}
              >
                {t("Limpar")}
              </button>
            ) : null}
          </p>
        ) : (
          <div className="max-w-full overflow-x-auto rounded-xl border">
            <table className="w-full min-w-max text-sm">
              <thead className="bg-secondary/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t("Oportunidade")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Funil")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Produto(s)")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Status")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Forma de pagamento")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Parcelas")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Valor pago")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Valor previsto")}</th>
                  <th className="px-3 py-2 text-right font-medium">{t("Valor total")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Primeiro pagamento")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Último pagamento")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Próximo pagamento")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Origem")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Campanha")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Anúncio")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Landing page")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Posicionamento")}</th>
                </tr>
              </thead>
              <tbody>
                {(grupos ?? [{ chave: "__todas", rotulo: "", linhas: resultado.linhas }]).map((g) => (
                  <Fragment key={g.chave}>
                    {grupos ? (
                      <tr className="bg-secondary/40">
                        <td colSpan={17} className="px-3 py-1.5 text-xs font-semibold">
                          {g.rotulo} <span className="font-normal text-muted-foreground">({g.linhas.length})</span>
                        </td>
                      </tr>
                    ) : null}
                    {g.linhas.map((v) => {
                      const r = resumoDaVenda(v);
                      return (
                        <tr key={v.id} className="border-t align-top hover:bg-secondary/40">
                          <td className="max-w-[18rem] px-3 py-2">
                            <button
                              type="button"
                              title={nomeDaVenda(v)}
                              className="block max-w-full truncate text-left font-medium hover:underline"
                              onClick={() => setAbertaId(v.id)}
                            >
                              {nomeDaVenda(v) || t("Sem produto")}
                            </button>
                          </td>
                          <td className="px-3 py-2">{v.funil ?? "—"}</td>
                          <td className="max-w-[16rem] truncate px-3 py-2" title={r.produtos}>
                            {r.produtos || "—"}
                          </td>
                          <td className="px-3 py-2">
                            <SeletorDeOpcao
                              opcoes={STATUS_DA_VENDA.map((s) => ({
                                id: s,
                                rotulo: t(ROTULO[s]),
                                cor: COR_DA_OPCAO[s],
                              }))}
                              valorId={v.status}
                              podeEditar
                              rotulo={t("Status da venda")}
                              aoEscolher={(id) => {
                                if (id === v.status) return;
                                if (id === "cancelada" || id === "recorrencia_encerrada") setCancelando(v);
                                else void mudarStatus(v, id as StatusDaVenda);
                              }}
                            >
                              <Etiqueta ponto cor={COR_DA_OPCAO[v.status]}>
                                {t(ROTULO[v.status])}
                              </Etiqueta>
                            </SeletorDeOpcao>
                          </td>
                          <td className="px-3 py-2">
                            {v.payment_method ? rotuloDaFormaDe(v.payment_method) : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {r.parcelas.length === 0 ? (
                              <div className="flex items-center gap-2 text-xs">
                                <CirculoDeRecebida
                                  marcado={v.status === "concluida"}
                                  desabilitado={v.status === "cancelada"}
                                  rotulo={`${t("À vista")} ${t("recebido")}`}
                                  aoMudar={(ok) =>
                                    void mudarStatus(v, ok ? "concluida" : "comprometida")
                                  }
                                />
                                <span className="tabular-nums">
                                  {t("À vista")} · {reais(v.amount_cents)}
                                </span>
                              </div>
                            ) : (
                              <ul className="grid gap-1">
                                {r.parcelas.map((p) => (
                                  <li key={p.number}>
                                    <div className="flex min-w-0 items-center gap-2 text-xs">
                                      <CirculoDeRecebida
                                        marcado={p.status === "recebida"}
                                        rotulo={`${t("Parcela")} ${p.number} ${t("recebida")}`}
                                        aoMudar={(ok) => void marcarParcela(v, p.number, ok)}
                                      />
                                      <span className="min-w-0 truncate tabular-nums">
                                        {p.number}/{r.parcelas.length} · {reais(p.amount_cents)} ·{" "}
                                        {p.status === "recebida" && p.paid_on
                                          ? `${t("pago em")} ${dataBr(p.paid_on.slice(0, 10))}`
                                          : `${t("vence")} ${dataBr(p.due_on)}`}
                                      </span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">
                            {reais(r.pagoCents)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{reais(r.previstoCents)}</td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {reais(v.amount_cents)}
                          </td>
                          <td className="px-3 py-2 tabular-nums">{dataBr(r.primeiroPagamento)}</td>
                          <td className="px-3 py-2 tabular-nums">{dataBr(r.ultimoPagamento)}</td>
                          <td className="px-3 py-2 tabular-nums">{dataBr(r.proximoPagamento)}</td>
                          <td className="px-3 py-2">{v.origem ?? "—"}</td>
                          <td className="px-3 py-2">{v.campanha ?? "—"}</td>
                          <td className="px-3 py-2">{v.anuncio ?? "—"}</td>
                          <td className="px-3 py-2">{v.lp ?? "—"}</td>
                          <td className="px-3 py-2">{v.posicionamento ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-secondary/60 text-sm font-semibold">
                <tr>
                  <td className="px-3 py-2">
                    {t("Total")} · {resultado.linhas.length}
                  </td>
                  <td colSpan={4} />
                  <td className="px-3 py-2 tabular-nums">
                    {resultado.linhas.reduce((a, v) => a + resumoDaVenda(v).parcelasPagas, 0)}/
                    {resultado.linhas.reduce((a, v) => a + resumoDaVenda(v).parcelas.length, 0)}{" "}
                    {t("parcelas pagas")}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-green-700 dark:text-green-400">
                    {reais(resultado.linhas.reduce((a, v) => a + resumoDaVenda(v).pagoCents, 0))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {reais(resultado.linhas.reduce((a, v) => a + resumoDaVenda(v).previstoCents, 0))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {reais(resultado.linhas.reduce((a, v) => a + v.amount_cents, 0))}
                  </td>
                  <td colSpan={8} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </BlocoDaFicha>

      {abertaId ? <CardDaOportunidade leadId={abertaId} aoFechar={() => setAbertaId(null)} /> : null}
      {cancelando && cancelando.pipeline_id ? (
        <LoseLeadDialog
          open
          leadId={cancelando.id}
          pipelineId={cancelando.pipeline_id}
          onOpenChange={(aberta) => {
            if (aberta) return;
            setCancelando(null);
            void atualizar();
          }}
        />
      ) : null}
    </div>
  );
}
