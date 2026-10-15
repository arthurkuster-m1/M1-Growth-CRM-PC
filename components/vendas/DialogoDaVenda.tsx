"use client";

import { CampoDeData } from "@/components/motor/CalendarioDePeriodo";
import { OrigemEmCascata, type ValorDaOrigem } from "@/components/contacts/ficha/OrigemEmCascata";
import { corpoDaOrigem, valorDaOrigemDoCard } from "@/components/contacts/ficha/origem-do-card";
import type { DadosDoLead } from "@/components/leads/FichaDoLead";
import type { CampanhaOpcao } from "@/lib/marketing/origem-opcoes";
import Link from "next/link";
import { CustomFieldsEditor, type CustomFieldDef } from "@/components/contacts/CustomFieldsEditor";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiClient } from "@/lib/api/client";
import { useT } from "@/hooks/i18n/useT";
import { somarMesesNaData } from "@/lib/vendas-recorrentes";
import { useCatalogoDeProdutos } from "@/hooks/vendas/useCatalogoDeProdutos";
import { lerNumero } from "@/lib/marketing/calculadora";
import { CirculoDeRecebida } from "@/components/vendas/CirculoDeRecebida";
import { CaretDown, Plus, Trash } from "@/lib/ui/icons";
import {
  FORMAS_DE_PAGAMENTO,
  rotuloDaForma,
  ajustarParcelasAoTotal,
  gerarParcelas,
  redistribuirAposEditar,
  type FormaDePagamento,
  type ParcelaDaVenda,
  type Venda,
} from "@/lib/vendas";

const CAMPO =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60";

export interface ClienteOpcao {
  contact_id: string;
  nome: string;
  telefone: string | null;
}

export interface DadosDaVenda {
  id?: string;
  contact_id: string;
  status: "interesse" | "comprometida" | "concluida" | "cancelada";
  itens: Array<{ product_id: string; quantity: number; amount_cents: number }>;
  pagamentos: Array<{
    number: number;
    due_on: string;
    paid_on: string | null;
    amount_cents: number;
    status: "prevista" | "recebida";
  }>;
  payment_method: string;
  is_recurring: boolean;
  recurrence_active: boolean;
  reference: string;
  notes: string;
  /** Previsão de fechamento e descrição: campos da venda (o card do funil). */
  expected_close_date?: string | null;
  description?: string;
  /** O nome dado à venda (vazio = os produtos juntados). */
  name?: string;
  /** Assinatura: quantos meses de parcelas previstas o sistema mantém à frente (1 a 12). */
  recurrence_ahead?: number;
  /** Quem da equipe é o responsável pela venda (só vem quando mudou). */
  responsavel_id?: string | null;
}

const hoje = () => new Date().toISOString().slice(0, 10);
const centavos = (texto: string) => Math.round((lerNumero(texto) ?? 0) * 100);
const textoDe = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
const reais = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });


const STATUS_DA_VENDA_TAG: Record<
  "interesse" | "comprometida" | "concluida" | "cancelada",
  { rotulo: string; classe: string }
> = {
  interesse: {
    rotulo: "Interesse",
    classe: "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  comprometida: {
    rotulo: "Comprometida",
    classe: "border-yellow-500/70 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300",
  },
  concluida: {
    rotulo: "Concluída",
    classe: "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-300",
  },
  cancelada: {
    rotulo: "Cancelada",
    classe: "border-gray-400/70 bg-gray-500/10 text-muted-foreground",
  },
};

const BARRAS = {
  blue: "border-l-blue-500",
  purple: "border-l-purple-500",
  orange: "border-l-orange-500",
  green: "border-l-green-500",
  yellow: "border-l-yellow-500",
  gray: "border-l-gray-400",
  pink: "border-l-pink-500",
} as const;

/** Uma fase do popup: cartão com a barra colorida na lateral e o título. */
function Fase({
  titulo,
  cor,
  children,
}: {
  titulo: string;
  cor: keyof typeof BARRAS;
  children: React.ReactNode;
}) {
  return (
    <section className={`grid gap-3 rounded-2xl border border-l-4 bg-card p-4 ${BARRAS[cor]}`}>
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {titulo}
      </h3>
      {children}
    </section>
  );
}

/**
 * A VENDA, do jeito que acontece: um ou mais produtos, a forma de pagamento e as parcelas — cada
 * uma com a data e o valor, marcada como recebida quando cai na conta. O dinheiro só conta no
 * mês em que entra, não o valor cheio. Serve para registrar uma venda nova, editar e, quando o
 * lead é movido para Ganho, para FINALIZAR a venda com os valores reais.
 */
export function DialogoDaVenda({
  venda,
  contatoInicial,
  clientes,
  titulo,
  aoFechar,
  aoSalvar,
  aoApagar,
  negocio,
}: {
  /** Quando a venda é o card de um funil: a etapa (editável) e o atalho para a ficha do lead. */
  negocio?: {
    etapas: Array<{ id: string; nome: string }>;
    etapaId: string | null;
    aoMoverEtapa: (etapaId: string) => Promise<void>;
    fichaHref?: string;
    /** O que era do "negócio": responsável e campos personalizados do funil. */
    responsaveis?: Array<{ id: string; nome: string }>;
    responsavelId?: string | null;
    camposDoFunil?: CustomFieldDef[];
    camposValores?: Record<string, unknown>;
    aoSalvarExtras?: (x: {
      owner_user_id?: string | null;
      custom_fields?: Record<string, unknown>;
    }) => Promise<void>;
  };
  venda: Venda | null;
  contatoInicial?: { contact_id: string; nome: string } | null;
  clientes: ClienteOpcao[];
  titulo?: string;
  aoFechar: () => void;
  /** Devolver `false` = não salvou (a janela fica aberta para corrigir). */
  aoSalvar: (v: DadosDaVenda) => Promise<void | boolean>;
  aoApagar?: () => Promise<void>;
}) {
  const t = useT();
  const fechada = venda ? venda.status === "comprometida" || venda.status === "concluida" : true;
  const [busca, setBusca] = useState("");
  const [contato, setContato] = useState(venda?.contact_id ?? contatoInicial?.contact_id ?? "");
  const [situacao, setSituacao] = useState<
    "interesse" | "comprometida" | "concluida" | "cancelada"
  >(venda ? venda.status : "comprometida");
  // Comprometida e concluída pedem os produtos, o valor e as parcelas.
  const fechadaSit = situacao === "comprometida" || situacao === "concluida";
  const { produtos } = useCatalogoDeProdutos();
  const [itens, setItens] = useState<Array<{ produtoId: string; valor: string }>>(() => {
    if (venda?.itens && venda.itens.length > 0) {
      return venda.itens.map((i) => ({ produtoId: i.product_id, valor: textoDe(i.amount_cents) }));
    }
    return [
      { produtoId: "", valor: venda && venda.amount_cents > 0 ? textoDe(venda.amount_cents) : "" },
    ];
  });
  const [forma, setForma] = useState<string>(venda?.payment_method ?? "pix");
  const [recorrente, setRecorrente] = useState(venda?.is_recurring ?? false);
  const [recorrenciaAtiva, setRecorrenciaAtiva] = useState(venda?.recurrence_active ?? true);
  const [mesesAFrente, setMesesAFrente] = useState(venda?.recurrence_ahead ?? 1);
  // Rascunho da recorrência: só vale (e gera as parcelas) quando clicar em "Aplicar".
  const [mesesRascunho, setMesesRascunho] = useState(venda?.recurrence_ahead ?? 1);
  const [valorRascunho, setValorRascunho] = useState<string | null>(null);
  const [referencia, setReferencia] = useState(venda?.reference ?? "");
  const [notas, setNotas] = useState(venda?.notes ?? "");
  const [previsao, setPrevisao] = useState(venda?.expected_close_date ?? "");
  const [descricao, setDescricao] = useState(venda?.description ?? "");
  const [nomeDaVendaTexto, setNomeDaVendaTexto] = useState(venda?.name ?? "");
  const [etapaId, setEtapaId] = useState(negocio?.etapaId ?? "");
  const responsavelInicial = venda?.responsavel_id ?? negocio?.responsavelId ?? "";
  const [responsavel, setResponsavel] = useState(responsavelInicial);
  // A equipe da empresa: quem pode ser o responsável por esta venda.
  const equipeConsulta = useQuery({
    queryKey: ["team", "assignable", "venda"],
    staleTime: 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: Array<{ user_id: string; full_name: string | null }>;
        }>("/api/v1/team/assignable")
      ).data,
  });
  const equipe = (equipeConsulta.data ?? []).map((p) => ({
    id: p.user_id,
    nome: p.full_name?.trim() || t("Membro da equipe"),
  }));
  // Sem nome dado, a venda se chama pelos produtos (é o que aparece como sugestão no campo).
  const nomesDosProdutos = itens
    .map((it) => produtos.find((p) => p.id === it.produtoId)?.nome ?? "")
    .filter(Boolean)
    .join(" + ");
  const [camposDoNegocio, setCamposDoNegocio] = useState<Record<string, unknown>>(
    negocio?.camposValores ?? {},
  );
  // ── Origem da venda (o mesmo modelo do lead): fonte + campanha → conjunto → anúncio → página ──
  const queryClient = useQueryClient();
  const leadDaVenda = venda?.lead_id ?? null;
  const origemDoCard = useQuery({
    queryKey: ["ficha-do-lead", leadDaVenda],
    enabled: Boolean(leadDaVenda),
    staleTime: 10_000,
    queryFn: async () =>
      (await apiClient.get<{ data: DadosDoLead }>(`/api/v1/leads/${leadDaVenda}/origem`)).data,
  });
  const opcoesDeOrigem = useQuery({
    queryKey: ["origem-opcoes"],
    enabled: Boolean(leadDaVenda),
    staleTime: 60_000,
    queryFn: async () =>
      (
        await apiClient.get<{
          data: { campanhas: CampanhaOpcao[]; posicionamentos: string[]; fontes: string[] };
        }>("/api/v1/marketing/origem-opcoes")
      ).data,
  });
  const origemInicial: ValorDaOrigem | null = origemDoCard.data
    ? valorDaOrigemDoCard(origemDoCard.data)
    : null;
  const [origemEditada, setOrigemEditada] = useState<ValorDaOrigem | null>(null);
  const origemAtual = origemEditada ?? origemInicial;
  const origemMudou =
    origemEditada !== null && JSON.stringify(origemEditada) !== JSON.stringify(origemInicial);

  // Lembrete da venda: vira uma tarefa com data e hora (a de Tarefas avisa na hora certa).
  const [lembreteAtivo, setLembreteAtivo] = useState(false);
  const [lembreteDia, setLembreteDia] = useState("");
  const [lembreteHora, setLembreteHora] = useState("09:00");
  const [tarefaDoLembrete, setTarefaDoLembrete] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState<
    Array<{
      number: number;
      due_on: string;
      valor: string;
      recebida: boolean;
      paid_on: string | null;
    }>
  >(() => {
    const existentes = (venda?.parcelas ?? [])
      .filter((p) => p.status !== "cancelada")
      .map((p) => ({
        number: p.number,
        due_on: p.due_on,
        valor: textoDe(p.amount_cents),
        recebida: p.status === "recebida",
        paid_on: p.paid_on,
      }));
    // Venda marcada como concluída sem parcelas: uma parcela única, já recebida hoje.
    if (existentes.length === 0 && venda?.status === "concluida") {
      return [
        {
          number: 1,
          due_on: hoje(),
          valor: textoDe(venda.amount_cents),
          recebida: true,
          paid_on: hoje(),
        },
      ];
    }
    return existentes;
  });
  const [qtd, setQtd] = useState(String(Math.max(1, venda?.installments ?? 1)));
  const [primeiro, setPrimeiro] = useState(venda?.expected_on ?? hoje());
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const id = venda?.id;
    const cid = venda?.contact_id;
    if (!id || !cid) return;
    let vivo = true;
    void apiClient
      .get<{
        data: { tasks: Array<{ id: string; due_date: string | null; description: string | null }> };
      }>(`/api/v1/tasks?contact_id=${cid}&aberto=true`)
      .then((r) => {
        if (!vivo) return;
        const t = r.data.tasks.find((x) => (x.description ?? "").includes(`[venda:${id}]`));
        if (!t) return;
        setTarefaDoLembrete(t.id);
        setLembreteAtivo(true);
        if (t.due_date) {
          const d = new Date(t.due_date);
          const dois = (n: number) => String(n).padStart(2, "0");
          setLembreteDia(`${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`);
          setLembreteHora(`${dois(d.getHours())}:${dois(d.getMinutes())}`);
        }
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [venda?.id, venda?.contact_id]);

  const total = itens.reduce((s, i) => s + centavos(i.valor), 0);
  const somaParcelas = parcelas.reduce((s, p) => s + centavos(p.valor), 0);
  const diferenca = parcelas.length > 0 ? total - somaParcelas : 0;
  const termo = busca.trim().toLowerCase();
  const sugestoes = useMemo(
    () =>
      termo
        ? clientes
            .filter((c) => `${c.nome} ${c.telefone ?? ""}`.toLowerCase().includes(termo))
            .slice(0, 8)
        : [],
    [clientes, termo],
  );
  const clienteEscolhido =
    clientes.find((c) => c.contact_id === contato) ??
    (contatoInicial && contatoInicial.contact_id === contato
      ? { ...contatoInicial, telefone: null }
      : null);

  /**
   * Trocar o status pela tag. "Concluída" marca todas as parcelas como recebidas (a tela mostra o
   * que vai ser gravado); as outras não mexem nas parcelas.
   */
  function escolherSituacao(v: "interesse" | "comprometida" | "concluida" | "cancelada") {
    setSituacao(v);
    if (v === "concluida") {
      setParcelas((l) =>
        l.map((x) => ({ ...x, recebida: true, paid_on: x.paid_on ?? hoje() })),
      );
    }
  }

  /** Marcar ou desmarcar uma parcela também acerta o status: tudo pago = concluída; faltou uma = comprometida. */
  function marcarParcelaNoFormulario(i: number, recebida: boolean) {
    const proximas = parcelas.map((x, k) =>
      k === i ? { ...x, recebida, paid_on: recebida ? (x.paid_on ?? hoje()) : null } : x,
    );
    setParcelas(proximas);
    // Assinatura em andamento nunca "conclui": sempre vem a parcela do mês seguinte.
    if (recorrente && recorrenciaAtiva) return;
    if (proximas.length > 0 && proximas.every((x) => x.recebida)) {
      if (situacao === "comprometida") setSituacao("concluida");
    } else if (situacao === "concluida") {
      setSituacao("comprometida");
    }
  }

  /** O valor da última parcela (é o que a próxima copia), no formato do campo. */
  const valorMensal = parcelas.length > 0 ? parcelas[parcelas.length - 1]!.valor : "";
  /**
   * APLICAR a recorrência: o valor mensal vale para todas as parcelas ainda não recebidas e as
   * parcelas previstas são geradas (ou aparadas) até `meses` à frente, na hora — a previsão e o
   * LTV previsto já aparecem abaixo, antes de salvar.
   */
  function aplicarRecorrencia() {
    const n = Math.min(12, Math.max(1, mesesRascunho));
    const lido = lerNumero(valorRascunho ?? valorMensal);
    const base = lido !== null && lido >= 0 ? Math.round(lido * 100) : centavos(valorMensal);
    const novo = textoDe(base);
    setMesesAFrente(n);
    setValorRascunho(null);
    setParcelas((l) => {
      const recebidas = l.filter((x) => x.recebida);
      const abertas = l.filter((x) => !x.recebida);
      const manter = abertas.slice(0, n).map((x) => ({ ...x, valor: novo }));
      let ultima =
        manter[manter.length - 1] ??
        recebidas[recebidas.length - 1] ?? {
          number: 0,
          due_on: "",
          valor: novo,
          recebida: false,
          paid_on: null,
        };
      const novas = [...manter];
      for (let k = manter.length; k < n; k += 1) {
        ultima = {
          number: (recebidas.length + novas.length) + 1,
          // Sem nenhuma parcela ainda, a primeira vence na data de início escolhida.
          due_on: ultima.due_on === "" ? primeiro || hoje() : somarMesesNaData(ultima.due_on, 1),
          valor: novo,
          recebida: false,
          paid_on: null,
        };
        novas.push(ultima);
      }
      return [...recebidas, ...novas].map((x, i) => ({ ...x, number: i + 1 }));
    });
  }

  /** O previsto das parcelas abertas e o que já entrou (para o resumo da recorrência). */
  const recebidoCents = parcelas
    .filter((p) => p.recebida)
    .reduce((a2, p) => a2 + centavos(p.valor), 0);
  const previstoCents = parcelas
    .filter((p) => !p.recebida)
    .reduce((a2, p) => a2 + centavos(p.valor), 0);
  const abertasCont = parcelas.filter((p) => !p.recebida).length;

  /** Enter (ou sair do campo) no valor de uma parcela: as seguintes abertas absorvem a diferença. */
  function aplicarValorDaParcela(i: number) {
    // Recorrente: cada mês é uma parcela própria; mudar uma não redistribui nas outras.
    if (recorrente) return;
    const base = parcelas.map((x) => ({
      number: x.number,
      due_on: x.due_on,
      amount_cents: centavos(x.valor),
      recebida: x.recebida,
      paid_on: x.paid_on,
    }));
    const novas = redistribuirAposEditar(base, i, total);
    setParcelas((l) =>
      l.map((x, k) => ({ ...x, valor: textoDe(novas[k]?.amount_cents ?? centavos(x.valor)) })),
    );
  }

  function gerar() {
    const n = Math.max(1, Math.min(120, Math.round(lerNumero(qtd) ?? 1)));
    const lista = gerarParcelas(total, n, primeiro || hoje());
    setParcelas(
      lista.map((p: ParcelaDaVenda) => ({
        number: p.number,
        due_on: p.due_on,
        valor: textoDe(p.amount_cents),
        recebida: false,
        paid_on: null,
      })),
    );
  }

  const itensValidos = itens.filter((i) => i.produtoId !== "");
  const valido =
    contato !== "" &&
    (situacao === "cancelada" || itensValidos.length > 0) &&
    (!fechadaSit || total > 0) &&
    (!lembreteAtivo || lembreteDia !== "");

  /**
   * As parcelas que vão para o servidor: se o total mudou (produto novo, valor novo), elas se
   * ajustam sozinhas — sem parcelas, uma à vista; sem nenhuma recebida, refeitas com o mesmo
   * número; com alguma recebida, a diferença vai para a última ainda aberta.
   */
  function parcelasAjustadas(): typeof parcelas {
    if (!fechadaSit || total <= 0) return parcelas;
    // Venda recorrente: as parcelas (uma por mês, já pagas ou previstas) são o histórico e não
    // se ajustam ao valor da venda.
    if (recorrente) return parcelas;
    return ajustarParcelasAoTotal(
      parcelas.map((p) => ({
        number: p.number,
        due_on: p.due_on,
        amount_cents: centavos(p.valor),
        recebida: p.recebida,
        paid_on: p.paid_on,
      })),
      total,
      primeiro || hoje(),
      hoje(),
    ).map((p) => ({
      number: p.number,
      due_on: p.due_on,
      valor: textoDe(p.amount_cents),
      recebida: p.recebida,
      paid_on: p.paid_on,
    }));
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    // As parcelas vão como estão na tela (o status "concluída" já marcou todas como recebidas).
    const base = parcelasAjustadas();
    const todasRecebidas = base.length > 0 && base.every((p) => p.recebida);
    const pagos = fechadaSit ? base : [];
    const salvou = await aoSalvar({
      ...(venda ? { id: venda.id } : {}),
      contact_id: contato,
      // Faltou uma parcela? Não é "concluída": é comprometida. E tudo pago fecha como concluída.
      status:
        fechadaSit && base.length > 0
          ? todasRecebidas && !(recorrente && recorrenciaAtiva)
            ? "concluida"
            : "comprometida"
          : situacao,
      itens: itensValidos.map((i) => ({
        product_id: i.produtoId,
        quantity: 1,
        amount_cents: centavos(i.valor),
      })),
      pagamentos: pagos.map((p, k) => ({
        number: k + 1,
        due_on: p.due_on,
        paid_on: p.recebida ? (p.paid_on ?? hoje()) : null,
        amount_cents: centavos(p.valor),
        status: p.recebida ? ("recebida" as const) : ("prevista" as const),
      })),
      payment_method: fechadaSit ? forma : "",
      is_recurring: recorrente,
      recurrence_active: recorrente && recorrenciaAtiva,
      // Escolheu os meses e não clicou em Aplicar? Vale a escolha (a rotina diária completa).
      recurrence_ahead: recorrente ? mesesRascunho : mesesAFrente,
      reference: referencia.trim(),
      notes: notas.trim(),
      expected_close_date: previsao || null,
      description: descricao.trim(),
      name: nomeDaVendaTexto.trim(),
      ...(responsavel !== responsavelInicial ? { responsavel_id: responsavel || null } : {}),
    });
    if (salvou === false) {
      setSalvando(false);
      setErro(t("Não consegui salvar a venda. Confira os campos e tente de novo."));
      return;
    }
    // O lembrete: cria, muda a data ou desliga a tarefa.
    try {
      const nome = itensValidos[0] ? (produtos.find((p) => p.id === itensValidos[0]!.produtoId)?.nome ?? "") : "";
      const quando = lembreteDia ? new Date(`${lembreteDia}T${lembreteHora || "09:00"}:00`).toISOString() : null;
      if (lembreteAtivo && quando) {
        if (tarefaDoLembrete) {
          await apiClient.patch(`/api/v1/tasks/${tarefaDoLembrete}`, { due_date: quando, status: "pending" });
        } else {
          await apiClient.post("/api/v1/tasks", {
            title: `${t("Lembrete da venda")}${nome ? `: ${nome}` : ""}`,
            description: `${t("Lembrete da venda")}${venda ? ` [venda:${venda.id}]` : ""}`,
            due_date: quando,
            contact_id: contato,
            lead_id: venda?.lead_id ?? null,
            priority: "medium",
          });
        }
      } else if (!lembreteAtivo && tarefaDoLembrete) {
        await apiClient.patch(`/api/v1/tasks/${tarefaDoLembrete}`, { status: "cancelled" });
      }
    } catch {
      // O lembrete não derruba o salvar da venda.
    }
    if (origemMudou && origemEditada && leadDaVenda) {
      try {
        await apiClient.put(
          `/api/v1/leads/${leadDaVenda}/origem`,
          corpoDaOrigem(origemEditada, opcoesDeOrigem.data?.campanhas ?? []),
        );
        await queryClient.invalidateQueries();
      } catch {
        setSalvando(false);
        setErro(t("A venda foi salva, mas não consegui salvar a origem. Tente de novo."));
        return;
      }
    }
    if (negocio?.aoSalvarExtras) {
      await negocio.aoSalvarExtras({
        ...(negocio.camposDoFunil && negocio.camposDoFunil.length > 0
          ? { custom_fields: camposDoNegocio }
          : {}),
      });
    }
    setSalvando(false);
    aoFechar();
  }

  return (
    <Dialog open onOpenChange={(a) => !a && aoFechar()}>
      <DialogContent className="max-h-[92vh] max-w-3xl gap-4 overflow-y-auto bg-background p-5 sm:rounded-2xl">
        <DialogTitle className="text-base font-semibold">
          {titulo ?? (venda ? t("Editar venda") : t("Nova venda"))}
        </DialogTitle>
        <DialogDescription className="text-sm text-muted-foreground">
          {t(
            "Informe os produtos, o valor real e como o cliente vai pagar. Só entra no mês o que de fato cair na conta.",
          )}
        </DialogDescription>

        <Fase titulo={t("Cliente, funil e status")} cor="blue">
        <div className="grid grid-cols-1 gap-1">
          <span className="text-xs text-muted-foreground">{t("Cliente")}</span>
          {venda || (contatoInicial && contato === contatoInicial.contact_id) ? (
            <p className="text-sm font-medium">
              {venda?.cliente?.nome ?? contatoInicial?.nome ?? "—"}
            </p>
          ) : clienteEscolhido ? (
            <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-sm">
              <span>{clienteEscolhido.nome}</span>
              <button
                type="button"
                className="text-xs text-primary underline"
                onClick={() => setContato("")}
              >
                {t("Trocar")}
              </button>
            </div>
          ) : (
            <>
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={t("Buscar cliente por nome ou telefone")}
                aria-label={t("Buscar cliente")}
                className={CAMPO}
              />
              {sugestoes.length > 0 ? (
                <ul className="grid grid-cols-1 gap-1 rounded-xl border p-1">
                  {sugestoes.map((c) => (
                    <li key={c.contact_id}>
                      <button
                        type="button"
                        onClick={() => setContato(c.contact_id)}
                        className="flex w-full justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary"
                      >
                        <span className="truncate">{c.nome}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{c.telefone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>


          <div className="grid gap-3 sm:grid-cols-2">
            {venda?.funil ? (
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">{t("Funil")}</span>
                <p className="flex h-10 items-center rounded-xl border bg-secondary/40 px-3 text-sm font-medium">
                  {venda.funil}
                </p>
              </div>
            ) : null}
            {negocio ? (
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">{t("Status no funil")}</span>
                <select
                  className={CAMPO}
                  value={etapaId}
                  onChange={(e) => {
                    setEtapaId(e.target.value);
                    if (e.target.value) void negocio.aoMoverEtapa(e.target.value);
                  }}
                >
                  {negocio.etapas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">{t("Status da venda")}</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={`inline-flex h-10 w-fit items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-medium ${STATUS_DA_VENDA_TAG[situacao].classe}`}
                  >
                    {t(STATUS_DA_VENDA_TAG[situacao].rotulo)}
                    <CaretDown size={12} weight="bold" aria-hidden />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="grid w-56 gap-1.5 p-2">
                  {(["interesse", "comprometida", "concluida", "cancelada"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => escolherSituacao(v)}
                      className={`rounded-full border-[1.5px] px-3 py-1.5 text-left text-sm font-medium ${STATUS_DA_VENDA_TAG[v].classe} ${
                        v === situacao ? "ring-2 ring-primary/40" : ""
                      }`}
                    >
                      {t(STATUS_DA_VENDA_TAG[v].rotulo)}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </Fase>

        {/* O NEGÓCIO da venda: previsão, descrição e campos do funil. */}
        <Fase titulo={t("Negócio")} cor="purple">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs text-muted-foreground">{t("Nome da venda")}</span>
              <input
                value={nomeDaVendaTexto}
                maxLength={120}
                onChange={(e) => setNomeDaVendaTexto(e.target.value)}
                placeholder={nomesDosProdutos || t("Ex.: Plano anual — Maria")}
                className="h-10 w-full min-w-0 rounded-xl border bg-background px-3 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">{t("Previsão de fechamento")}</span>
              <CampoDeData
                valor={previsao}
                aoMudar={setPrevisao}
                rotulo={t("Previsão de fechamento")}
                className="w-full"
              />
            </div>
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">{t("Responsável")}</span>
              <select
                className={CAMPO}
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                aria-label={t("Responsável pela venda")}
              >
                <option value="">{t("Sem responsável")}</option>
                {equipe.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <label className="grid gap-1 sm:col-span-2">
              <span className="text-xs text-muted-foreground">{t("Descrição da venda")}</span>
              <textarea
                rows={2}
                maxLength={2000}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder={t("Contexto desta negociação…")}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-hidden focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </label>
            {negocio?.camposDoFunil && negocio.camposDoFunil.length > 0 ? (
              <div className="grid gap-1 sm:col-span-2">
                <span className="text-xs text-muted-foreground">{t("Campos do funil")}</span>
                <CustomFieldsEditor
                  fields={negocio.camposDoFunil}
                  value={camposDoNegocio}
                  onChange={setCamposDoNegocio}
                  mode="lead"
                />
              </div>
            ) : null}
            {negocio?.fichaHref ? (
              <Link
                href={negocio.fichaHref}
                className="text-xs font-medium text-primary hover:underline sm:col-span-2"
              >
                {t("Abrir a ficha do lead (cadastro, atendimento, linha do tempo)")}
              </Link>
            ) : null}
          </div>
        </Fase>

        <Fase titulo={t("Produtos e serviços")} cor="orange">
          {itens.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2">
              <select
                value={it.produtoId}
                onChange={(e) => {
                  const p = produtos.find((x) => x.id === e.target.value);
                  setItens((l) =>
                    l.map((x, k) =>
                      k === i
                        ? {
                            ...x,
                            produtoId: e.target.value,
                            // O preço de tabela entra de partida; pode mudar (desconto, negociação).
                            valor:
                              x.valor === "" && p && p.valor > 0
                                ? textoDe(Math.round(p.valor * 100))
                                : x.valor,
                          }
                        : x,
                    ),
                  );
                }}
                aria-label={`${t("Produto")} ${i + 1}`}
                className={CAMPO}
              >
                <option value="">{t("Escolha o produto cadastrado")}</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <input
                value={it.valor}
                inputMode="decimal"
                onChange={(e) =>
                  setItens((l) =>
                    l.map((x, k) =>
                      k === i ? { ...x, valor: e.target.value.replace(/[^\d.,]/g, "") } : x,
                    ),
                  )
                }
                placeholder="R$ 0,00"
                aria-label={`${t("Valor")} ${i + 1}`}
                className={CAMPO}
              />
              <button
                type="button"
                aria-label={t("Tirar item")}
                disabled={itens.length === 1}
                onClick={() => setItens((l) => l.filter((_, k) => k !== i))}
                className="grid h-9 w-9 grid-cols-1 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-error-fg disabled:opacity-30"
              >
                <Trash size={14} aria-hidden />
              </button>
            </div>
          ))}
          {produtos.length === 0 ? (
            <p className="rounded-lg bg-warning-bg px-3 py-2 text-xs text-warning-fg">
              {t(
                "Nenhum produto cadastrado ainda. Cadastre em Marketing › Produtos e ofertas: toda venda é de um produto do catálogo.",
              )}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setItens((l) => [...l, { produtoId: "", valor: "" }])}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium hover:bg-secondary"
            >
              <Plus size={14} weight="bold" aria-hidden />
              {t("Vendeu mais alguma coisa?")}
            </button>
            <p className="text-sm">
              {recorrente && parcelas.length > 0
                ? t("Total (soma das parcelas)")
                : t("Total")}
              :{" "}
              <strong className="tabular-nums">
                {reais(
                  recorrente && parcelas.length > 0
                    ? parcelas.reduce((a2, p) => a2 + centavos(p.valor), 0)
                    : total,
                )}
              </strong>
            </p>
          </div>
        </Fase>

        {fechadaSit ? (
          <Fase titulo={t("Pagamento")} cor="green">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="grid grid-cols-1 gap-1">
                <span className="text-xs text-muted-foreground">{t("Forma de pagamento")}</span>
                <select
                  value={forma}
                  onChange={(e) => {
                    setForma(e.target.value);
                    if (e.target.value === "recorrencia") setRecorrente(true);
                  }}
                  className={CAMPO}
                >
                  {FORMAS_DE_PAGAMENTO.map((f) => (
                    <option key={f} value={f}>
                      {rotuloDaForma(t, f)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid grid-cols-1 gap-1">
                <span className="text-xs text-muted-foreground">{t("Número de parcelas")}</span>
                <input
                  value={qtd}
                  inputMode="numeric"
                  onChange={(e) => setQtd(e.target.value.replace(/\D/g, ""))}
                  className={CAMPO}
                />
              </label>
              <label className="grid grid-cols-1 gap-1">
                <span className="text-xs text-muted-foreground">{t("Primeira parcela em")}</span>
                <CampoDeData
                  valor={primeiro}
                  aoMudar={setPrimeiro}
                  rotulo={t("Primeira parcela em")}
                  className="w-full"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={gerar}
                disabled={total <= 0 || (recorrente && parcelas.some((p) => p.recebida))}
                title={
                  recorrente && parcelas.some((p) => p.recebida)
                    ? t("Venda recorrente com parcelas recebidas: o histórico não é refeito.")
                    : undefined
                }
                className="h-9 rounded-lg border px-3 text-sm font-medium hover:bg-secondary disabled:opacity-50"
              >
                {parcelas.length > 0 ? t("Refazer as parcelas") : t("Gerar as parcelas")}
              </button>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recorrente}
                  onChange={(e) => setRecorrente(e.target.checked)}
                />
                {t("Recorrente (mensalidade, assinatura)")}
              </label>
            </div>
            {recorrente ? (
              <div
                className={`grid gap-2 rounded-xl border border-l-4 px-3 py-3 text-sm ${
                  recorrenciaAtiva
                    ? "border-l-emerald-500 bg-emerald-500/5"
                    : "border-l-slate-400 bg-secondary/50"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {recorrenciaAtiva ? t("Recorrência ativa") : t("Recorrência encerrada")}
                  </span>
                  {recorrenciaAtiva ? (
                    <button
                      type="button"
                      onClick={() => {
                        // Encerra: o histórico recebido fica; as parcelas ainda previstas saem.
                        setRecorrenciaAtiva(false);
                        setParcelas((l) => l.filter((p) => p.recebida));
                      }}
                      className="h-8 rounded-lg border border-red-500/50 bg-red-500/10 px-3 text-xs font-medium text-red-700 hover:bg-red-500/20 dark:text-red-300"
                    >
                      {t("Encerrar recorrência")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRecorrenciaAtiva(true)}
                      className="h-8 rounded-lg border px-3 text-xs font-medium hover:bg-secondary"
                    >
                      {t("Reativar recorrência")}
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {recorrenciaAtiva
                    ? t(
                        "Todo mês o sistema cria a próxima parcela como prevista e avisa na véspera, no dia e no dia seguinte para você confirmar se o lead pagou e se o valor mudou. Nada é dado como pago sozinho.",
                      )
                    : t(
                        "Encerrada: a venda e as parcelas já recebidas ficam no histórico (e no LTV). Nenhuma parcela nova é criada nem cobrada.",
                      )}
                </p>
                {recorrenciaAtiva ? (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="grid gap-1">
                        <span className="text-xs text-muted-foreground">
                          {t("Manter quantos meses de previsão à frente")}
                        </span>
                        <select
                          value={mesesRascunho}
                          aria-label={t("Meses à frente")}
                          onChange={(e) => setMesesRascunho(Number(e.target.value))}
                          className={CAMPO}
                        >
                          {Array.from({ length: 12 }, (_, k) => k + 1).map((n) => (
                            <option key={n} value={n}>
                              {n === 1 ? t("1 mês (a próxima parcela)") : `${n} ${t("meses")}`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1">
                        <span className="text-xs text-muted-foreground">
                          {t("Valor mensal")}
                        </span>
                        <input
                          value={valorRascunho ?? valorMensal}
                          inputMode="decimal"
                          aria-label={t("Valor mensal")}
                          onChange={(e) => setValorRascunho(e.target.value.replace(/[^\d.,]/g, ""))}
                          onKeyDown={(e) => e.key === "Enter" && aplicarRecorrencia()}
                          className={CAMPO}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={aplicarRecorrencia}
                      className="h-10 w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 sm:w-fit"
                    >
                      {t("Aplicar e gerar as parcelas")}
                    </button>
                    {mesesRascunho !== mesesAFrente || valorRascunho !== null ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {t("Mudou os meses ou o valor? Clique em Aplicar para ver as parcelas e a previsão.")}
                      </p>
                    ) : null}
                    <p className="rounded-lg bg-background/70 px-3 py-2 text-xs">
                      <strong className="tabular-nums">{reais(previstoCents)}</strong>{" "}
                      {t("previstos")} ({abertasCont}{" "}
                      {abertasCont === 1 ? t("parcela") : t("parcelas")}) ·{" "}
                      {t("LTV previsto")}{" "}
                      <strong className="tabular-nums">{reais(recebidoCents + previstoCents)}</strong>
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}

            {parcelas.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-max text-sm">
                  <thead className="bg-secondary/60 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">#</th>
                      <th className="px-3 py-2 text-left font-medium">{t("Vence em")}</th>
                      <th className="px-3 py-2 text-right font-medium">{t("Valor")}</th>
                      <th className="px-3 py-2 text-center font-medium">{t("Já recebida")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcelas.map((p, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1 tabular-nums">{i + 1}</td>
                        <td className="px-2 py-1">
                          <CampoDeData
                            valor={p.due_on}
                            rotulo={`${t("Vencimento da parcela")} ${i + 1}`}
                            aoMudar={(dia) =>
                              setParcelas((l) =>
                                l.map((x, k) => (k === i ? { ...x, due_on: dia } : x)),
                              )
                            }
                            className="h-9"
                          />
                        </td>
                        <td className="px-2 py-1 text-right">
                          <input
                            value={p.valor}
                            inputMode="decimal"
                            aria-label={`${t("Valor da parcela")} ${i + 1}`}
                            onChange={(e) =>
                              setParcelas((l) =>
                                l.map((x, k) =>
                                  k === i
                                    ? { ...x, valor: e.target.value.replace(/[^\d.,]/g, "") }
                                    : x,
                                ),
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                aplicarValorDaParcela(i);
                              }
                            }}
                            onBlur={() => aplicarValorDaParcela(i)}
                            className="h-9 w-28 rounded-lg border bg-background px-2 text-right text-sm tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-1 text-center">
                          <CirculoDeRecebida
                            className="mx-auto size-6"
                            marcado={p.recebida}
                            rotulo={`${t("Parcela recebida")} ${i + 1}`}
                            aoMudar={(v) => marcarParcelaNoFormulario(i, v)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("Gere as parcelas para registrar quando cada uma cai na conta.")}
              </p>
            )}
            {parcelas.length > 0 && Math.abs(diferenca) > 1 ? (
              <p
                role="alert"
                className="rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-fg"
              >
                {t("A soma das parcelas difere do total em")} {reais(Math.abs(diferenca))}.{" "}
                {t("As parcelas serão ajustadas ao total ao salvar.")}
              </p>
            ) : null}
          </Fase>
        ) : null}

        <Fase titulo={t("Detalhes")} cor="gray">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid grid-cols-1 gap-1">
              <span className="text-xs text-muted-foreground">
                {t("Referência (ex.: Mensalidade 03/2026)")}
              </span>
              <input
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className={CAMPO}
              />
            </label>
            <label className="grid grid-cols-1 gap-1">
              <span className="text-xs text-muted-foreground">{t("Observações")}</span>
              <textarea
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              />
            </label>
            {venda ? (
              <dl className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:col-span-2 sm:grid-cols-3">
                <div>
                  <dt className="uppercase">{t("Criada em")}</dt>
                  <dd className="text-sm text-foreground">
                    {venda.created_at ? venda.created_at.slice(0, 10).split("-").reverse().join("/") : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase">{t("Fechada em")}</dt>
                  <dd className="text-sm text-foreground">
                    {venda.closed_on ? venda.closed_on.slice(0, 10).split("-").reverse().join("/") : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="uppercase">{t("Último pagamento")}</dt>
                  <dd className="text-sm text-foreground">
                    {venda.paid_on ? venda.paid_on.slice(0, 10).split("-").reverse().join("/") : "—"}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
        </Fase>

        <Fase titulo={t("Lembrete")} cor="yellow">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={lembreteAtivo}
              onChange={(e) => setLembreteAtivo(e.target.checked)}
            />
            {t("Ativar um lembrete para esta venda")}
          </label>
          {lembreteAtivo ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">{t("Data")}</span>
                <CampoDeData
                  valor={lembreteDia}
                  aoMudar={setLembreteDia}
                  rotulo={t("Data do lembrete")}
                  limpavel={false}
                  className="w-full"
                />
              </div>
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">{t("Hora")}</span>
                <input
                  type="time"
                  value={lembreteHora}
                  onChange={(e) => setLembreteHora(e.target.value)}
                  className={CAMPO}
                />
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {t("Vira uma tarefa com este dia e hora, ligada ao lead — ela aparece em Tarefas e avisa na hora.")}
              </p>
            </div>
          ) : null}
        </Fase>

        {leadDaVenda ? (
          <Fase titulo={t("Origem")} cor="pink">
            {origemAtual ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "De onde veio esta venda. É isto que leva o valor para a análise de landing pages e criativos.",
                  )}
                </p>
                <OrigemEmCascata
                  valor={origemAtual}
                  aoMudar={setOrigemEditada}
                  campanhas={opcoesDeOrigem.data?.campanhas ?? []}
                  posicionamentos={opcoesDeOrigem.data?.posicionamentos ?? []}
                  fontes={opcoesDeOrigem.data?.fontes ?? []}
                  carregando={opcoesDeOrigem.isLoading}
                />
              </>
            ) : (
              <div className="h-16 animate-pulse rounded-lg bg-secondary" />
            )}
          </Fase>
        ) : null}

        {erro ? (
          <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
            {erro}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-between gap-2 pt-1">
          {aoApagar && venda ? (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(t("Apagar esta venda? Os totais do cliente serão recalculados."))
                ) {
                  void aoApagar().then(aoFechar);
                }
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium text-error-fg hover:bg-error-bg"
            >
              <Trash size={14} aria-hidden />
              {t("Apagar")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={aoFechar}
              className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-secondary"
            >
              {fechada && venda?.needs_details ? t("Detalhar depois") : t("Cancelar")}
            </button>
            <button
              type="button"
              disabled={!valido || salvando}
              onClick={() => void salvar()}
              className="h-10 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {salvando ? t("Salvando…") : t("Salvar venda")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
