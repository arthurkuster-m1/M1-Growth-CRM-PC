/**
 * O RETORNO AO GUIA: quem sai do Guia para fazer um passo (abrir a tela da configuração) chega lá
 * com o botão "Voltar" já apontando de volta — o mecanismo de atalhos do produto
 * (`lib/navigation/voltar.ts` + `BotaoVoltar` no AppShell), sem banner novo. Ao voltar, o Guia
 * relê o diagnóstico e o passo aparece feito, se foi feito.
 */
import { comVoltar } from "@/lib/navigation/voltar";

export const ABAS_DO_GUIA = ["guia", "plano", "ideias", "dossie"] as const;
export type AbaDoGuia = (typeof ABAS_DO_GUIA)[number];

/** A aba pedida no endereço (`?aba=plano`); qualquer outra coisa abre a primeira. */
export const abaDoGuia = (valor: string | null | undefined): AbaDoGuia =>
  (ABAS_DO_GUIA as readonly string[]).includes(valor ?? "") ? (valor as AbaDoGuia) : "guia";

const ROTULO_DA_ABA: Record<AbaDoGuia, string> = {
  guia: "Guia",
  plano: "Plano do Guia",
  ideias: "Ideias do Guia",
  dossie: "Dossiê do Guia",
};

/** O endereço de um passo (ou de uma ideia) com o "Voltar" para a aba do Guia de onde a pessoa saiu. */
export function comRetornoAoGuia(href: string, aba: AbaDoGuia = "guia"): string {
  return comVoltar(href, {
    href: aba === "guia" ? "/app/guia" : `/app/guia?aba=${aba}`,
    rotulo: ROTULO_DA_ABA[aba],
  });
}
