/**
 * A PÁGINA DA VENDA (`modo="venda"`): só título, status, produtos, pagamento e anotações. O que é da
 * oportunidade (funil, cliente, origem, previsão, detalhes) fica na página dela.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: vi.fn(async () => ({ data: [] })),
    put: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/app/clientes",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { is_platform_admin: false }, activeOrg: { orgId: "org-1", role: "admin" } }),
  usePermission: () => true,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

import { DialogoDaVenda } from "./DialogoDaVenda";
import type { Venda } from "@/lib/vendas";

const venda = {
  id: "lead-1",
  lead_id: "lead-1",
  contact_id: "c-1",
  name: "Reforma do apartamento 402",
  product_name: "Reforma",
  amount_cents: 1_250_000,
  currency: "BRL",
  status: "interesse",
  notes: "Cliente quer começar em dezembro",
  itens: [],
  parcelas: [],
  cliente: { nome: "Ana Souza", telefone: null },
  funil: "Prospecção",
  etapa: "Reunião agendada",
} as unknown as Venda;

function abrir(modo: "venda" | "oportunidade") {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <DialogoDaVenda
        venda={venda}
        modo={modo}
        contatoInicial={{ contact_id: "c-1", nome: "Ana Souza" }}
        clientes={[]}
        aoFechar={() => undefined}
        aoSalvar={async () => true}
      />
    </QueryClientProvider>,
  );
}

afterEach(cleanup);

describe("página da venda × página da oportunidade", () => {
  it("modo venda: título, status, produtos, pagamento e anotações — e nada da oportunidade", () => {
    abrir("venda");
    expect(screen.getByLabelText("Título da oportunidade")).toBeTruthy();
    expect(screen.getByText("Status da venda")).toBeTruthy();
    expect(screen.getByText("Produtos e ticket médio")).toBeTruthy();
    expect(screen.getByText("Pagamento")).toBeTruthy();
    expect(screen.getByText("Anotações da oportunidade")).toBeTruthy();
    // o que é da oportunidade não aparece
    expect(screen.queryByText("Cliente, funil e status")).toBeNull();
    expect(screen.queryByText("Origem")).toBeNull();
    expect(screen.queryByText("Detalhes da oportunidade")).toBeNull();
    expect(screen.queryByText("Previsão de fechamento")).toBeNull();
    expect(screen.queryByLabelText("Lembrete")).toBeNull();
  });

  it("as anotações da venda são as da oportunidade (o mesmo dado)", () => {
    abrir("venda");
    expect((screen.getByLabelText("Anotações da oportunidade") as HTMLTextAreaElement).value).toBe(
      "Cliente quer começar em dezembro",
    );
  });

  it("a parcela única já nasce gerada, com valor e vencimento, sem apertar nada", () => {
    abrir("venda");
    expect(screen.getByLabelText("Valor da parcela 1")).toHaveValue("12500,00");
    expect(screen.getByLabelText("Vencimento da parcela 1")).toBeTruthy();
    expect(screen.getByLabelText("Parcela recebida 1")).toBeTruthy();
  });

  it("abrir uma venda existente não põe o foco no título (não levanta o teclado)", () => {
    abrir("venda");
    expect(document.activeElement).not.toBe(screen.getByLabelText("Título da oportunidade"));
    expect(document.activeElement?.tagName).not.toBe("INPUT");
  });

  it("modo oportunidade continua com a página completa", () => {
    abrir("oportunidade");
    // a ordem pedida: título, cliente, funil, responsável, compromissos, tarefas, previsão…
    const ordem = [
      "Funil e status",
      "Responsável",
      "Próximos passos",
      "Compromissos",
      "Tarefas",
      "Previsão de fechamento",
      "Produtos e serviços",
      "Comentários",
      "Detalhes da oportunidade",
    ].map((t) => screen.getByText(t));
    for (let i = 1; i < ordem.length; i++) {
      expect(
        ordem[i - 1]!.compareDocumentPosition(ordem[i]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.getByTestId("cliente-da-oportunidade")).toBeTruthy();
    expect(screen.getByTestId("numeros-da-oportunidade")).toBeTruthy();
    // lembrete e lixeira no cabeçalho; descrição e comentários são um bloco só
    expect(screen.getByLabelText("Lembrete")).toBeTruthy();
    expect(screen.getByLabelText("Apagar oportunidade")).toBeTruthy();
    expect(screen.queryByText("Descrição da oportunidade")).toBeNull();
    // o título editável fica em cima, nas duas páginas
    expect(screen.getByLabelText("Título da oportunidade")).toBeTruthy();
  });
});
