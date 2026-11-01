/**
 * A regra de automação CONTADA EM PASSOS, para a visão de fluxo da Central: Gatilho → Se… → Ação 1 → Ação 2.
 * Só descreve (não executa nada e não muda a regra): é a mesma regra do editor, vista como linha do tempo.
 */
export interface PassoDaRegra {
  tipo: "gatilho" | "condicao" | "acao";
  titulo: string;
  detalhe?: string;
}

interface RegraParaPassos {
  trigger_event: string;
  conditions: ReadonlyArray<{ field: string; op: "eq" | "neq" | "contains"; value: string }>;
  actions: ReadonlyArray<{ type: string; config: Record<string, unknown> }>;
  trigger_config?: Record<string, unknown> | null;
}

const CAMPOS: Record<string, string> = {
  "lead.title": "Nome do lead",
  "lead.tags": "Tags do lead",
  "contact.tags": "Tags do contato",
  "contact.name": "Nome do contato",
  "event.body_preview": "Texto da mensagem",
  "conversation.inbound_count": "Nº da mensagem do cliente",
  "event.event_type_name": "Tipo de atendimento",
  "lead.source_metadata.utm_source": "Origem",
  "lead.source_metadata.utm_campaign": "Campanha",
  "lead.source_metadata.utm_adset": "Conjunto",
  "lead.source_metadata.utm_ad": "Anúncio",
  "lead.source_metadata.utm_placement": "Posicionamento",
};
const OPS = { eq: "é", neq: "não é", contains: "contém" } as const;

const texto = (v: unknown): string => (typeof v === "string" ? v : "");
const numero = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function corta(s: string, n = 90): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** O que o gatilho de TEMPO acrescenta ("2 dias", "24 horas"). */
function detalheDoGatilho(r: RegraParaPassos): string | undefined {
  const c = r.trigger_config ?? {};
  const dias = numero(c.dias);
  if (dias === null) return undefined;
  return `${dias} ${c.unidade === "horas" ? (dias === 1 ? "hora" : "horas") : dias === 1 ? "dia" : "dias"}`;
}

function detalheDaAcao(a: RegraParaPassos["actions"][number]): string | undefined {
  const c = a.config ?? {};
  switch (a.type) {
    case "add_tag":
      return Array.isArray(c.tags)
        ? c.tags.filter((t) => typeof t === "string").join(", ")
        : undefined;
    case "create_task": {
      const dias = numero(c.vence_em_dias);
      const prazo =
        dias === null
          ? ""
          : dias === 0
            ? " · vence no mesmo dia"
            : ` · vence em ${dias} ${dias === 1 ? "dia" : "dias"}`;
      return corta(texto(c.titulo)) + prazo;
    }
    case "send_whatsapp_message":
      return corta(texto(c.template));
    case "call_webhook": {
      try {
        return new URL(texto(c.url)).host;
      } catch {
        return undefined;
      }
    }
    default:
      return undefined;
  }
}

export function passosDaRegra(
  r: RegraParaPassos,
  rotulos: { gatilho: (id: string) => string; acao: (id: string) => string },
): PassoDaRegra[] {
  const passos: PassoDaRegra[] = [
    { tipo: "gatilho", titulo: rotulos.gatilho(r.trigger_event), detalhe: detalheDoGatilho(r) },
  ];
  for (const c of r.conditions) {
    passos.push({
      tipo: "condicao",
      titulo: `Só se ${CAMPOS[c.field] ?? c.field} ${OPS[c.op]} “${corta(c.value, 60)}”`,
    });
  }
  for (const a of r.actions) {
    passos.push({ tipo: "acao", titulo: rotulos.acao(a.type), detalhe: detalheDaAcao(a) });
  }
  return passos;
}
