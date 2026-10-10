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
        descricao: t(
          "A central de tudo o que a empresa vende: da ficha simples à oferta completa.",
        ),
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

/** O nome de cada TIPO de subpágina (e a descrição curta que aparece no cartão). */
export function textosDoTipoDeSubpagina(
  t: Traduz,
  tipo: string,
): { titulo: string; descricao: string } | null {
  switch (tipo) {
    case "pesquisa-de-mercado":
      return {
        titulo: t("Pesquisa de público e mercado"),
        descricao: t("O setor, o processo comercial e os principais desafios."),
      };
    case "persona":
      return {
        titulo: t("Persona"),
        descricao: t("O dossiê de um cliente ideal: dores, desejos, objeções e consciência."),
      };
    case "arvore-de-situacoes":
      return {
        titulo: t("Árvore de situações incômodas"),
        descricao: t("A jornada, a linha de ouro e as situações do dia a dia que causam a dor."),
      };
    case "arquitetura-de-premissas":
      return {
        titulo: t("Arquitetura de premissas"),
        descricao: t("A premissa persuasiva e a desconstrução das crenças do cliente."),
      };
    case "porques":
      return {
        titulo: t("Porquês (brainstorming)"),
        descricao: t("Os motivos que levam alguém a comprar, e as palavras que filtram o público."),
      };
    case "oferta":
      return {
        titulo: t("Oferta"),
        descricao: t(
          "Um produto ou uma oferta: o que é, para quem, o que inclui, preço e garantia.",
        ),
      };
    case "perguntas-chave":
      return {
        titulo: t("Perguntas-chave"),
        descricao: t(
          "As perguntas que guiam a análise: quem são, o que fazem e onde somos melhores.",
        ),
      };
    case "concorrente":
      return {
        titulo: t("Concorrente"),
        descricao: t(
          "A análise de um concorrente: promessa, anúncios, página, dados e oportunidades.",
        ),
      };
    default:
      return null;
  }
}
