import type { Bloco } from "@/lib/marketing/blocos";
import { lerNumero, moeda } from "@/lib/marketing/calculadora";

export type Oferta = Extract<Bloco, { tipo: "oferta" }>;

export const ROTULO_DA_ETAPA: Record<Oferta["etapa"], string> = {
  isca: "Isca",
  entrada: "Produto de entrada",
  principal: "Produto principal",
  expansao: "Expansão",
  recorrencia: "Recorrência",
};

const ROTULO_DO_PRECO: Record<Oferta["preco"]["tipo"], string> = {
  unico: "Pagamento único",
  mensal: "Mensal",
  "setup-mensal": "Setup + mensalidade",
  "sob-consulta": "Sob consulta",
  gratuito: "Gratuito",
};

/** A soma dos valores de referência (entregáveis + bônus); null se nenhum valor foi informado. */
export function valorTotalDaOferta(o: Oferta): number | null {
  const valores = [...o.entregaveis, ...o.bonus]
    .map((i) => lerNumero(i.valor))
    .filter((v): v is number => v !== null);
  return valores.length > 0 ? valores.reduce((a, b) => a + b, 0) : null;
}

export function precoEmTexto(o: Oferta): string {
  const { tipo, valor, setup } = o.preco;
  if (tipo === "sob-consulta") return "Sob consulta";
  if (tipo === "gratuito") return "Gratuito";
  if (tipo === "setup-mensal") {
    return [setup && `Setup ${setup}`, valor && `${valor}/mês`].filter(Boolean).join(" + ") || "—";
  }
  if (tipo === "mensal") return valor ? `${valor}/mês` : "—";
  return valor || "—";
}

const lista = (itens: string[]) =>
  itens
    .filter((i) => i.trim() !== "")
    .map((i) => `- ${i}`)
    .join("\n");

/**
 * A oferta em TEXTO ESTRUTURADO para a IA (atendimento e estratégia): fatos curtos e
 * aprovados, na mesma ordem sempre. A garantia sai com o texto exato, entre aspas, para quem
 * responde citar sem parafrasear.
 */
export function ofertaParaTexto(titulo: string, o: Oferta): string {
  const partes: string[] = [];
  const bloco = (rotulo: string, corpo: string) => {
    if (corpo.trim() !== "") partes.push(`${rotulo}:\n${corpo.trim()}`);
  };
  partes.push(`OFERTA: ${titulo}`);
  bloco(
    "Etapa na escada de valor",
    ROTULO_DA_ETAPA[o.etapa] + (o.carroChefe ? " (carro-chefe)" : ""),
  );
  bloco("O que é", o.resumo);
  bloco("Para quem é", o.paraQuem);
  bloco("Para quem NÃO é", o.naoEParaQuem);
  bloco("O que inclui", lista(o.inclui));
  bloco("O que NÃO inclui", lista(o.naoInclui));
  bloco("Prazo de entrega", o.prazo);
  bloco(
    "Preço",
    `${ROTULO_DO_PRECO[o.preco.tipo]}: ${precoEmTexto(o)}` +
      (o.preco.condicoes ? `\nCondições: ${o.preco.condicoes}` : ""),
  );
  if (o.nivel === "completa") {
    bloco("Promessa", o.promessa);
    bloco(
      "Entregáveis",
      o.entregaveis
        .filter((e) => e.nome.trim() !== "")
        .map(
          (e) => `- ${e.nome}${e.valor ? ` (valor de referência ${e.valor})` : ""}: ${e.descricao}`,
        )
        .join("\n"),
    );
    bloco(
      "Bônus",
      o.bonus
        .filter((e) => e.nome.trim() !== "")
        .map(
          (e) => `- ${e.nome}${e.valor ? ` (valor de referência ${e.valor})` : ""}: ${e.descricao}`,
        )
        .join("\n"),
    );
    const total = valorTotalDaOferta(o);
    if (total !== null) bloco("Valor total de referência (não é o preço)", moeda(total));
    bloco("Custo de não fazer nada", o.custoDaInacao);
    if (o.garantia.trim() !== "") {
      bloco("Garantia (citar exatamente este texto, sem parafrasear)", `"${o.garantia.trim()}"`);
    }
    bloco("Escassez", o.escassez);
    bloco(
      "Objeções e respostas aprovadas",
      o.objecoes
        .filter((x) => x.objecao.trim() !== "")
        .map((x) => `- Objeção: ${x.objecao}\n  Resposta: ${x.resposta}`)
        .join("\n"),
    );
  }
  bloco(
    "Perguntas frequentes",
    o.faq
      .filter((x) => x.pergunta.trim() !== "")
      .map((x) => `- P: ${x.pergunta}\n  R: ${x.resposta}`)
      .join("\n"),
  );
  bloco("NUNCA prometer", lista(o.nuncaPrometer));
  return partes.join("\n\n");
}

/** A oferta de uma página (o primeiro bloco `oferta`), ou null. */
export function ofertaDosBlocos(blocos: readonly Bloco[]): Oferta | null {
  const achado = blocos.find((b): b is Oferta => b.tipo === "oferta");
  return achado ?? null;
}

/**
 * O preço que o catálogo guarda, em centavos: a mensalidade (ou o valor único). Sob consulta e
 * gratuito viram 0 — o texto da oferta, que a IA lê, diz o que isso significa.
 */
export function precoEmCentavos(o: Oferta): number {
  if (o.preco.tipo === "sob-consulta" || o.preco.tipo === "gratuito") return 0;
  const valor = lerNumero(o.preco.valor);
  return valor === null ? 0 : Math.round(valor * 100);
}

/** O código estável do produto no catálogo, derivado da chave da página. */
export function codigoDaOferta(chaveDaPagina: string): string {
  return `OFERTA-${chaveDaPagina.split("--").slice(1).join("-").toUpperCase()}`.slice(0, 60);
}

export interface LinhaDoCatalogo {
  codigo: string;
  nome: string;
  descricao: string;
  categoria: string;
  preco_cents: number;
}

/**
 * Como uma oferta PUBLICADA vira linha do catálogo que a IA consulta. A oferta é a única fonte:
 * o cliente cadastra uma vez, aqui, e o catálogo (preço, descrição, nome) é derivado.
 */
export function linhaDoCatalogo(chaveDaPagina: string, titulo: string, o: Oferta): LinhaDoCatalogo {
  return {
    codigo: codigoDaOferta(chaveDaPagina),
    nome: titulo.trim() || "Oferta",
    descricao: ofertaParaTexto(titulo.trim() || "Oferta", o),
    categoria: ROTULO_DA_ETAPA[o.etapa],
    preco_cents: precoEmCentavos(o),
  };
}
