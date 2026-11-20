import { describe, expect, it } from "vitest";

import { chaveDeSubpagina } from "@/lib/marketing/modulos";

import { PASSOS } from "./catalogo";
import { MAXIMO_DE_PROXIMOS, diagnosticar } from "./diagnostico";
import {
  paginasPublicadas,
  sinaisCompletos,
  sinaisQueFalharam,
  sinaisVazios,
} from "./sinais-de-teste";
import type { Leitura, PassoDoMapa, Perfil, PassoDiagnosticado } from "./tipos";

const AGORA = new Date("2026-11-20T12:00:00Z");
const HOJE = "2026-11-19T12:00:00Z";
const ha = (dias: number) => new Date(AGORA.getTime() - dias * 86_400_000).toISOString();

const clinica: Perfil = {
  nicho: "clinica",
  modelos: ["agendamento", "whatsapp"],
  jaTemOferta: false,
};
const loja: Perfil = { nicho: "loja", modelos: ["checkout"], jaTemOferta: false };

const estadoDe = (passos: PassoDiagnosticado[], id: string) => passos.find((p) => p.id === id)!;

describe("diagnosticar", () => {
  describe("sem perfil", () => {
    const d = diagnosticar({ perfil: null, sinais: sinaisVazios(), agora: AGORA });

    it("só avalia a fase de cadastros e pede o perfil primeiro", () => {
      expect(d.perfilPendente).toBe(true);
      expect(new Set(d.passos.map((p) => p.fase))).toEqual(new Set(["cadastros"]));
      expect(d.proximos[0]?.id).toBe("P00.1");
    });

    it("o que depende do perfil fica bloqueado, dizendo o que falta", () => {
      const p = estadoDe(d.passos, "P00.5");
      expect(p.estado).toBe("bloqueado");
      expect(p.aguardando).toEqual(["P00.1"]);
      expect(d.proximos.map((x) => x.id)).not.toContain("P00.5");
    });
  });

  describe("empresa nova com perfil de clínica", () => {
    const d = diagnosticar({ perfil: clinica, sinais: sinaisVazios(), agora: AGORA });

    it("o perfil preenchido já conta como feito", () => {
      expect(d.perfilPendente).toBe(false);
      expect(estadoDe(d.passos, "P00.1").estado).toBe("feito");
    });

    it("só pede o que dá para fazer agora: antecessor essencial pendente bloqueia", () => {
      const p24 = estadoDe(d.passos, "P24");
      expect(p24.estado).toBe("bloqueado");
      expect(p24.aguardando.sort()).toEqual(["P21", "P22"]);
      const p30 = estadoDe(d.passos, "P30");
      expect(p30.estado).toBe("bloqueado");
      expect(p30.aguardando).toEqual(["P24"]);
    });

    it("os próximos são só essenciais (enquanto houver), desbloqueados e no máximo 5", () => {
      expect(d.proximos.length).toBeLessThanOrEqual(MAXIMO_DE_PROXIMOS);
      expect(d.proximos.length).toBeGreaterThan(0);
      for (const p of d.proximos) {
        expect(p.classificacao).toBe("E");
        expect(["falta", "em_andamento", "desatualizado"]).toContain(p.estado);
      }
    });

    it("antecessor recomendado não bloqueia (P31 vem depois de P12, que é só recomendado na clínica)", () => {
      expect(estadoDe(d.passos, "P12").classificacao).toBe("R");
      expect(estadoDe(d.passos, "P31").estado).not.toBe("bloqueado");
    });

    it("passo de agenda aparece para quem vende por agendamento", () => {
      expect(estadoDe(d.passos, "P42").classificacao).toBe("E");
      expect(estadoDe(d.passos, "P42").estado).not.toBe("nao_se_aplica");
    });
  });

  it("quando não sobra essencial a fazer, os próximos passam a ser os recomendados", () => {
    // P46 é o único essencial manual da clínica; marcado à mão, restam só recomendados.
    const d = diagnosticar({
      perfil: clinica,
      sinais: sinaisCompletos(HOJE),
      manuais: { P46: { estado: "feito", em: HOJE } },
      agora: AGORA,
    });
    expect(d.proximos.length).toBeGreaterThan(0);
    for (const p of d.proximos) expect(p.classificacao).toBe("R");
  });

  describe("perfil muda o que vale", () => {
    it("loja que só vende por checkout: agenda e anti no-show não se aplicam", () => {
      const d = diagnosticar({ perfil: loja, sinais: sinaisVazios(), agora: AGORA });
      for (const id of ["P42", "P43", "P44"])
        expect(estadoDe(d.passos, id).estado).toBe("nao_se_aplica");
      expect(estadoDe(d.passos, "P48").classificacao).toBe("E");
    });

    it("quem já tem oferta pronta pode começar pela campanha sem os estudos", () => {
      const sinais = sinaisVazios();
      const sem = diagnosticar({ perfil: clinica, sinais, agora: AGORA });
      const com = diagnosticar({ perfil: { ...clinica, jaTemOferta: true }, sinais, agora: AGORA });
      expect(estadoDe(sem.passos, "P30").estado).toBe("bloqueado");
      expect(estadoDe(com.passos, "P22").classificacao).toBe("R");
      expect(estadoDe(com.passos, "P30").estado).toBe("falta");
    });
  });

  describe("empresa com tudo pronto", () => {
    const d = diagnosticar({ perfil: clinica, sinais: sinaisCompletos(HOJE), agora: AGORA });

    it("nenhum passo detectável essencial fica pendente nem bloqueado", () => {
      for (const p of d.passos) {
        if (p.classificacao === "E" && p.confianca !== "manual") {
          expect(p.estado, `${p.id}: ${p.evidencia}`).toBe("feito");
        }
        expect(p.estado).not.toBe("bloqueado");
      }
    });

    it("a prontidão é alta, mas os passos manuais ainda pesam", () => {
      expect(d.prontidao.geral).toBeGreaterThan(70);
      expect(d.prontidao.geral).toBeLessThan(100);
    });

    it("não há 'não verificado' quando todas as leituras deram certo", () => {
      expect(d.naoVerificados).toEqual([]);
    });
  });

  describe("validade", () => {
    const comConcorrencia = (publicadaEm: string) => {
      const s = sinaisCompletos(HOJE);
      const paginas = { ...paginasPublicadas(HOJE) };
      for (const id of ["conc1", "conc2", "conc3"]) {
        paginas[chaveDeSubpagina("analise-de-concorrencia", "concorrente", id)] = publicadaEm;
      }
      return {
        ...s,
        paginas: { ok: true, valor: paginas } as Leitura<Record<string, string | null>>,
      };
    };

    it("análise de concorrência com mais de 6 meses volta como desatualizada", () => {
      const velha = diagnosticar({
        perfil: clinica,
        sinais: comConcorrencia(ha(200)),
        agora: AGORA,
      });
      const nova = diagnosticar({
        perfil: clinica,
        sinais: comConcorrencia(ha(100)),
        agora: AGORA,
      });
      expect(estadoDe(velha.passos, "P22").estado).toBe("desatualizado");
      expect(estadoDe(velha.passos, "P22").evidencia).toMatch(/há 200 dias/);
      expect(estadoDe(nova.passos, "P22").estado).toBe("feito");
    });

    it("desatualizado conta menos que feito na prontidão, mas mais que falta", () => {
      const velha = diagnosticar({
        perfil: clinica,
        sinais: comConcorrencia(ha(200)),
        agora: AGORA,
      });
      const nova = diagnosticar({
        perfil: clinica,
        sinais: comConcorrencia(ha(100)),
        agora: AGORA,
      });
      expect(velha.prontidao.porFase["produto-e-oferta"].pct!).toBeLessThan(
        nova.prontidao.porFase["produto-e-oferta"].pct!,
      );
    });

    it("criativo velho só vence se há campanha ativa", () => {
      const base = sinaisCompletos(HOJE);
      const velho = {
        ...base,
        criativos: { ok: true, valor: { total: 4, ultimoCriadoEm: ha(60) } } as const,
      };
      const comCampanha = diagnosticar({ perfil: clinica, sinais: velho, agora: AGORA });
      const semCampanha = diagnosticar({
        perfil: clinica,
        sinais: {
          ...velho,
          campanhas: {
            ok: true,
            valor: { total: 1, ativas: 0, ativasComMeta: 0, ultimoDiaDaMeta: null },
          },
        },
        agora: AGORA,
      });
      expect(estadoDe(comCampanha.passos, "P51").estado).toBe("desatualizado");
      expect(estadoDe(semCampanha.passos, "P51").estado).toBe("feito");
    });

    it("o que está desatualizado vem depois do que ainda falta nos próximos passos", () => {
      const d = diagnosticar({ perfil: clinica, sinais: comConcorrencia(ha(200)), agora: AGORA });
      const ordem = d.proximos.map((p) => p.estado);
      const primeiroDesatualizado = ordem.indexOf("desatualizado");
      if (primeiroDesatualizado >= 0) {
        expect(ordem.slice(primeiroDesatualizado).every((e) => e === "desatualizado")).toBe(true);
      }
    });
  });

  describe("marcação à mão", () => {
    it("'feito' à mão vence o detector", () => {
      const d = diagnosticar({
        perfil: clinica,
        sinais: sinaisVazios(),
        manuais: { P10: { estado: "feito", em: HOJE } },
        agora: AGORA,
      });
      const p = estadoDe(d.passos, "P10");
      expect(p.estado).toBe("feito");
      expect(p.manual).toBe(true);
    });

    it("'dispensado' tira o passo da prontidão e dos próximos", () => {
      const sem = diagnosticar({ perfil: clinica, sinais: sinaisVazios(), agora: AGORA });
      const dispensando = diagnosticar({
        perfil: clinica,
        sinais: sinaisVazios(),
        manuais: { P33: { estado: "dispensado", motivo: "o cliente só atende indicação" } },
        agora: AGORA,
      });
      const p = estadoDe(dispensando.passos, "P33");
      expect(p.estado).toBe("dispensado");
      expect(p.evidencia).toMatch(/só atende indicação/);
      expect(dispensando.proximos.map((x) => x.id)).not.toContain("P33");
      expect(dispensando.prontidao.porFase.captacao.total).toBe(
        sem.prontidao.porFase.captacao.total - 1,
      );
    });

    it("dispensar um essencial libera o que dependia dele", () => {
      const d = diagnosticar({
        perfil: clinica,
        sinais: sinaisVazios(),
        manuais: { P30: { estado: "dispensado" } },
        agora: AGORA,
      });
      expect(estadoDe(d.passos, "P33").estado).toBe("falta");
    });

    it("passo manual que vence volta depois do prazo", () => {
      const d = diagnosticar({
        perfil: clinica,
        sinais: sinaisCompletos(HOJE),
        manuais: { P62: { estado: "feito", em: ha(45) } },
        agora: AGORA,
      });
      expect(estadoDe(d.passos, "P62").estado).toBe("desatualizado");
    });
  });

  describe("leitura que falhou", () => {
    it("vira 'não verificado': nunca 'feito', fica fora da prontidão e não bloqueia quem depende", () => {
      const sinais = { ...sinaisVazios(), paginas: { ok: false, motivo: "x" } as Leitura<never> };
      const d = diagnosticar({ perfil: clinica, sinais, agora: AGORA });
      expect(estadoDe(d.passos, "P10").estado).toBe("nao_verificado");
      expect(estadoDe(d.passos, "P10").evidencia).toMatch(/Não consegui verificar/);
      expect(d.naoVerificados).toContain("P10");
      // P21 depende de P10 (essencial): como P10 não foi verificado, não bloqueia por isso
      expect(estadoDe(d.passos, "P21").estado).not.toBe("bloqueado");
      expect(d.proximos.map((p) => p.id)).not.toContain("P10");
    });

    it("com o banco todo fora, não inventa progresso", () => {
      const d = diagnosticar({ perfil: clinica, sinais: sinaisQueFalharam(), agora: AGORA });
      expect(d.passos.filter((p) => p.estado === "feito").map((p) => p.id)).toEqual(["P00.1"]);
    });
  });

  describe("prontidão (catálogo pequeno, conta simples)", () => {
    const passo = (id: string, extra: Partial<PassoDoMapa> = {}): PassoDoMapa => ({
      id,
      fase: "diagnostico",
      titulo: id,
      porque: "",
      classes: ["E", "E", "E", "E", "E"],
      depende: [],
      confianca: "manual",
      onde: { href: "/app/guia", rotulo: "Guia" },
      ...extra,
    });
    const rodar = (catalogo: PassoDoMapa[], manuais = {}) =>
      diagnosticar({ perfil: clinica, sinais: sinaisVazios(), catalogo, manuais, agora: AGORA });

    it("dois essenciais, um feito: 50%", () => {
      const d = rodar([passo("A"), passo("B")], { A: { estado: "feito" } });
      expect(d.prontidao.geral).toBe(50);
      expect(d.prontidao.porFase.diagnostico).toEqual({ pct: 50, feitos: 1, total: 2 });
    });

    it("essencial pesa 3 e recomendado 1", () => {
      const d = rodar([passo("A"), passo("B", { classes: ["R", "R", "R", "R", "R"] })], {
        A: { estado: "feito" },
      });
      expect(d.prontidao.geral).toBe(75);
    });

    it("opcional e rotina fora da prontidão não puxam a nota", () => {
      const d = rodar(
        [
          passo("A"),
          passo("B", { classes: ["O", "O", "O", "O", "O"] }),
          passo("C", { contaNaProntidao: false }),
        ],
        { A: { estado: "feito" } },
      );
      expect(d.prontidao.geral).toBe(100);
    });

    it("fase sem nada que conte fica sem porcentagem (não 0%)", () => {
      const d = rodar([passo("A", { classes: ["-", "-", "-", "-", "-"] })]);
      expect(d.prontidao.geral).toBeNull();
      expect(d.prontidao.porFase.diagnostico.pct).toBeNull();
    });
  });

  it("é determinística: mesma entrada, mesma saída", () => {
    const entrada = { perfil: clinica, sinais: sinaisCompletos(HOJE), agora: AGORA };
    expect(diagnosticar(entrada)).toEqual(diagnosticar(entrada));
  });

  it("o catálogo inteiro roda com qualquer perfil sem lançar", () => {
    for (const nicho of ["clinica", "servico", "imobiliaria", "loja", "infoproduto"] as const) {
      const d = diagnosticar({
        perfil: {
          nicho,
          modelos: ["agendamento", "whatsapp", "checkout", "lancamento"],
          jaTemOferta: false,
        },
        sinais: sinaisVazios(),
        agora: AGORA,
      });
      expect(d.passos).toHaveLength(PASSOS.length);
    }
  });
});
