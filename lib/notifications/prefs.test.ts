import { afterEach, describe, expect, it } from "vitest";

import { NOTIFY_UI_CATEGORIES, canalLigado, gravarCanal, lerPrefs } from "./prefs";

describe("prefs de notificação", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("liga e desliga canal por categoria", () => {
    expect(canalLigado("lead_atribuido", "in_app")).toBe(true);
    gravarCanal("lead_atribuido", "in_app", false);
    expect(lerPrefs().lead_atribuido.in_app).toBe(false);
    expect(canalLigado("lead_novo", "push")).toBe(true);
  });

  it("a inscrição do celular fica viva enquanto alguma categoria quiser o celular", () => {
    gravarCanal("mensagem", "push", false);
    expect(window.localStorage.getItem("alerts.enabled")).toBe("1");
    for (const c of NOTIFY_UI_CATEGORIES) gravarCanal(c, "push", false);
    expect(window.localStorage.getItem("alerts.enabled")).toBe("0");
    gravarCanal("sistema", "push", true);
    expect(window.localStorage.getItem("alerts.enabled")).toBe("1");
  });
});
