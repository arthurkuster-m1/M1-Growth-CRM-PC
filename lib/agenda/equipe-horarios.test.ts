import { beforeEach, describe, expect, it, vi } from "vitest";

const consulta = vi.hoisted(() => ({ horariosLivresDaOrg: vi.fn() }));
vi.mock("@/lib/agenda/consulta", () => consulta);

import { horariosLivresDaEquipe } from "./equipe";

const slot = (h: number) => ({
  inicio: new Date(Date.UTC(2026, 9, 20, h, 0)),
  fim: new Date(Date.UTC(2026, 9, 20, h, 30)),
});
const ok = (slots: ReturnType<typeof slot>[]) => ({
  ok: true,
  slots,
  fusoDaRegra: "America/Sao_Paulo",
  publicouHorarios: true,
  fusoSuposto: false,
  fontesDefasadas: [],
  agendaExternaNuncaLida: false,
  googleCoberturaParcial: false,
});

/** Um banco de mentira: o tipo, a tabela de atendentes e os membros. */
function banco(atendentes: string[]) {
  const tabela = (nome: string) => {
    const q: Record<string, unknown> = {};
    const retorno = () => {
      if (nome === "calendar_event_types") return { data: { id: "t1", default_owner_user_id: "ana" }, error: null };
      if (nome === "calendar_event_type_attendants")
        return { data: atendentes.map((u, i) => ({ user_id: u, priority: i })), error: null };
      return { data: atendentes.map((u) => ({ user_id: u })), error: null };
    };
    for (const m of ["select", "eq", "in", "is", "order"]) q[m] = () => q;
    q.maybeSingle = async () => retorno();
    q.then = (res: (v: unknown) => unknown) => Promise.resolve(retorno()).then(res);
    return q;
  };
  return { from: tabela } as never;
}

describe("horariosLivresDaEquipe", () => {
  beforeEach(() => consulta.horariosLivresDaOrg.mockReset());

  it("com um atendente, é a consulta de sempre", async () => {
    consulta.horariosLivresDaOrg.mockResolvedValue(ok([slot(13)]));
    const r = await horariosLivresDaEquipe(banco(["ana"]), "org", { eventTypeSlug: "reuniao", de: new Date(), ate: new Date(), agora: new Date() });
    expect(consulta.horariosLivresDaOrg).toHaveBeenCalledOnce();
    expect(r.ok && r.slots).toHaveLength(1);
  });

  it("com vários, une os horários sem repetir o mesmo instante", async () => {
    consulta.horariosLivresDaOrg
      .mockResolvedValueOnce(ok([slot(13), slot(14)]))
      .mockResolvedValueOnce(ok([slot(14), slot(15)]));
    const r = await horariosLivresDaEquipe(banco(["ana", "beto"]), "org", { eventTypeSlug: "reuniao", de: new Date(), ate: new Date(), agora: new Date() });
    expect(r.ok && r.slots.map((s) => s.inicio.getUTCHours())).toEqual([13, 14, 15]);
  });

  it("com atendente escolhido, não mexe na consulta", async () => {
    consulta.horariosLivresDaOrg.mockResolvedValue(ok([slot(9)]));
    await horariosLivresDaEquipe(banco(["ana", "beto"]), "org", { eventTypeSlug: "reuniao", ownerUserId: "beto", de: new Date(), ate: new Date(), agora: new Date() });
    expect(consulta.horariosLivresDaOrg).toHaveBeenCalledOnce();
  });
});
