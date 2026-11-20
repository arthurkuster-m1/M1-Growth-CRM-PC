/**
 * A SONDA DE COBRANÇAS da plataforma de anúncios da Meta — SOMENTE LEITURA.
 *
 * Pergunta que ela responde, com o token JÁ SALVO da empresa: "dá para ler o que foi cobrado no
 * cartão (valor com imposto, data, cobrança recusada) pela API, ou só o gasto das campanhas?".
 * Nada aqui grava no banco nem muda nada na conta de anúncio; o resultado é mostrado CRU a quem
 * administra, para decidir o desenho das Finanças (docs/PLANO-FINANCAS-M1.md, seção 5) com dado
 * real e não com suposição.
 *
 * O que se tenta (cada chamada é independente: uma que falha não derruba as outras):
 *  1. `permissoes`   — o que o token realmente tem (`/me/permissions`).
 *  2. `conta`        — estado da conta (`account_status`, motivo de bloqueio, saldo, moeda).
 *  3. `forma_de_pagamento` — `funding_source_details` (cartão/forma que a Meta cobra).
 *  4. `atividades`   — o histórico de atividades da conta, onde a plataforma registra cobrança,
 *                      recusa, estorno e troca de forma de pagamento.
 *  5. `transacoes`   — a lista de transações de cobrança da conta (se a conta/versão expõe).
 *  6. `faturas`      — faturas mensais do Business Manager (só existem para faturamento mensal).
 *
 * Campo ou aresta que a versão da Graph não aceita volta como erro 100 só daquela chamada, e o
 * motivo CRU da plataforma vai junto: é ele que diz se o conserto é permissão, token ou desenho.
 * O token vai no HEADER, nunca na URL.
 */
import { logger } from "@/lib/logger";

import { classificarErroGraph, montarUrl } from "./insights";
import type { FalhaDeLeitura } from "../types";

const TEMPO_LIMITE_MS = 20_000;
/** Teto de páginas por aresta: a sonda olha uma amostra, não o histórico inteiro (cota é escassa). */
const MAXIMO_DE_PAGINAS = 3;
/** Teto de itens devolvidos por chamada: a tela é para ler, não para despejar. */
const MAXIMO_DE_ITENS = 60;

export type ChamadaDaSonda =
  | {
      ok: true;
      /** Objeto único ou lista (cortada em `MAXIMO_DE_ITENS`). */
      dados: unknown;
      total?: number;
      cortado?: boolean;
    }
  | { ok: false; falha: FalhaDeLeitura; detalhe: string; codigo: number | null };

export interface ResultadoDaSonda {
  conta: string;
  periodo: { de: string; ate: string };
  chamadas: Record<string, ChamadaDaSonda>;
  /** Contagem de atividades por tipo de evento — mostra de relance se há tipos de cobrança. */
  tiposDeAtividade: Record<string, number>;
  /** As atividades cujo tipo parece de cobrança/pagamento (pelo nome do tipo). */
  atividadesDeCobranca: unknown[];
}

const PADRAO_DE_COBRANCA =
  /billing|charge|payment|funding|refund|decline|invoice|chargeback|spend_limit/i;

type RespostaCrua = {
  data?: unknown[];
  paging?: { next?: string };
  error?: { code?: number; message?: string };
};

async function ler(
  url: string,
  token: string,
  contexto: string,
): Promise<
  | { ok: true; json: RespostaCrua & Record<string, unknown> }
  | Extract<ChamadaDaSonda, { ok: false }>
> {
  let resposta: Response;
  try {
    resposta = await fetch(url, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch (erro) {
    return {
      ok: false,
      falha: "transitorio",
      detalhe: erro instanceof Error ? erro.message : "falha de rede",
      codigo: null,
    };
  }
  const texto = await resposta.text().catch(() => "");
  let json: (RespostaCrua & Record<string, unknown>) | null = null;
  try {
    json = JSON.parse(texto) as RespostaCrua & Record<string, unknown>;
  } catch {
    // corpo não-JSON: gateway no meio
  }
  if (!resposta.ok || json?.error) {
    const codigo = typeof json?.error?.code === "number" ? json.error.code : null;
    const mensagem = json?.error?.message ?? texto.slice(0, 400);
    logger.warn("[ads.meta.cobrancas] leitura recusada", {
      contexto,
      status: resposta.status,
      codigo,
    });
    return {
      ok: false,
      falha: classificarErroGraph(resposta.status, codigo, mensagem),
      detalhe: mensagem,
      codigo,
    };
  }
  if (!json)
    return {
      ok: false,
      falha: "transitorio",
      detalhe: "resposta ilegível da plataforma",
      codigo: null,
    };
  return { ok: true, json };
}

/** Um objeto único (a conta, por exemplo). */
async function lerObjeto(url: string, token: string, contexto: string): Promise<ChamadaDaSonda> {
  const r = await ler(url, token, contexto);
  return r.ok ? { ok: true, dados: r.json } : r;
}

/** Uma aresta (lista), seguindo `paging.next` até `MAXIMO_DE_PAGINAS`. */
async function lerLista(
  urlInicial: string,
  token: string,
  contexto: string,
): Promise<ChamadaDaSonda & { itens?: unknown[] }> {
  const itens: unknown[] = [];
  let url: string | null = urlInicial;
  let paginas = 0;
  let temMais = false;
  while (url && paginas < MAXIMO_DE_PAGINAS) {
    paginas += 1;
    const r = await ler(url, token, contexto);
    if (!r.ok)
      return itens.length > 0
        ? {
            ok: true,
            dados: itens.slice(0, MAXIMO_DE_ITENS),
            total: itens.length,
            cortado: true,
            itens,
          }
        : r;
    itens.push(...(r.json.data ?? []));
    url = r.json.paging?.next ?? null;
    if (url && paginas >= MAXIMO_DE_PAGINAS) temMais = true;
  }
  return {
    ok: true,
    dados: itens.slice(0, MAXIMO_DE_ITENS),
    total: itens.length,
    cortado: itens.length > MAXIMO_DE_ITENS || temMais,
    itens,
  };
}

const comPrefixo = (conta: string) => (conta.startsWith("act_") ? conta : `act_${conta}`);

export async function sondarCobrancas(
  token: string,
  contaId: string,
  de: string,
  ate: string,
): Promise<ResultadoDaSonda> {
  const conta = comPrefixo(contaId);
  const chamadas: Record<string, ChamadaDaSonda> = {};

  // 1. O que o token tem.
  chamadas.permissoes = await lerLista(
    montarUrl("me/permissions", { limit: "100" }),
    token,
    "permissoes",
  );

  // 2. Estado da conta (campos básicos que existem há muito tempo).
  const contaLida = await lerObjeto(
    montarUrl(conta, {
      fields:
        "id,name,account_status,disable_reason,currency,balance,amount_spent,timezone_name,business{id,name}",
    }),
    token,
    "conta",
  );
  chamadas.conta = contaLida;

  // 3. A forma de pagamento: separada, porque pode exigir permissão a mais e derrubaria a chamada 2.
  chamadas.forma_de_pagamento = await lerObjeto(
    montarUrl(conta, { fields: "funding_source_details,min_billing_threshold,spend_cap" }),
    token,
    "forma_de_pagamento",
  );

  // 4. As atividades da conta no período.
  const desdeSegundos = Math.floor(new Date(`${de}T00:00:00-03:00`).getTime() / 1000);
  const ateSegundos = Math.floor(new Date(`${ate}T23:59:59-03:00`).getTime() / 1000);
  const atividades = await lerLista(
    montarUrl(`${conta}/activities`, {
      fields:
        "event_type,translated_event_type,event_time,object_id,object_name,object_type,extra_data,actor_name",
      since: String(desdeSegundos),
      until: String(ateSegundos),
      limit: "100",
    }),
    token,
    "atividades",
  );
  const tiposDeAtividade: Record<string, number> = {};
  const atividadesDeCobranca: unknown[] = [];
  if (atividades.ok && atividades.itens) {
    for (const item of atividades.itens as Array<{ event_type?: string }>) {
      const tipo = item.event_type ?? "(sem tipo)";
      tiposDeAtividade[tipo] = (tiposDeAtividade[tipo] ?? 0) + 1;
      if (PADRAO_DE_COBRANCA.test(tipo) && atividadesDeCobranca.length < MAXIMO_DE_ITENS) {
        atividadesDeCobranca.push(item);
      }
    }
  }
  // O resumo acima já tem o que importa; a lista crua completa só atrapalha a leitura.
  chamadas.atividades = atividades.ok
    ? {
        ok: true,
        dados: `${atividades.total ?? 0} atividade(s) lida(s) (ver "tiposDeAtividade" e "atividadesDeCobranca")`,
        total: atividades.total,
        cortado: atividades.cortado,
      }
    : atividades;

  // 5. As transações de cobrança da conta (a aresta pode não existir nesta versão/conta).
  const transacoes = await lerLista(
    montarUrl(`${conta}/transactions`, { limit: "25" }),
    token,
    "transacoes",
  );
  chamadas.transacoes = transacoes.ok
    ? { ok: true, dados: transacoes.dados, total: transacoes.total, cortado: transacoes.cortado }
    : transacoes;

  // 6. Faturas mensais do Business Manager (só quando a conta pertence a um).
  const negocio =
    contaLida.ok &&
    typeof (contaLida.dados as { business?: { id?: string } }).business?.id === "string"
      ? (contaLida.dados as { business: { id: string } }).business.id
      : null;
  if (negocio) {
    const faturas = await lerLista(
      montarUrl(`${negocio}/business_invoices`, { start_date: de, end_date: ate, limit: "25" }),
      token,
      "faturas",
    );
    chamadas.faturas = faturas.ok
      ? { ok: true, dados: faturas.dados, total: faturas.total, cortado: faturas.cortado }
      : faturas;
  } else {
    chamadas.faturas = {
      ok: false,
      falha: "campo_invalido",
      detalhe: "A conta não informou um Business Manager dono; faturas mensais não consultadas.",
      codigo: null,
    };
  }

  return { conta, periodo: { de, ate }, chamadas, tiposDeAtividade, atividadesDeCobranca };
}
