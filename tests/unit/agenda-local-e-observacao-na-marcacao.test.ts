import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Endereço e observação na HORA de marcar — a cerca de quem some no refactor.
 *
 * As colunas `location_details` e `description` já existiam, e o calendário
 * externo já as publicava. O que faltava era a tela coletar e a API gravar
 * `description` (não `notes`, que é interno e não entra na revisão publicável).
 *
 * Render da página não alcança isto (providers, hooks, rede). O que não pode
 * se perder cabe numa leitura do arquivo: o campo na tela, o POST com os
 * nomes certos, o GET devolvendo, o detalhe mostrando.
 */
describe("endereço e observação existem na marcação e chegam ao compromisso", () => {
  const tela = readFileSync("app/app/agenda/_client.tsx", "utf8");
  const handler = readFileSync("app/api/v1/agenda/agendamentos/_handler.ts", "utf8");
  const rota = readFileSync("app/api/v1/agenda/agendamentos/route.ts", "utf8");
  const detalhe = readFileSync("components/agenda/DetalheDoCompromisso.tsx", "utf8");
  const get = readFileSync("app/api/v1/agenda/agendamentos/[id]/route.ts", "utf8");
  const mcp = readFileSync("lib/mcp/tools/agendamento.ts", "utf8");

  it("a rota aceita os dois campos, e o handler grava description (não notes)", () => {
    expect(rota).toContain("description: z.string().max(2000).optional()");
    expect(rota).toContain("location_details: z.string().max(300).optional()");
    expect(handler).toContain("input.location_details !== undefined");
    expect(handler).toContain("description: input.description !== undefined");
  });

  it("o detalhe lê e mostra o que foi gravado", () => {
    // A anotação interna entrou na mesma leitura, ao lado da observação — a
    // asserção é de FORMA do `select`, então ela acompanha a string. O que ela
    // vigia continua igual: a rota lê `description` e o par de local.
    expect(get).toMatch(/select\(\s*"id,title,description,notes,location_kind,location_details,/);
    expect(detalhe).toContain('data-testid="compromisso-local"');
    expect(detalhe).toContain('data-testid="compromisso-observacao"');
  });

  it("a ferramenta de marcar também aceita, e notes continua interno", () => {
    expect(mcp).toContain("observação visível no calendário");
    expect(mcp).toContain("endereço ou local DESTE compromisso");
    expect(mcp).toContain("anotação INTERNA da equipe");
  });
});
