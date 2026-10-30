import { BASE_DA_COR } from "@/lib/motor/cores";
import { CORES_DA_OPCAO, type CorDaOpcao } from "@/lib/tarefas/opcoes-de-status";

/**
 * A COR DA ETAPA DO FUNIL — uma só régua para toda tela que mostra a etapa como tag ou como opção.
 *
 * A cor mora em `crm_stages.color` (hex, escolhida ao montar o funil). Aqui ela volta a ser um dos
 * nomes da paleta (`CorDaOpcao`), que é o que as etiquetas e os seletores entendem. Etapa sem cor
 * gravada (funil antigo) recebe a padrão do nome e do papel: ganho verde, perda vermelha, "Novo
 * lead" cinza — a mesma tabela que semeia os modelos de funil.
 */
export interface EtapaComCor {
  name?: string | null;
  color?: string | null;
  is_won?: boolean | null;
  is_lost?: boolean | null;
}

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();

const PADRAO_POR_NOME: Record<string, CorDaOpcao> = {
  "novo lead": "gray",
  abordagem: "yellow",
  "em contato": "yellow",
  contato: "yellow",
  qualificado: "purple",
  "contato com decisor": "purple",
  "reuniao agendada": "blue",
  "reuniao realizada": "purple",
  "proposta enviada": "orange",
  "em negociacao": "orange",
  desqualificado: "brown",
  comprou: "green",
  "venda realizada": "green",
  "nao comprou": "red",
  perdido: "red",
};

/** A cor que a etapa tem quando ninguém escolheu uma. */
export function corPadraoDaEtapa(e: EtapaComCor): CorDaOpcao {
  if (e.is_won) return "green";
  if (e.is_lost) return "red";
  return PADRAO_POR_NOME[normalizar(e.name ?? "")] ?? "blue";
}

const POR_HEX = new Map<string, CorDaOpcao>(
  CORES_DA_OPCAO.map((c) => [BASE_DA_COR[c].toLowerCase(), c]),
);

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** A cor (nome da paleta) com que a etapa aparece em qualquer tag ou seletor. */
export function corDaEtapa(e: EtapaComCor): CorDaOpcao {
  const hex = e.color?.toLowerCase();
  if (hex && /^#[0-9a-f]{6}$/.test(hex)) {
    const exata = POR_HEX.get(hex);
    if (exata) return exata;
    // Um hex fora da paleta (funil antigo): a cor da paleta mais próxima.
    const [r, g, b] = rgb(hex);
    let melhor: CorDaOpcao = "gray";
    let menor = Infinity;
    for (const c of CORES_DA_OPCAO) {
      const [r2, g2, b2] = rgb(BASE_DA_COR[c]);
      const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
      if (d < menor) {
        menor = d;
        melhor = c;
      }
    }
    return melhor;
  }
  return corPadraoDaEtapa(e);
}

/** O hex que se grava em `crm_stages.color` para uma cor da paleta. */
export const hexDaCor = (c: CorDaOpcao): string => BASE_DA_COR[c];

/** O hex padrão de uma etapa (o que os modelos de funil gravam ao nascer). */
export const hexPadraoDaEtapa = (e: EtapaComCor): string => hexDaCor(corPadraoDaEtapa(e));
