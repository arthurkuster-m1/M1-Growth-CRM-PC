import { normalizaData, normalizaTelefone, parseCsv } from "@/lib/contacts/csv";
import { precoParaCentavos } from "@/lib/schemas/produtos";
import { campoDaColuna, normalizarCabecalho } from "@/lib/leads/colunas-da-planilha";
import type { CustomFieldDef } from "@/lib/schemas/settings";

/**
 * A PLANILHA DE LEADS — da lista que a empresa já tem para dentro do funil.
 *
 * Extraído do PR #418 (@clinicacentrodosorrisosc-code). O que muda é ONDE a
 * leitura acontece e COM O QUE ela é feita.
 *
 * ─── Por que não veio o `xlsx` que o original usava ────────────────────────
 *
 * O #418 lê `.xlsx` no NAVEGADOR com `xlsx@0.18.5`. Essa é a última versão
 * publicada no npm da SheetJS, e ela carrega CVE-2023-30533 (prototype
 * pollution, alta) e CVE-2024-22363 (ReDoS) — a biblioteca saiu do npm e as
 * correções vivem só no CDN próprio deles. Num produto que se instala na VPS
 * de terceiros, entrar com uma dependência nessa situação é dívida que o
 * cliente paga.
 *
 * E não era preciso: `parseCsv` já existe aqui, é RFC 4180, sem dependência,
 * detecta o delimitador (o Excel em português exporta com `;`) e já tem
 * `decodificarCsv` para o arquivo em Latin-1 que o Excel gera. É o mesmo
 * caminho por onde os CONTATOS e o CATÁLOGO já entram — copiá-lo criaria a
 * segunda verdade sobre o que é uma planilha, e a segunda envelhece sozinha.
 *
 * ─── Por que a leitura é no SERVIDOR ───────────────────────────────────────
 *
 * O original montava as linhas no browser e disparava um `POST /api/v1/leads`
 * por linha, em lotes de 20 com `Promise.allSettled`. Três consequências: 500
 * requisições autenticadas para uma planilha de 500 nomes; nenhuma auditoria
 * do gesto "importei uma planilha", só 500 `lead.created` soltos; e o resultado
 * dependendo da aba ficar aberta — fechar o navegador no meio deixa metade
 * dentro e metade fora, sem ninguém saber qual metade.
 *
 * ─── A planilha vem suja, e recusar é a função ─────────────────────────────
 *
 * "R$ 1.200,00" e "1200", telefone com máscara, linha em branco no meio,
 * coluna com acento. Nada disso é erro de quem mandou — é o formato real. O
 * que NÃO se aceita em silêncio é o ambíguo: valor que não dá para ler vira
 * linha recusada com o motivo, nunca um chute.
 */

export interface LinhaDeLead {
  /** A linha como a pessoa a vê na planilha: 1 é o cabeçalho. */
  linha: number;
  title: string;
  description: string | null;
  value_cents: number | null;
  /** Já em E.164, ou nulo quando a célula não era um telefone. */
  telefone: string | null;
  nome_do_contato: string | null;
  email: string | null;
  tags: string[];
  source: string;
  /** O nome da etapa pedida na planilha; nulo = a primeira etapa aberta do funil. */
  etapa: string | null;
  /** Previsão de fechamento, ISO `AAAA-MM-DD`. */
  previsao: string | null;
  /** Os campos personalizados do funil, já convertidos (chave → valor). */
  campos: Record<string, unknown>;
}

export interface ErroDaLinha {
  linha: number;
  motivo: string;
}

export interface ResultadoDaLeitura {
  leads: LinhaDeLead[];
  erros: ErroDaLinha[];
  /** Colunas que a planilha trouxe e este importador não conhece. */
  colunasIgnoradas: string[];
}

/** A origem gravada em `crm_leads.source` — vocabulário, não string solta. */
export const ORIGEM_DA_PLANILHA = "importacao_planilha";

/** Lê o texto CSV de uma planilha de leads. */
export function lerPlanilhaDeLeads(
  conteudo: string,
  t?: (text: string) => string,
  camposDoFunil: readonly CustomFieldDef[] = [],
): ResultadoDaLeitura | { erro: string } {
  return lerLinhasDeLeads(parseCsv(conteudo), t, camposDoFunil);
}

/** Converte o texto de uma célula no valor do campo personalizado; `undefined` = não reconhecido. */
function valorDoCampo(def: CustomFieldDef, texto: string): unknown {
  const bruto = texto.trim();
  if (bruto === "") return null;
  const mesmo = (a: string, b: string) => normalizarCabecalho(a) === normalizarCabecalho(b);
  switch (def.type) {
    case "number": {
      const n = Number(bruto.replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
      return Number.isFinite(n) ? n : undefined;
    }
    case "boolean":
      if (/^(sim|s|true|1|yes|x|verdadeiro)$/i.test(bruto)) return true;
      if (/^(nao|não|n|false|0|no|falso)$/i.test(bruto)) return false;
      return undefined;
    case "date":
      return normalizaData(bruto) ?? undefined;
    case "select": {
      const o = (def.options ?? []).find((x) => mesmo(x.value, bruto) || mesmo(x.label, bruto));
      return o ? o.value : undefined;
    }
    case "multiselect": {
      const partes = bruto.split(/[|;]/).map((p) => p.trim()).filter(Boolean);
      const achados = partes.map((p) =>
        (def.options ?? []).find((x) => mesmo(x.value, p) || mesmo(x.label, p)),
      );
      return achados.every(Boolean) ? achados.map((o) => o!.value) : undefined;
    }
    default:
      return bruto.slice(0, 2000);
  }
}

/**
 * Lê as linhas JÁ SEPARADAS em células (a 1ª é o cabeçalho). É o que o arquivo CSV e a tabela do
 * popup de importar têm em comum — uma só regra de leitura para os dois.
 */
export function lerLinhasDeLeads(
  celulas: string[][],
  t?: (text: string) => string,
  camposDoFunil: readonly CustomFieldDef[] = [],
): ResultadoDaLeitura | { erro: string } {
  const _t = t || ((x) => x);
  const linhas = celulas.filter((l) => l.some((c) => c.trim() !== ""));
  if (linhas.length === 0) return { erro: _t("A planilha está vazia.") };

  const cabecalho = linhas[0]!;
  const mapa = new Map<number, string>();
  const colunasIgnoradas: string[] = [];
  const camposPorColuna = new Map<number, CustomFieldDef>();
  cabecalho.forEach((titulo, i) => {
    const campo = campoDaColuna(titulo);
    if (campo && ![...mapa.values()].includes(campo)) {
      mapa.set(i, campo);
      return;
    }
    // Coluna com o nome (ou a chave) de um campo personalizado do funil.
    const alvo = normalizarCabecalho(titulo);
    const def = camposDoFunil.find(
      (f) => normalizarCabecalho(f.label) === alvo || normalizarCabecalho(f.key) === alvo,
    );
    if (def && ![...camposPorColuna.values()].some((d) => d.key === def.key)) {
      camposPorColuna.set(i, def);
    } else if (titulo.trim() !== "") colunasIgnoradas.push(titulo.trim());
  });

  const campos = new Set(mapa.values());
  // Sem nada que NOMEIE o negócio não há card — e dizer isso antes de
  // processar 300 linhas evita um relatório com 300 erros iguais.
  if (!campos.has("titulo") && !campos.has("contato")) {
    return {
      erro:
        _t("A planilha precisa de uma coluna com o nome do negócio ou do contato. Encontrei: ") +
        (cabecalho.filter((c) => c.trim()).join(", ") || _t("nenhuma coluna")) +
        ".",
    };
  }

  const leads: LinhaDeLead[] = [];
  const erros: ErroDaLinha[] = [];

  for (let i = 1; i < linhas.length; i += 1) {
    const bruto = linhas[i]!;
    const numeroNaPlanilha = i + 1;
    const valor = (campo: string): string => {
      for (const [idx, c] of mapa) if (c === campo) return (bruto[idx] ?? "").trim();
      return "";
    };

    const nomeDoContato = valor("contato").replace(/\s+/g, " ");
    // Sem coluna de título, o nome do contato NOMEIA o card. O original punha
    // "Lead importado" nesse caso, e uma planilha de 300 nomes virava 300 cards
    // com o mesmo título — indistinguíveis no funil, que é onde eles vivem.
    const title = (valor("titulo").replace(/\s+/g, " ") || nomeDoContato).slice(0, 200);
    if (title.length < 2) {
      erros.push({ linha: numeroNaPlanilha, motivo: _t("sem nome do negócio nem do contato") });
      continue;
    }

    const valorTexto = valor("valor");
    const value_cents = valorTexto === "" ? null : precoParaCentavos(valorTexto);
    if (valorTexto !== "" && value_cents === null) {
      // O valor cru entra na mensagem: quem vai corrigir precisa achar a célula.
      erros.push({
        linha: numeroNaPlanilha,
        motivo:
          _t("valor não reconhecido (") + `"${valorTexto}"` + ")" + _t(" — escreva assim: 1.200,00"),
      });
      continue;
    }

    const telefoneTexto = valor("telefone");
    const telefone = telefoneTexto === "" ? null : normalizaTelefone(telefoneTexto);
    if (telefoneTexto !== "" && telefone === null) {
      // Telefone ilegível NÃO derruba a linha: o negócio entra sem contato, e a
      // pessoa corrige um card em vez de reimportar a planilha inteira. Mas o
      // aviso fica, senão o número some sem ninguém saber.
      erros.push({
        linha: numeroNaPlanilha,
        motivo:
          _t("telefone não reconhecido (") +
          `"${telefoneTexto}"` +
          ")" +
          _t(" — o negócio entrou sem contato"),
      });
    }

    const emailTexto = valor("email");

    const previsaoTexto = valor("previsao");
    const previsao = previsaoTexto === "" ? null : normalizaData(previsaoTexto);
    if (previsaoTexto !== "" && previsao === null) {
      erros.push({
        linha: numeroNaPlanilha,
        motivo:
          _t("previsão de fechamento não reconhecida (") +
          `"${previsaoTexto}"` +
          ")" +
          _t(" — use DD/MM/AAAA"),
      });
    }

    const campos: Record<string, unknown> = {};
    for (const [idx, def] of camposPorColuna) {
      const texto = (bruto[idx] ?? "").trim();
      if (texto === "") continue;
      const v = valorDoCampo(def, texto);
      if (v === undefined) {
        erros.push({
          linha: numeroNaPlanilha,
          motivo: `${_t("campo")} "${def.label}" ${_t("não reconhecido")} ("${texto}")`,
        });
        continue;
      }
      campos[def.key] = v;
    }

    leads.push({
      linha: numeroNaPlanilha,
      title,
      description: valor("descricao") || null,
      value_cents,
      telefone,
      nome_do_contato: nomeDoContato || null,
      email: emailTexto.includes("@") ? emailTexto : null,
      tags: valor("etiquetas")
        .split(/[,;|]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20),
      source: valor("origem") || ORIGEM_DA_PLANILHA,
      etapa: valor("etapa") || null,
      previsao,
      campos,
    });
  }

  return { leads, erros, colunasIgnoradas };
}
