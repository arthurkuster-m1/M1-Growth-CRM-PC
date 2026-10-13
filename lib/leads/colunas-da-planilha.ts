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
  valor: ["valor", "preco", "preço", "ticket", "value", "precio", "importe", "monto"],
  origem: ["origem", "fonte", "canal", "source", "origen", "fuente"],
  etiquetas: ["tags", "etiquetas", "marcadores"],
  etapa: ["etapa", "fase", "stage", "etapa do funil"],
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

