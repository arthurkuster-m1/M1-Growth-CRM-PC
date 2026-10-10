import type { FaseDaEstrategia } from "@/lib/marketing/modulos";

/**
 * Os TEXTOS das telas de Marketing. Ficam num lugar só (e passam por `t()`, com espanhol no
 * dicionário) porque o hub, a galeria e a página de cada módulo mostram os mesmos nomes — e
 * `t()` só aceita texto literal, então um `switch` é o jeito de ligar a chave ao texto.
 */
type Traduz = (texto: string) => string;

export function nomeDaFase(t: Traduz, fase: FaseDaEstrategia): string {
  switch (fase) {
    case "diagnostico":
      return t("01 | Diagnóstico");
    case "produto-e-oferta":
      return t("02 | Produto e Oferta");
    case "geracao-de-demanda":
      return t("03 | Geração de Demanda");
  }
}

export function textosDoModulo(
  t: Traduz,
  chave: string,
): { titulo: string; descricao: string } | null {
  switch (chave) {
    case "mapeamento-do-funil":
      return {
        titulo: t("Mapeamento do funil atual"),
        descricao: t("Onde a empresa está hoje: o funil, o processo de vendas e as oportunidades."),
      };
    case "posicionamento-zmot":
      return {
        titulo: t("Posicionamento"),
        descricao: t("Onde a marca aparece online hoje: links e imagens de cada canal."),
      };
    case "identidade-da-marca":
      return {
        titulo: t("Branding"),
        descricao: t("Logo, cores, fontes e tom de voz da marca."),
      };
    case "estudo-de-persona":
      return {
        titulo: t("Estudo de persona"),
        descricao: t("Quem é o cliente ideal: dores, desejos e objeções."),
      };
    case "analise-de-concorrencia":
      return {
        titulo: t("Análise de concorrência"),
        descricao: t("Quem disputa a atenção do seu cliente, e como."),
      };
    case "planejamento-empresarial":
      return {
        titulo: t("Planejamento empresarial"),
        descricao: t("Metas, números e o caminho do negócio."),
      };
    case "produtos-e-ofertas":
      return {
        titulo: t("Produtos e ofertas"),
        descricao: t("O que é vendido, por quanto e com qual promessa."),
      };
    case "lead-magnets":
      return {
        titulo: t("Lead magnets"),
        descricao: t("Iscas digitais que atraem e qualificam contatos."),
      };
    case "estrategia-de-marketing":
      return {
        titulo: t("Estratégia de marketing"),
        descricao: t("A ideia e a estratégia por trás das campanhas."),
      };
    case "trafego-pago":
      return {
        titulo: t("Tráfego pago"),
        descricao: t("Campanhas, criativos e textos que estão ativos."),
      };
    case "outbound-marketing":
      return {
        titulo: t("Outbound marketing"),
        descricao: t("Prospecção ativa: abordar quem ainda não conhece a marca."),
      };
    case "programas-de-indicacao":
      return {
        titulo: t("Programas de indicação"),
        descricao: t("Clientes que trazem novos clientes."),
      };
    case "social-media":
      return {
        titulo: t("Social media"),
        descricao: t("Presença e conteúdo nas redes sociais."),
      };
    case "parcerias-e-influenciadores":
      return {
        titulo: t("Parcerias e influenciadores"),
        descricao: t("Quem fala da marca para a audiência certa."),
      };
    default:
      return null;
  }
}
