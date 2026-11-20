import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  itens: [] as Array<{ id: string; title: string; body: string | null }>,
  aberto: 0,
  pessoais: [] as Array<Record<string, unknown>>,
  naoLidas: 0,
  marcar: vi.fn(),
}));

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/notifications/useSonsDaCentral", () => ({ useSonsDaCentral: () => undefined }));
vi.mock("@/hooks/ai/useAgentInbox", () => ({
  useAgentInbox: () => ({ data: { items: h.itens, open_count: h.aberto } }),
}));
vi.mock("@/hooks/notifications/useNotificacoesDaPessoa", () => ({
  useNotificacoesDaPessoa: () => ({
    data: { itens: h.pessoais, nao_lidas: h.naoLidas, disponivel: true },
  }),
  useMarcarNotificacoesLidas: () => ({ mutate: h.marcar }),
}));
vi.mock("@/hooks/auth/AuthProvider", () => ({
  useAuth: () => ({
    user: { is_platform_admin: true, support: null },
    activeOrg: { orgId: "o", name: "Rua Model", role: "admin", interface_settings: undefined },
  }),
}));
vi.mock("@/lib/navigation/interface", () => ({
  destinosDaInterface: () => [{ href: "/app/ai/inbox" }],
}));

import { AlertsBell } from "./AlertsBell";

beforeEach(() => {
  h.itens = [];
  h.aberto = 0;
  h.pessoais = [];
  h.naoLidas = 0;
  h.marcar.mockClear();
});

describe("AlertsBell", () => {
  it("o número vermelho abre uma prévia que diz de que empresa é e o que o aviso diz", () => {
    h.itens = [{ id: "1", title: "Conexão do WhatsApp caiu", body: "Escaneie o QR de novo." }];
    h.aberto = 1;
    render(<AlertsBell />);
    expect(screen.getByTestId("alerts-bell-count").textContent).toBe("1");
    fireEvent.click(screen.getByTestId("alerts-bell"));
    expect(screen.getByText("Conexão do WhatsApp caiu")).toBeTruthy();
    expect(screen.getByText("Escaneie o QR de novo.")).toBeTruthy();
    expect(screen.getByText(/Rua Model/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Abrir a Central de avisos" }).getAttribute("href"),
    ).toBe("/app/ai/inbox");
  });

  it("sem avisos não há número e as duas abas dizem que está tudo em dia", () => {
    render(<AlertsBell />);
    expect(screen.queryByTestId("alerts-bell-count")).toBeNull();
    fireEvent.click(screen.getByTestId("alerts-bell"));
    expect(screen.getByText("Nenhuma notificação para você por enquanto.")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Central" }));
    expect(screen.getByText("Nenhum aviso em aberto.")).toBeTruthy();
  });

  it("Para você: o número soma as não lidas com a Central, e cada notificação traz os botões", () => {
    h.aberto = 1;
    h.itens = [{ id: "c", title: "Aviso da Central", body: null }];
    h.naoLidas = 2;
    h.pessoais = [
      {
        id: "n1",
        categoria: "lead_novo",
        titulo: "Novo lead: Maria Souza",
        corpo: "(11) 98888-7777 · Vendas › Novo",
        acoes: [
          { rotulo: "Abrir conversa", href: "/app/inbox?id=cv-1" },
          { rotulo: "Abrir no CRM", href: "/app/leads/ld-1" },
        ],
        tag: "lead:ld-1",
        lida_em: null,
        created_at: new Date().toISOString(),
      },
    ];
    render(<AlertsBell />);
    expect(screen.getByTestId("alerts-bell-count").textContent).toBe("3");
    fireEvent.click(screen.getByTestId("alerts-bell"));
    expect(screen.getByText("Novo lead: Maria Souza")).toBeTruthy();
    const crm = screen.getByRole("link", { name: "Abrir no CRM" });
    expect(crm.getAttribute("href")).toBe("/app/leads/ld-1");
    fireEvent.click(crm);
    expect(h.marcar).toHaveBeenCalledWith({ ids: ["n1"] });
  });

  it("marcar todas como lidas", () => {
    h.naoLidas = 1;
    h.pessoais = [
      {
        id: "n1",
        categoria: "mensagem",
        titulo: "Maria",
        corpo: "oi",
        acoes: [],
        tag: null,
        lida_em: null,
        created_at: new Date().toISOString(),
      },
    ];
    render(<AlertsBell />);
    fireEvent.click(screen.getByTestId("alerts-bell"));
    fireEvent.click(screen.getByRole("button", { name: /Marcar todas como lidas/ }));
    expect(h.marcar).toHaveBeenCalledWith({ todas: true });
  });

  it("mais avisos do que a prévia mostra: o link diz quantos são", () => {
    h.itens = Array.from({ length: 7 }, (_, i) => ({
      id: String(i),
      title: `Aviso ${i}`,
      body: null,
    }));
    h.aberto = 7;
    render(<AlertsBell />);
    fireEvent.click(screen.getByTestId("alerts-bell"));
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Ver os 7 avisos na Central" })).toBeTruthy();
  });
});
