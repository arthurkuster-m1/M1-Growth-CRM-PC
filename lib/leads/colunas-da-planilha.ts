/**
 * AS COLUNAS da planilha de leads — o vocabulário puro (sem servidor), compartilhado entre a
 * leitura no servidor (`planilha.ts`) e o popup de importar do CRM, que roda no navegador.
 */

/**
 * Como cada coluna pode vir escrita. A primeira forma é a que a gente sugere.
 * As de espanhol (`nombre`, `teléfono`, `correo`…) cumprem o que a tela promete
 * a quem a usa nesse idioma; a comparação tira acento e caixa dos dois lados.
 */
export const COLUNAS: Record<string, readonly string[]> = {
  titulo: [
    "nome", "titulo", "título", "lead", "negocio", "negócio", "oportunidade", "empresa", "assunto",
    "nombre", "oportunidad", "asunto",
  ],
  contato: [
    "nome do contato", "contato", "responsavel", "responsável", "pessoa",
    "nombre del contacto", "contacto", "responsable", "persona",
  ],
  telefone: ["telefone", "celular", "whatsapp", "fone", "phone", "telefono", "movil"],
  email: ["email", "e-mail", "correo", "correo electronico"],
  descricao: [
    "descricao", "descrição", "observacao", "observação", "observacoes", "observações", "notas", "detalhes",
    "descripcion", "observacion", "observaciones", "detalles",
  ],
  valor: [
    "valor",
    "valor da venda",
    "valor total",
    "valor do negocio",
    "valor do negócio",
    "preco",
    "preço",
    "ticket",
    "value",
    "precio",
    "importe",
    "monto",
  ],
  origem: ["origem", "fonte", "canal", "source", "origen", "fuente"],
  etiquetas: ["tags", "tag", "etiquetas", "marcadores"],
  link_instagram: ["instagram", "insta", "ig", "link instagram", "link do instagram"],
  link_site: ["site", "website", "sitio web", "link site", "link do site"],
  link_google_meu_negocio: ["google meu negocio", "google meu negócio", "google my business", "link google meu negocio"],
  link_facebook: ["facebook", "face", "link facebook", "link do facebook"],
  link_linkedin: ["linkedin", "link linkedin", "link do linkedin"],
  link_tiktok: ["tiktok", "tik tok", "link tiktok", "link do tiktok"],
  link_youtube: ["youtube", "you tube", "link youtube", "link do youtube"],
  link_outro: ["outro link", "link outro"],
  etapa: ["etapa", "fase", "stage", "etapa do funil"],
  funil: ["funil", "pipeline", "funnel", "embudo"],
  campanha: ["campanha", "campaign", "campaña"],
  conjunto: ["conjunto", "conjunto de anuncios", "conjunto de anúncios", "adset", "ad set"],
  anuncio: ["anuncio", "anúncio", "criativo", "ad", "creative", "creativo"],
  landing_page: ["landing page", "landing", "lp", "pagina de captura", "página de captura", "pagina"],
  posicionamento: ["posicionamento", "placement", "posicion", "posición"],
  produto: ["produto", "servico", "serviço", "product", "producto"],
  status_da_venda: [
    "status da venda",
    "situacao da venda",
    "situação da venda",
    "status de venda",
    "estado de la venta",
  ],
  nascimento: [
    "nascimento",
    "data de nascimento",
    "aniversario",
    "aniversário",
    "birthdate",
    "fecha de nacimiento",
  ],
  previsao: [
    "previsao de fechamento", "fechamento previsto", "previsao", "data prevista", "expected close",
    "previsión de cierre", "cierre previsto",
  ],
};

export function normalizarCabecalho(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function campoDaColuna(cabecalho: string): string | null {
  const alvo = normalizarCabecalho(cabecalho);
  for (const [campo, formas] of Object.entries(COLUNAS)) {
    if (formas.some((f) => normalizarCabecalho(f) === alvo)) return campo;
  }
  return null;
}

