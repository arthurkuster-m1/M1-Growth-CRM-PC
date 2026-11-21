import { describe, expect, it } from "vitest";

import { diagnosticar } from "./diagnostico";
import { MAXIMO_DA_PERGUNTA, montarDossie, type DadosDoDossie } from "./dossie";
import { sinaisVazios } from "./sinais-de-teste";
import type { Leitura, PerfilGravado } from "./tipos";

const AGORA = new Date("2026-11-21T12:00:00Z");
const perfil: PerfilGravado = {
  nicho: "clinica",
  modelos: ["agendamento"],
  jaTemOferta: false,
  objetivo: "mais_leads",
  ticketMedioCents: 35000,
  metaLeadsMes: 120,
  siteUrl: "https://exemplo.com.br",
  instagramUrl: null,
  googleNegocioUrl: null,
};

const ok = <T>(valor: T): Leitura<T> => ({ ok: true, valor });
const falhou: Leitura<never> = { ok: false, motivo: "banco indisponível" };

function dados(sobre: Partial<DadosDoDossie> = {}): DadosDoDossie {
  return {
    empresa: "Clínica Sorriso",
    perfil,
    diagnostico: diagnosticar({
      perfil: { nicho: "clinica", modelos: ["agendamento"], jaTemOferta: false },
      sinais: sinaisVazios(),
      agora: AGORA,
    }),
    paginas: ok([]),
    campanhas: ok([]),
    criativos: ok([]),
    aprendizados: ok([]),
    geradoEm: AGORA,
    ...sobre,
  };
}

const semEspacosEspeciais = (s: string) => s.replace(/ /g, " ");

describe("montarDossie", () => {
  it("traz as 11 seções, em ordem, e o nome da empresa", () => {
    const { markdown } = montarDossie(dados(), { tamanho: "completo" });
    expect(markdown).toMatch(/^# Dossiê do projeto — Clínica Sorriso/);
    const titulos = [...markdown.matchAll(/^## (\d+)\. /gm)].map((m) => Number(m[1]));
    expect(titulos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("diz à IA para não inventar e deixa claro que não há dado pessoal de lead", () => {
    const { markdown } = montarDossie(dados(), { tamanho: "completo" });
    expect(markdown).toMatch(/não consta no dossiê/i);
    expect(markdown).toMatch(/nenhum dado pessoal de lead/i);
    expect(markdown).toMatch(/Dados individuais de leads.*nunca entram/);
  });

  it("sem perfil, diz que o perfil não foi preenchido", () => {
    const { markdown } = montarDossie(dados({ perfil: null }), { tamanho: "completo" });
    expect(markdown).toMatch(/perfil do negócio ainda não foi preenchido/);
  });

  it("calcula custo por lead, CTR e retorno por código", () => {
    const { markdown } = montarDossie(
      dados({
        campanhas: ok([
          {
            nome: "Captação | Novembro",
            canal: "trafego_pago",
            status: "ativa",
            inicio: "2026-11-01",
            fim: null,
            metaLeads: 100,
            metaCpl: 25,
            metaVendas: null,
            metaReceita: null,
            gasto: 1000,
            leads: 50,
            impressoes: 20000,
            cliques: 400,
            vendas: 4,
            receita: 3000,
          },
        ]),
      }),
      { tamanho: "completo" },
    );
    const m = semEspacosEspeciais(markdown);
    expect(m).toContain("R$ 20,00"); // CPL = 1000 / 50
    expect(m).toContain("2,00%"); // CTR = 400 / 20000
    expect(m).toContain("3,00x"); // retorno = 3000 / 1000
    expect(m).toContain("Captação / Novembro"); // o | do nome não quebra a tabela
  });

  it("separa ofertas das páginas de estratégia", () => {
    const { markdown } = montarDossie(
      dados({
        paginas: ok([
          {
            chave: "estudo-de-persona--persona-ab12",
            titulo: "Persona Ana",
            texto: "Quer sorrir sem medo.",
            publicadaEm: "2026-10-01T00:00:00Z",
          },
          {
            chave: "produtos-e-ofertas--oferta-cd34",
            titulo: "Clareamento",
            texto: "R$ 800 em 3 vezes.",
            publicadaEm: "2026-10-02T00:00:00Z",
          },
        ]),
      }),
      { tamanho: "completo" },
    );
    const [antes, depois] = markdown.split("## 5. Ofertas");
    expect(antes).toContain("Persona Ana");
    expect(antes).not.toContain("Clareamento");
    expect(depois).toContain("Clareamento");
  });

  it("corta texto longo AVISANDO quanto ficou de fora; o resumido é menor que o completo", () => {
    const longa = "palavra ".repeat(1500); // ~12 mil caracteres
    const d = dados({
      paginas: ok([
        {
          chave: "mapeamento-do-funil",
          titulo: "Funil",
          texto: longa,
          publicadaEm: "2026-10-01T00:00:00Z",
        },
      ]),
    });
    const completo = montarDossie(d, { tamanho: "completo" });
    const resumido = montarDossie(d, { tamanho: "resumido" });
    expect(completo.markdown).toMatch(/texto cortado: faltam [\d.]+ caracteres/);
    expect(resumido.caracteres).toBeLessThan(completo.caracteres);
  });

  it("parte que não pôde ser lida vira aviso, não buraco nem erro", () => {
    const { markdown } = montarDossie(
      dados({ campanhas: falhou, criativos: falhou, paginas: falhou, aprendizados: falhou }),
      {
        tamanho: "completo",
      },
    );
    expect(
      markdown.match(/Não consegui ler esta parte agora \(banco indisponível\)/g),
    ).toHaveLength(5);
  });

  it("os aprendizados entram, dizendo o que NÃO repetir; sem nenhum, avisa que não se sabe", () => {
    const com = montarDossie(
      dados({
        aprendizados: ok([
          {
            titulo: "Criativo em vídeo curto",
            hipotese: "CTR baixo",
            resultado: "CPL caiu 30%",
            veredito: "funcionou",
            em: "2026-11-10",
          },
          {
            titulo: "Público amplo",
            hipotese: null,
            resultado: "CPL subiu",
            veredito: "nao_funcionou",
            em: "2026-11-12",
          },
        ]),
      }),
      { tamanho: "completo" },
    ).markdown;
    expect(com).toMatch(
      /\*\*FUNCIONOU\*\* — Criativo em vídeo curto \(2026-11-10\)\. Hipótese: CTR baixo\. Resultado: CPL caiu 30%/,
    );
    expect(com).toMatch(/\*\*NÃO FUNCIONOU\*\* — Público amplo/);
    const sem = montarDossie(dados(), { tamanho: "completo" }).markdown;
    expect(sem).toMatch(/Nenhum aprendizado registrado ainda/);
  });

  it("a pergunta entra, limitada; sem pergunta pede os 3 próximos passos", () => {
    const comPergunta = montarDossie(dados(), {
      tamanho: "completo",
      pergunta: "x".repeat(MAXIMO_DA_PERGUNTA + 100),
    });
    expect(comPergunta.markdown).toContain("x".repeat(MAXIMO_DA_PERGUNTA));
    expect(comPergunta.markdown).not.toContain("x".repeat(MAXIMO_DA_PERGUNTA + 1));
    const sem = montarDossie(dados(), { tamanho: "completo" });
    expect(sem.markdown).toMatch(/3 próximos passos de maior impacto/);
  });

  it("estima os tokens a partir do tamanho", () => {
    const d = montarDossie(dados(), { tamanho: "completo" });
    expect(d.tokensAproximados).toBe(Math.ceil(d.caracteres / 4));
  });

  it("é determinístico", () => {
    expect(montarDossie(dados(), { tamanho: "completo" })).toEqual(
      montarDossie(dados(), { tamanho: "completo" }),
    );
  });
});
