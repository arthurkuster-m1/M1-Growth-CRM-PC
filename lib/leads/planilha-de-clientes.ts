/**
 * A PLANILHA DE CLIENTES (leads): da lista que a empresa já tem para dentro do CRM.
 *
 * Um LEAD é a PESSOA. Só precisa de nome e de telefone ou e-mail — e pode ficar guardado sem
 * funil e sem venda (base de contatos, lista para uma campanha futura). Tudo o mais é opcional:
 * origem, funil, etapa, produto, valor, status e previsão da venda, descrição, etiquetas,
 * nascimento e qualquer coluna a mais (vira campo personalizado do lead).
 *
 * Regra: o lead pode existir sem venda, mas não existe dentro de um funil sem uma venda atrelada
 * (o banco cria a venda de interesse de todo card).
 *
 * Puro: recebe as células já separadas (a 1ª linha é o cabeçalho) e devolve as linhas lidas.
 */
import { normalizaData, normalizaTelefone } from "@/lib/contacts/csv";
import { chaveDoLink, normalizarLink, TIPOS_DE_LINK } from "@/lib/leads/links-de-contato";
import { campoDaColuna } from "@/lib/leads/colunas-da-planilha";
import { precoParaCentavos } from "@/lib/schemas/produtos";

export const STATUS_DE_VENDA_ACEITOS = ["interesse", "comprometida", "concluida", "cancelada"] as const;
export type StatusDeVendaDaPlanilha = (typeof STATUS_DE_VENDA_ACEITOS)[number];

export interface LinhaDeCliente {
  /** A linha como a pessoa a vê na planilha: 1 é o cabeçalho. */
  linha: number;
  nome: string;
  telefone: string | null;
  email: string | null;
  origem: string | null;
  campanha: string | null;
  conjunto: string | null;
  anuncio: string | null;
  landing_page: string | null;
  posicionamento: string | null;
  funil: string | null;
  etapa: string | null;
  produto: string | null;
  valor_cents: number | null;
  status_da_venda: StatusDeVendaDaPlanilha | null;
  previsao: string | null;
  descricao: string | null;
  etiquetas: string[];
  nascimento: string | null;
  /** Links (Instagram, site…) já normalizados, por chave `link_<tipo>` do contato. */
  links: Record<string, string>;
  /** Colunas a mais: nome da coluna → valor (viram campos personalizados). */
  campos: Record<string, string>;
}

export interface ErroDaLinha {
  linha: number;
  motivo: string;
}

export interface ResultadoDaLeituraDeClientes {
  linhas: LinhaDeCliente[];
  erros: ErroDaLinha[];
  /** As colunas que não são do cadastro e entram como campos personalizados. */
  colunasPersonalizadas: string[];
}

const semAcento = (x: string) =>
  x
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

function statusDaVenda(texto: string): StatusDeVendaDaPlanilha | null {
  const t = semAcento(texto);
  if (!t) return null;
  if (/^(interesse|interessado|lead|potencial)/.test(t)) return "interesse";
  if (/^(comprometid|fechad|vendid|em andamento|parcelad)/.test(t)) return "comprometida";
  if (/^(concluid|pag[oa]|quitad|recebid)/.test(t)) return "concluida";
  if (/^(cancelad|perdid)/.test(t)) return "cancelada";
  return null;
}

export function lerLinhasDeClientes(
  celulas: string[][],
  t: (texto: string) => string = (x) => x,
): ResultadoDaLeituraDeClientes | { erro: string } {
  const linhas = celulas.filter((l) => l.some((c) => c.trim() !== ""));
  if (linhas.length === 0) return { erro: t("A planilha está vazia.") };
  const cabecalho = linhas[0]!;

  const mapa = new Map<number, string>();
  const personalizadas = new Map<number, string>();
  cabecalho.forEach((titulo, i) => {
    const campo = campoDaColuna(titulo);
    if (campo && ![...mapa.values()].includes(campo)) mapa.set(i, campo);
    else if (titulo.trim() !== "") personalizadas.set(i, titulo.trim().slice(0, 60));
  });
  const campos = new Set(mapa.values());
  if (!campos.has("titulo") && !campos.has("contato")) {
    return {
      erro:
        t("A planilha precisa de uma coluna com o nome. Encontrei: ") +
        (cabecalho.filter((c) => c.trim()).join(", ") || t("nenhuma coluna")) +
        ".",
    };
  }
  if (!campos.has("telefone") && !campos.has("email")) {
    return { erro: t("A planilha precisa de uma coluna de telefone ou de e-mail.") };
  }

  const resultado: LinhaDeCliente[] = [];
  const erros: ErroDaLinha[] = [];
  for (let i = 1; i < linhas.length; i += 1) {
    const bruto = linhas[i]!;
    const numero = i + 1;
    const valor = (campo: string): string => {
      for (const [idx, c] of mapa) if (c === campo) return (bruto[idx] ?? "").trim();
      return "";
    };

    const nome = (valor("titulo") || valor("contato")).replace(/\s+/g, " ").slice(0, 200);
    if (nome.length < 2) {
      erros.push({ linha: numero, motivo: t("sem nome") });
      continue;
    }

    const telTexto = valor("telefone");
    const telefone = telTexto === "" ? null : normalizaTelefone(telTexto);
    if (telTexto !== "" && telefone === null) {
      erros.push({ linha: numero, motivo: `${t("telefone não reconhecido")} ("${telTexto}")` });
      continue;
    }
    const emailTexto = valor("email");
    if (emailTexto !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTexto)) {
      erros.push({ linha: numero, motivo: `${t("e-mail inválido")} ("${emailTexto}")` });
      continue;
    }
    const email = emailTexto === "" ? null : emailTexto;
    if (!telefone && !email) {
      erros.push({ linha: numero, motivo: t("sem telefone nem e-mail") });
      continue;
    }

    const valorTexto = valor("valor");
    const valor_cents = valorTexto === "" ? null : precoParaCentavos(valorTexto);
    if (valorTexto !== "" && valor_cents === null) {
      erros.push({
        linha: numero,
        motivo: `${t("valor da venda não reconhecido")} ("${valorTexto}") — ${t("escreva assim: 1.200,00")}`,
      });
      continue;
    }

    const previsaoTexto = valor("previsao");
    const previsao = previsaoTexto === "" ? null : normalizaData(previsaoTexto);
    if (previsaoTexto !== "" && previsao === null) {
      erros.push({ linha: numero, motivo: `${t("previsão não reconhecida")} ("${previsaoTexto}") — DD/MM/AAAA` });
      continue;
    }
    const nascTexto = valor("nascimento");
    const nascimento = nascTexto === "" ? null : normalizaData(nascTexto);
    if (nascTexto !== "" && nascimento === null) {
      erros.push({ linha: numero, motivo: `${t("nascimento não reconhecido")} ("${nascTexto}") — DD/MM/AAAA` });
      continue;
    }
    const statusTexto = valor("status_da_venda");
    const status = statusTexto === "" ? null : statusDaVenda(statusTexto);
    if (statusTexto !== "" && status === null) {
      erros.push({
        linha: numero,
        motivo: `${t("status da venda não reconhecido")} ("${statusTexto}") — ${t("use Interesse, Comprometida, Concluída ou Cancelada")}`,
      });
      continue;
    }

    const links: Record<string, string> = {};
    for (const tipo of TIPOS_DE_LINK) {
      const bruto = valor(`link_${tipo.id}`);
      if (bruto === "") continue;
      const url = normalizarLink(bruto);
      if (url) links[chaveDoLink(tipo.id)] = url;
      else {
        // Link ruim não derruba a linha: o resto do lead entra e o aviso diz qual célula conferir.
        erros.push({
          linha: numero,
          motivo: `${t("link não reconhecido")} ${tipo.rotulo} ("${bruto}") — ${t("cole o endereço completo, ex.: https://…")}`,
        });
      }
    }

    const extras: Record<string, string> = {};
    for (const [idx, rotulo] of personalizadas) {
      const v = (bruto[idx] ?? "").trim();
      if (v !== "") extras[rotulo] = v.slice(0, 500);
    }

    resultado.push({
      linha: numero,
      nome,
      telefone,
      email,
      origem: valor("origem") || null,
      campanha: valor("campanha") || null,
      conjunto: valor("conjunto") || null,
      anuncio: valor("anuncio") || null,
      landing_page: valor("landing_page") || null,
      posicionamento: valor("posicionamento") || null,
      funil: valor("funil") || null,
      etapa: valor("etapa") || null,
      produto: valor("produto") || null,
      valor_cents,
      status_da_venda: status,
      previsao,
      descricao: valor("descricao") || null,
      etiquetas: valor("etiquetas")
        .split(/[,;|]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 20),
      nascimento,
      links,
      campos: extras,
    });
  }
  return { linhas: resultado, erros, colunasPersonalizadas: [...personalizadas.values()] };
}
