// @vitest-environment node
import { describe, expect, it } from "vitest";

import { canalDoDisparo } from "./canal-do-disparo";

function fake(sessoes: Array<Record<string, unknown>>, extras: string[] = []) {
  const from = (tabela: string) => {
    const c: Record<string, unknown> = {};
    for (const m of ["select", "eq", "in"]) c[m] = () => c;
    c.then = (ok: (v: unknown) => void) =>
      ok({
        data:
          tabela === "campaign_channel_sessions"
            ? extras.map((channel_session_id) => ({ channel_session_id }))
            : sessoes,
        error: null,
      });
    return c;
  };
  return { from } as never;
}
const disparo = { id: "d1", organization_id: "o1", channel_session_id: "s1" };

describe("canalDoDisparo", () => {
  it("número não oficial (WAHA) aceita mensagem livre", async () => {
    const r = await canalDoDisparo(
      fake([{ id: "s1", display_name: "Vendas", phone_number: "1", provider: "waha" }]),
      disparo,
    );
    expect(r).toEqual({ aceitaMensagemLivre: true, semMensagemLivre: [] });
  });

  it("número oficial recusa, e um oficial no meio do pool basta", async () => {
    const r = await canalDoDisparo(
      fake(
        [
          { id: "s1", display_name: "Vendas", phone_number: "1", provider: "waha" },
          { id: "s2", display_name: "Oficial", phone_number: "2", provider: "meta_cloud" },
        ],
        ["s2"],
      ),
      disparo,
    );
    expect(r.aceitaMensagemLivre).toBe(false);
    expect(r.semMensagemLivre).toEqual(["Oficial"]);
  });

  it("provedor desconhecido falha fechado", async () => {
    const r = await canalDoDisparo(
      fake([{ id: "s1", display_name: "X", phone_number: null, provider: "?" }]),
      disparo,
    );
    expect(r.aceitaMensagemLivre).toBe(false);
  });
});
