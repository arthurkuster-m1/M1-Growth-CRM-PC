import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: vi.fn() }));
vi.mock("./emit", () => ({ emitNotification: vi.fn() }));

import { toast } from "sonner";
import { entregarAviso } from "./deliver";
import { emitNotification } from "./emit";
import { gravarCanal } from "./prefs";

type OpcoesDoToast = {
  action?: { label: string; onClick: () => void };
  cancel?: { label: string; onClick: () => void };
};

describe("entregarAviso", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("manda toast e notificação do navegador quando os dois canais estão ligados", () => {
    entregarAviso({
      category: "lead_assigned",
      kind: "lead_assigned",
      title: "Lead atribuído",
      body: "Carlos",
    });
    expect(toast).toHaveBeenCalledTimes(1);
    expect(emitNotification).toHaveBeenCalledTimes(1);
  });

  it("omite a notificação do navegador quando o canal está desligado", () => {
    gravarCanal("lead_new", "push", false);
    entregarAviso({ category: "lead_new", kind: "lead_new", title: "Novo lead: Ana", body: "ok" });
    expect(toast).toHaveBeenCalledTimes(1);
    expect(emitNotification).not.toHaveBeenCalled();
  });

  it("os dois botões do aviso viram os dois botões do toast, cada um com o seu destino", () => {
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: { assign, origin: "https://app.teste" },
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    });

    entregarAviso({
      category: "message",
      kind: "message_inbound",
      title: "Maria Souza",
      body: "oi",
      acoes: [
        { rotulo: "Responder", href: "/app/inbox?id=conv-1" },
        { rotulo: "Abrir no CRM", href: "/app/leads/lead-1" },
      ],
    });

    const [, opcoes] = vi.mocked(toast).mock.calls.at(-1) as unknown as [string, OpcoesDoToast];
    expect(opcoes.action?.label).toBe("Responder");
    expect(opcoes.cancel?.label).toBe("Abrir no CRM");
    opcoes.action!.onClick();
    expect(assign).toHaveBeenCalledWith("/app/inbox?id=conv-1");
    opcoes.cancel!.onClick();
    expect(assign).toHaveBeenCalledWith("/app/leads/lead-1");
  });

  it("aviso sem destino não ganha botão — botão morto não é conserto", () => {
    entregarAviso({
      category: "lead_assigned",
      kind: "lead_assigned",
      title: "Lead atribuído",
      body: "Carlos",
    });
    const [, opcoes] = vi.mocked(toast).mock.calls.at(-1) as unknown as [string, OpcoesDoToast];
    expect(opcoes?.action).toBeUndefined();
    expect(opcoes?.cancel).toBeUndefined();
  });
});
