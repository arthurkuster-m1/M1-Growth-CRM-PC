import { phoneLookupVariants } from "@/lib/channels/phone-variants";

import type { WahaClient } from "./client";

/**
 * O número TEM WhatsApp? Três respostas, e a terceira importa:
 *
 *  - `tem`: alguma grafia do número existe no WhatsApp;
 *  - `nao_tem`: todas as grafias foram consultadas e NENHUMA existe;
 *  - `incerto`: a consulta falhou (rede, sessão fora do ar) e nenhuma grafia confirmou — não se
 *    pode dizer que NÃO tem, então a empresa não é descartada por isso.
 *
 * O Brasil tem duas grafias do mesmo celular (com e sem o nono dígito); `phoneLookupVariants` as
 * dá, e basta uma existir.
 */
export type ResultadoDoWhatsapp = "tem" | "nao_tem" | "incerto";

export async function verificarNumeroNoWhatsapp(
  client: Pick<WahaClient, "checkContactExists">,
  sessao: string,
  telefone: string,
): Promise<ResultadoDoWhatsapp> {
  const vistas = new Set<string>();
  let falhou = false;
  for (const variante of phoneLookupVariants(telefone)) {
    const digitos = variante.replace(/\D/g, "");
    if (!digitos || vistas.has(digitos)) continue;
    vistas.add(digitos);
    try {
      if ((await client.checkContactExists(sessao, digitos)).numberExists) return "tem";
    } catch {
      falhou = true;
    }
  }
  if (vistas.size === 0) return "incerto";
  return falhou ? "incerto" : "nao_tem";
}
