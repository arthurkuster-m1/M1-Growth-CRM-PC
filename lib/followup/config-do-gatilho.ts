/**
 * Os gatilhos por TEMPO e por DATA só funcionam com os parâmetros que o relógio lê (`dias`, direção do
 * silêncio, funil e campo). A rota das regras já os exige na criação; o fluxo de automação os exige na
 * publicação — senão ficaria ativo e o relógio nunca o dispararia (`lib/automation/regras-de-relogio.ts`).
 * Os demais eventos não têm parâmetro: sempre completos.
 */
import {
  GATILHO_DE_DATA_DO_FUNIL,
  configDoGatilhoDeData,
} from "@/lib/automation/gatilho-de-data-do-funil";
import {
  GATILHO_ETAPA_PARADA,
  GATILHO_SILENCIO,
  configDaEtapaParada,
  configDoSilencio,
} from "@/lib/automation/gatilhos-de-tempo";

export function configDoGatilhoEstaCompleta(params: {
  event_type: string;
  config?: unknown;
}): boolean {
  switch (params.event_type) {
    case GATILHO_SILENCIO:
      return configDoSilencio(params.config) !== null;
    case GATILHO_ETAPA_PARADA:
      return configDaEtapaParada(params.config) !== null;
    case GATILHO_DE_DATA_DO_FUNIL:
      return configDoGatilhoDeData(params.config) !== null;
    default:
      return true;
  }
}
