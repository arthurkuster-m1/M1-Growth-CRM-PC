/**
 * Parsing do inbound de captação: field_map → lead normalizado + HMAC.
 * Sem I/O — puro, testável. A rota (webhooks/in/[token]) faz o resto.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { canonicalPhoneBR } from "@/lib/channels/phone-variants";

export interface FieldMap {
  name?: string[];
  phone?: string[];
  email?: string[];
}

const DEFAULT_FIELD_MAP: Required<FieldMap> = {
  name: ["name", "nome", "full_name", "fullname"],
  phone: ["phone", "telefone", "whatsapp", "celular", "phone_number", "tel"],
  email: ["email", "e-mail", "mail"],
};

/**
 * Chaves que a PLATAFORMA do formulário põe no envio e que não são resposta de
 * ninguém. O JetFormBuilder manda `__refer`, `__form_id` e `__is_ajax` junto com
 * os campos do formulário (medido num envio real, 2026-09-30); o WordPress
 * acrescenta nonce e referer. Entrando em `custom_fields`, apareciam no card do
 * lead como se a pessoa as tivesse preenchido.
 *
 * Lista NOMEADA, e não "tudo que começa com `_`": um formulário próprio pode ter
 * um campo legítimo chamado `_origem`, e descartá-lo em silêncio seria perder
 * dado de cliente. Só cai o que é conhecidamente da plataforma.
 */
export const CHAVES_DE_PLATAFORMA = new Set([
  "__refer",
  "__form_id",
  "__is_ajax",
  "__queried_post_id",
  "_wpnonce",
  "_wp_http_referer",
  "_jet_engine_refer",
  "_jet_engine_booking_form_id",
  "jfb_preview_nonce",
  "_jfb_current_render_states",
  "_jfb_current_render_states[]",
]);

export interface MappedLead {
  name: string | null;
  phone: string | null;
  email: string | null;
  custom_fields: Record<string, string>;
  source_metadata: Record<string, string>;
}

/** Normaliza telefone BR para E.164 com o nono dígito no celular. */
export function normalizePhoneBR(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  let e164: string | null = null;
  if (raw.trim().startsWith("+")) {
    e164 = /^\d{8,15}$/.test(digits) ? `+${digits}` : null;
  } else if (digits.length === 12 || digits.length === 13) {
    e164 = digits.startsWith("55") ? `+${digits}` : null;
  } else if (digits.length === 10 || digits.length === 11) {
    e164 = `+55${digits}`;
  }
  return e164 ? canonicalPhoneBR(e164) : null;
}

const MAXIMO_DE_CAMPOS = 150;
const PROFUNDIDADE_MAXIMA = 4;

/**
 * Achata o payload em `chave → texto`. Quem integra (n8n, Zapier, formulário próprio) manda
 * objetos aninhados — `{ lead: { nome }, respostas: { orcamento }, utm: { campaign } }` — e as
 * perguntas mudam de um funil para outro, então NADA que seja dado se perde:
 *   - objeto vira `pai_filho` (até 4 níveis);
 *   - lista de textos/números vira "a, b, c"; lista de objetos vira um JSON curto;
 *   - `null`, vazio e funções são ignorados.
 * As chaves de topo continuam iguais às de antes (quem já integra não muda nada).
 */
export function achatarPayload(payload: Record<string, unknown>): Record<string, string> {
  const saida: Record<string, string> = {};
  const poe = (chave: string, valor: string) => {
    if (valor.trim() === "" || Object.keys(saida).length >= MAXIMO_DE_CAMPOS) return;
    saida[chave.slice(0, 80)] = valor.slice(0, 2000);
  };
  const visita = (valor: unknown, chave: string, nivel: number) => {
    if (valor === null || valor === undefined) return;
    if (typeof valor === "string") return poe(chave, valor);
    if (typeof valor === "number" || typeof valor === "boolean") return poe(chave, String(valor));
    if (Array.isArray(valor)) {
      const simples = valor.every((v) => ["string", "number", "boolean"].includes(typeof v));
      if (simples) return poe(chave, valor.map(String).join(", "));
      return poe(chave, JSON.stringify(valor).slice(0, 1000));
    }
    if (typeof valor === "object" && nivel < PROFUNDIDADE_MAXIMA) {
      for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
        visita(v, chave ? `${chave}_${k}` : k, nivel + 1);
      }
    }
  };
  for (const [k, v] of Object.entries(payload)) visita(v, k, 1);
  return saida;
}

/**
 * Pais que costumam embrulhar os dados da PESSOA (`{ lead: { nome, telefone } }`). Só dentro
 * deles um campo aninhado vale como nome, telefone ou e-mail — `form_name` (nome do formulário) e
 * `empresa_name` não podem virar o nome do lead.
 */
const PAIS_DA_PESSOA = [
  "lead",
  "leads",
  "contato",
  "contact",
  "cliente",
  "customer",
  "pessoa",
  "person",
  "user",
  "usuario",
  "dados",
  "data",
  "body",
  "payload",
  "fields",
  "campos",
];

/** O valor de uma chave; ou, aninhada só em pais da pessoa, `lead_telefone` casa com `telefone`. */
export function valorPorChave(
  campos: Record<string, string>,
  aliases: string[],
): { key: string; value: string } | null {
  const baixas = new Map(Object.keys(campos).map((k) => [k.toLowerCase(), k]));
  for (const alias of aliases) {
    const key = baixas.get(alias.toLowerCase());
    if (key !== undefined && campos[key]!.trim()) return { key, value: campos[key]!.trim() };
  }
  const semPais = (baixa: string): string => {
    let resto = baixa;
    for (let mudou = true; mudou;) {
      mudou = false;
      for (const pai of PAIS_DA_PESSOA) {
        if (resto.startsWith(`${pai}_`)) {
          resto = resto.slice(pai.length + 1);
          mudou = true;
        }
      }
    }
    return resto;
  };
  for (const [baixa, key] of baixas) {
    if (!campos[key]!.trim()) continue;
    const resto = semPais(baixa);
    if (resto !== baixa && aliases.some((a) => a.toLowerCase() === resto)) {
      return { key, value: campos[key]!.trim() };
    }
  }
  return null;
}

export function mapInboundPayload(
  payload: Record<string, unknown>,
  fieldMap: FieldMap = {},
): MappedLead {
  const map: Required<FieldMap> = {
    name: [...(fieldMap.name ?? []), ...DEFAULT_FIELD_MAP.name],
    phone: [...(fieldMap.phone ?? []), ...DEFAULT_FIELD_MAP.phone],
    email: [...(fieldMap.email ?? []), ...DEFAULT_FIELD_MAP.email],
  };

  const achatado = achatarPayload(payload);
  const nameHit = valorPorChave(achatado, map.name);
  const phoneHit = valorPorChave(achatado, map.phone);
  const emailHit = valorPorChave(achatado, map.email);
  const consumed = new Set([nameHit?.key, phoneHit?.key, emailHit?.key].filter(Boolean));

  const custom_fields: Record<string, string> = {};
  const source_metadata: Record<string, string> = {};
  for (const [key, str] of Object.entries(achatado)) {
    if (consumed.has(key) || CHAVES_DE_PLATAFORMA.has(key)) continue;
    const baixa = key.toLowerCase();
    // UTM de topo (`utm_campaign`) ou aninhada (`utm_campaign` dentro de `tracking`, ou
    // `{ utm: { campaign } }`): sempre guardada como `utm_<nome>`.
    const dentroDeUtm = baixa.match(/(?:^|_)utm_([a-z0-9]+)$/) ?? baixa.match(/^utm_([a-z0-9]+)$/);
    const objetoUtm = baixa.match(/^utm_([a-z0-9]+)$/) ? null : baixa.match(/^utm_(.+)$/);
    if (dentroDeUtm) source_metadata[`utm_${dentroDeUtm[1]}`] = str;
    else if (objetoUtm) source_metadata[`utm_${objetoUtm[1]}`] = str;
    else custom_fields[key] = str;
  }

  return {
    name: nameHit?.value ?? null,
    phone: normalizePhoneBR(phoneHit?.value),
    email: emailHit?.value ?? null,
    custom_fields,
    source_metadata,
  };
}

/** HMAC SHA-256 hex do raw body. Header: X-Deskcomm-Signature. */
export function verifyInboundSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(header, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
