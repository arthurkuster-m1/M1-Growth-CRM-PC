import { describe, expect, it } from "vitest";

import { compromissosDeTrabalho } from "./compromissos-de-trabalho";

const a = (origem: "ui" | "google_sync", situacao = "confirmed") => ({ origem, situacao }) as never;

describe("compromissosDeTrabalho", () => {
  it("tira a ocupação das outras agendas do Google e os cancelados", () => {
    const lista = [a("ui"), a("google_sync"), a("ui", "cancelled"), a("ui")];
    expect(compromissosDeTrabalho(lista)).toHaveLength(2);
  });

  it("a ocupação continua na lista original (é ela que segura o horário na grade)", () => {
    const lista = [a("ui"), a("google_sync")];
    compromissosDeTrabalho(lista);
    expect(lista).toHaveLength(2);
  });
});
