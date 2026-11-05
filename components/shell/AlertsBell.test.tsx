import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  itens: [] as Array<{ id: string; title: string; body: string | null }>,
  aberto: 0,
}));

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/notifications/useSonsDaCentral", () => ({ useSonsDaCentral: () => undefined }));
vi.mock("@/hooks/ai/useAgentInbox", () => ({
  useAgentInbox: () => ({ data: { items: h.itens, open_count: h.aberto } }),
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

  it("sem avisos não há número e a prévia diz que está tudo em dia", () => {
    render(<AlertsBell />);
    expect(screen.queryByTestId("alerts-bell-count")).toBeNull();
    fireEvent.click(screen.getByTestId("alerts-bell"));
    expect(screen.getByText("Nenhum aviso em aberto.")).toBeTruthy();
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
