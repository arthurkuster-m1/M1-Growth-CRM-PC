import { ETAPAS_DA_OFERTA, TIPOS_DE_PRECO, type Bloco } from "@/lib/marketing/blocos";
import { semAcento } from "@/lib/marketing/produtos-csv";

/**
 * A OFERTA (o produto) em texto estruturado: o bloco `::: oferta` da página de Marketing. Uma
 * linha por campo, `campo | valor`; as listas põem cada item numa coluna e os campos repetidos
 * (entregável, bônus, objeção, pergunta) repetem a linha. Campo vazio não aparece.
 *
 *   ::: oferta
 *   nivel | completa                 (simples ou completa)
 *   etapa | principal                (isca, entrada, principal, expansao, recorrencia)
 *   carro-chefe | sim
 *   resumo | Anúncios no Meta e no Google com relatório mensal
 *   para quem | Clínicas com ticket acima de R$ 500
 *   nao e para quem | …
 *   inclui | Criativos | Relatório mensal
 *   nao inclui | …
 *   prazo | Contrato de 3 meses
 *   tipo de preco | setup + mensal   (unico, mensal, setup + mensal, sob consulta, gratuito)
 *   preco | R$ 1.500,00
 *   setup | R$ 500,00
 *   condicoes | Pix ou cartão
 *   promessa | …   custo da inacao | …   garantia | …   escassez | …
 *   nunca prometer | … | …
 *   entregavel | nome | descrição | valor        bonus | nome | descrição | valor
 *   objecao | objeção | resposta                 faq | pergunta | resposta
 *   cartao resumo | sim
 *   :::
 *
 * As imagens do produto não cabem em texto: ficam de fora (e são contadas, para a tela avisar).
 */
type Oferta = Extract<Bloco, { tipo: "oferta" }>;

const escapar = (s: string) =>
  s
    .replace(/\r?\n+/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
const linha = (...cols: string[]) => cols.map(escapar).join(" | ");

const TIPO_EM_TEXTO: Record<Oferta["preco"]["tipo"], string> = {
  unico: "unico",
  mensal: "mensal",
  "setup-mensal": "setup + mensal",
  "sob-consulta": "sob consulta",
  gratuito: "gratuito",
};

/** As linhas do bloco `::: oferta` (sem o `:::` de abrir e fechar). */
export function linhasDaOferta(o: Oferta): string[] {
  const saida: string[] = [];
  const campo = (rotulo: string, valor: string) => {
    if (valor.trim() !== "") saida.push(linha(rotulo, valor));
  };
  const lista = (rotulo: string, itens: string[]) => {
    const cheios = itens.filter((i) => i.trim() !== "");
    if (cheios.length > 0) saida.push(linha(rotulo, ...cheios));
  };
  campo("nivel", o.nivel);
  campo("etapa", o.etapa);
  if (o.carroChefe) campo("carro-chefe", "sim");
  campo("resumo", o.resumo);
  campo("para quem", o.paraQuem);
  campo("nao e para quem", o.naoEParaQuem);
  lista("inclui", o.inclui);
  lista("nao inclui", o.naoInclui);
  campo("prazo", o.prazo);
  campo("tipo de preco", TIPO_EM_TEXTO[o.preco.tipo]);
  campo("preco", o.preco.valor);
  campo("setup", o.preco.setup);
  campo("condicoes", o.preco.condicoes);
  campo("promessa", o.promessa);
  campo("custo da inacao", o.custoDaInacao);
  campo("garantia", o.garantia);
  campo("escassez", o.escassez);
  lista("nunca prometer", o.nuncaPrometer);
  for (const e of o.entregaveis) {
    if (e.nome.trim() !== "") saida.push(linha("entregavel", e.nome, e.descricao, e.valor));
  }
  for (const e of o.bonus) {
    if (e.nome.trim() !== "") saida.push(linha("bonus", e.nome, e.descricao, e.valor));
  }
  for (const x of o.objecoes) {
    if (x.objecao.trim() !== "") saida.push(linha("objecao", x.objecao, x.resposta));
  }
  for (const f of o.faq) {
    if (f.pergunta.trim() !== "") saida.push(linha("faq", f.pergunta, f.resposta));
  }
  if (o.cartaoResumo) campo("cartao resumo", "sim");
  return saida;
}

const SIM = new Set(["sim", "s", "x", "1", "true", "verdadeiro", "yes"]);

/**
 * O contrário: as linhas (já divididas em colunas) do bloco `::: oferta` viram o dado da oferta,
 * pronto para o `blocoSchema` validar. Campo desconhecido é erro, para ninguém perder texto em
 * silêncio por escrever o nome errado.
 */
export function ofertaDeLinhas(
  linhas: string[][],
  id: string,
): { candidato: Record<string, unknown>; erros: string[] } {
  const erros: string[] = [];
  const o = {
    id,
    tipo: "oferta" as const,
    nivel: "simples",
    etapa: "principal",
    carroChefe: false,
    resumo: "",
    paraQuem: "",
    naoEParaQuem: "",
    inclui: [""] as string[],
    naoInclui: [] as string[],
    prazo: "",
    preco: { tipo: "sob-consulta", valor: "", setup: "", condicoes: "" },
    faq: [] as Array<{ pergunta: string; resposta: string }>,
    nuncaPrometer: [] as string[],
    promessa: "",
    entregaveis: [] as Array<{ nome: string; descricao: string; valor: string }>,
    bonus: [] as Array<{ nome: string; descricao: string; valor: string }>,
    custoDaInacao: "",
    garantia: "",
    escassez: "",
    objecoes: [] as Array<{ objecao: string; resposta: string }>,
    cartaoResumo: undefined as boolean | undefined,
  };
  let tipoDePrecoDito = false;

  for (const [rotuloBruto = "", ...v] of linhas) {
    const rotulo = semAcento(rotuloBruto).replace(/[\s_-]+/g, " ");
    const primeiro = v[0] ?? "";
    switch (rotulo) {
      case "nivel":
        if (semAcento(primeiro) === "completa" || semAcento(primeiro) === "simples") {
          o.nivel = semAcento(primeiro);
        } else erros.push(`nivel: use simples ou completa (veio "${primeiro}")`);
        break;
      case "etapa": {
        const e = semAcento(primeiro);
        if ((ETAPAS_DA_OFERTA as readonly string[]).includes(e)) o.etapa = e;
        else erros.push(`etapa: use ${ETAPAS_DA_OFERTA.join(", ")} (veio "${primeiro}")`);
        break;
      }
      case "carro chefe":
        o.carroChefe = SIM.has(semAcento(primeiro));
        break;
      case "resumo":
        o.resumo = primeiro;
        break;
      case "para quem":
        o.paraQuem = primeiro;
        break;
      case "nao e para quem":
        o.naoEParaQuem = primeiro;
        break;
      case "inclui":
        o.inclui = v.filter((i) => i !== "");
        if (o.inclui.length === 0) o.inclui = [""];
        break;
      case "nao inclui":
        o.naoInclui = v.filter((i) => i !== "");
        break;
      case "prazo":
        o.prazo = primeiro;
        break;
      case "tipo de preco": {
        const t = semAcento(primeiro)
          .replace(/\s*\+\s*/g, "-")
          .replace(/\s+/g, "-");
        const tipo = t === "setup-e-mensal" ? "setup-mensal" : t;
        if ((TIPOS_DE_PRECO as readonly string[]).includes(tipo)) {
          o.preco.tipo = tipo;
          tipoDePrecoDito = true;
        } else {
          erros.push(
            `tipo de preco: use unico, mensal, setup + mensal, sob consulta ou gratuito (veio "${primeiro}")`,
          );
        }
        break;
      }
      case "preco":
        o.preco.valor = primeiro;
        break;
      case "setup":
        o.preco.setup = primeiro;
        break;
      case "condicoes":
        o.preco.condicoes = primeiro;
        break;
      case "promessa":
        o.promessa = primeiro;
        break;
      case "custo da inacao":
        o.custoDaInacao = primeiro;
        break;
      case "garantia":
        o.garantia = primeiro;
        break;
      case "escassez":
        o.escassez = primeiro;
        break;
      case "nunca prometer":
        o.nuncaPrometer = v.filter((i) => i !== "");
        break;
      case "entregavel":
        o.entregaveis.push({ nome: v[0] ?? "", descricao: v[1] ?? "", valor: v[2] ?? "" });
        break;
      case "bonus":
        o.bonus.push({ nome: v[0] ?? "", descricao: v[1] ?? "", valor: v[2] ?? "" });
        break;
      case "objecao":
        o.objecoes.push({ objecao: v[0] ?? "", resposta: v[1] ?? "" });
        break;
      case "faq":
        o.faq.push({ pergunta: v[0] ?? "", resposta: v[1] ?? "" });
        break;
      case "cartao resumo":
        o.cartaoResumo = SIM.has(semAcento(primeiro));
        break;
      default:
        erros.push(`campo desconhecido na oferta: "${rotuloBruto}"`);
    }
  }
  // Sem tipo de preço dito: com valor é pagamento único; sem valor, sob consulta (como na planilha).
  if (!tipoDePrecoDito && o.preco.valor.trim() !== "") o.preco.tipo = "unico";
  if (o.cartaoResumo === undefined) delete (o as { cartaoResumo?: boolean }).cartaoResumo;
  return { candidato: o, erros };
}
