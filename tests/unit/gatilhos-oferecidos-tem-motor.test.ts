/**
 * O SELETOR DE GATILHO NÃO OFERECE O QUE O PUBLISH RECUSA — E NÃO ESCONDE O QUE
 * ELE ACEITA.
 *
 * ## Por que este arquivo existe, e por que ele é BARATO de propósito
 *
 * A propriedade já era guardada — pelo `followup-builder.spec.ts`, no job `e2e`,
 * que leva 29 minutos. E ela quebrou duas vezes seguidas pelo mesmo motivo, as
 * duas legítimas: a lista da tela cresceu (`case_opened`, depois `webhook`) e a
 * spec de outra pessoa ficou vermelha por uma mudança que ninguém pediu ali. O
 * comentário daquele bloco já previa isso em voz alta.
 *
 * Um contrato que só é medido no gate mais caro é um contrato que se descobre
 * quebrado 29 minutos depois, num job onde a falha se parece com flakiness. Aqui
 * a mesma divergência aparece no `verify`, em milissegundos, e nomeando o kind.
 *
 * ## O que ele guarda, nos DOIS sentidos
 *
 * `KINDS_COM_MOTOR`, na rota de publish, é a lista de gatilhos que têm produtor
 * de enrollment. O seletor da `PublishBar` tem de oferecer exatamente ela:
 *
 *  - oferecer a MAIS é controle decorativo — a pessoa escolhe, salva, e o
 *    publish recusa com "não está disponível". Pior que não ter a opção.
 *  - oferecer a MENOS é capacidade entregue e escondida: o motor existe, alguém
 *    pagou para escrevê-lo, e ninguém consegue chegar nele pela tela.
 *
 * ## A fraqueza, declarada
 *
 * Isto mede TEXTO — lê os dois arquivos e compara conjuntos de literais. Um
 * refactor que monte a lista por outro caminho passa batido. Por isso o controle
 * positivo abaixo exige que os dois conjuntos sejam NÃO-VAZIOS antes de qualquer
 * conclusão: instrumento que não acha nada devolve verde igual a instrumento que
 * não achou problema. O `e2e` continua sendo quem prova pela tela.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const PUBLISH = path.join(RAIZ, "app/api/v1/ai/followup-flows/[id]/publish/route.ts");
const SELETOR = path.join(RAIZ, "app/app/ai/followups/[id]/_components/TriggerConfigControl.tsx");

function kindsComMotor(): string[] {
  const fonte = readFileSync(PUBLISH, "utf8");
  const m = /const KINDS_COM_MOTOR = new Set\(\[([^\]]*)\]\)/.exec(fonte);
  if (m === null) return [];
  return [...m[1]!.matchAll(/"([a-z_]+)"/g)].map((x) => x[1]!);
}

function kindsOferecidos(): string[] {
  const fonte = readFileSync(SELETOR, "utf8");
  return [...fonte.matchAll(/<SelectItem value="([a-z_]+)">/g)].map((x) => x[1]!);
}

describe("o seletor de gatilho e o publish falam da mesma lista", () => {
  it("o parser está vivo — controle positivo antes de qualquer conclusão", () => {
    expect(kindsComMotor().length, "não achei KINDS_COM_MOTOR no publish").toBeGreaterThan(0);
    expect(kindsOferecidos().length, "não achei nenhum <SelectItem> no seletor").toBeGreaterThan(0);
  });

  it("⭐ nenhum gatilho oferecido é recusado pelo publish (controle decorativo)", () => {
    const motor = new Set(kindsComMotor());
    const decorativos = kindsOferecidos().filter((k) => !motor.has(k));
    expect(
      decorativos,
      "a tela oferece gatilho que o publish recusa — a pessoa escolhe, salva, e leva 'não está disponível'",
    ).toEqual([]);
  });

  /**
   * Gatilhos com motor que, POR ENQUANTO, só se criam pela API, com a razão escrita. Só encolhe: a
   * entrada some quando a tela passa a oferecer o gatilho — o teste abaixo reprova a entrada velha.
   *
   * `event` (motor único, Fase 2c): é o gatilho das automações de CRM (`surface='crm_automation'`).
   * Quem o escolhe é a barra «Quando» do editor das automações (`GatilhoDaAutomacao.tsx`); oferecê-lo no
   * seletor do follow-up seria controle decorativo — o publish o recusa fora de `crm_automation`.
   */
  const SO_PELA_API_POR_ENQUANTO: Record<string, string> = {
    event: "oferecido pela barra «Quando» da automação (GatilhoDaAutomacao), não pelo seletor do follow-up",
  };

  it("⭐ nenhum gatilho com motor fica escondido da tela (capacidade órfã)", () => {
    const oferecidos = new Set(kindsOferecidos());
    const escondidos = kindsComMotor().filter(
      (k) => !oferecidos.has(k) && !(k in SO_PELA_API_POR_ENQUANTO),
    );
    expect(
      escondidos,
      "existe motor de enrollment que nenhuma tela alcança — só se chega nele pela API",
    ).toEqual([]);
  });

  it("a lista de exceções não apodrece: só tem gatilho que ainda tem motor e ainda não está na tela", () => {
    const oferecidos = new Set(kindsOferecidos());
    const motor = new Set(kindsComMotor());
    const velhas = Object.keys(SO_PELA_API_POR_ENQUANTO).filter(
      (k) => oferecidos.has(k) || !motor.has(k),
    );
    expect(
      velhas,
      "tire da exceção o gatilho que a tela já oferece (ou que perdeu o motor)",
    ).toEqual([]);
  });
});
