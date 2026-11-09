import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";

import type { PreferenciasDaTabela } from "@/lib/motor/layout";
import type { EmpresaDoResumo } from "@/hooks/useResumoDasEmpresas";

const linhas: EmpresaDoResumo[] = [
  {
    id: "bbbbbbbb-0000-4000-8000-000000000001",
    slug: "acme",
    nome: "Acme Brasil",
    razao_social: null,
    cnpj: null,
    situacao: "active",
    cor: "#366d6f",
    usuarios_ativos: 3,
    campanhas_ativas: 2,
    investimento_cents: 150000,
    leads: 40,
    vendas: 4,
    faturamento_cents: 800000,
    entrada: "2026-01-03",
    mensalidade: "pago",
    proximo_pagamento: "2026-12-05",
    lead_id: null,
    lead_titulo: null,
  },
  {
    id: "cccccccc-0000-4000-8000-000000000002",
    slug: "beta",
    nome: "Beta Clinic",
    razao_social: null,
    cnpj: null,
    situacao: "suspended",
    cor: null,
    usuarios_ativos: 1,
    campanhas_ativas: 0,
    investimento_cents: 0,
    leads: 0,
    vendas: 0,
    faturamento_cents: 0,
    entrada: "2026-02-01",
    mensalidade: "pendente",
    proximo_pagamento: null,
    lead_id: null,
    lead_titulo: null,
  },
];

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/i18n/useLocaleDeData", () => ({ useTagDeIdioma: () => "pt-BR" }));
vi.mock("@/hooks/useResumoDasEmpresas", () => ({
  useResumoDasEmpresas: () => ({ data: { linhas, migracaoPendente: false }, isLoading: false }),
}));
// As preferências por chave (tabela, cartões, visão) vivem em memória, como no servidor.
const memoria = vi.hoisted(() => new Map<string, unknown>());
vi.mock("@/hooks/motor/useVisualizacao", () => ({
  useVisualizacao: (chave: string) => {
    const [, forcar] = useState(0);
    return {
      preferencias: (memoria.get(chave) ?? {}) as PreferenciasDaTabela,
      carregando: false,
      atualizar: (f: (p: PreferenciasDaTabela) => PreferenciasDaTabela) => {
        memoria.set(chave, f((memoria.get(chave) ?? {}) as PreferenciasDaTabela));
        forcar((n) => n + 1);
      },
    };
  },
}));

import { EmpresasDoModoAgencia } from "./EmpresasDoModoAgencia";

// O jsdom não implementa matchMedia (a tabela escolhe cartões no celular).
window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as unknown as typeof window.matchMedia;

beforeEach(() => memoria.clear());

describe("EmpresasDoModoAgencia", () => {
  it("abre em tabela, com o botão Abrir no nome e as colunas do pedido", () => {
    render(<EmpresasDoModoAgencia />);
    const tabela = screen.getByRole("table", { name: "Empresas" });
    for (const titulo of [
      "Slug",
      "Situação",
      "Usuários ativos",
      "Campanhas ativas",
      "Investimento em marketing",
      "Leads",
      "Vendas",
      "Faturamento",
      "Data de entrada",
      "Status da mensalidade",
      "Próximo pagamento",
    ]) {
      expect(within(tabela).getAllByText(titulo).length).toBeGreaterThan(0);
    }
    const abrir = within(tabela).getAllByRole("link", { name: "Abrir" });
    expect(abrir[0]?.getAttribute("href")).toBe(
      "/admin/tenants/bbbbbbbb-0000-4000-8000-000000000001",
    );
    expect(within(tabela).getByText("Pago")).toBeTruthy();
    expect(within(tabela).getByText("Pendente")).toBeTruthy();
  });

  it("alterna para Cartões, e as propriedades de uma visão não mexem na outra", () => {
    render(<EmpresasDoModoAgencia />);
    // O tipo (tabela/cartões) é configurado dentro da visualização, no painel da pílula.
    fireEvent.click(screen.getByRole("button", { name: "Configurar visualização" }));
    fireEvent.click(screen.getByRole("radio", { name: "Cartões" }));
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByRole("link", { name: "Abrir" })).toHaveLength(2);

    // Nos cartões o padrão não mostra "Slug"; ligo e confiro que a tabela não ganhou/perdeu nada.
    fireEvent.click(screen.getByRole("checkbox", { name: "Slug" }));
    expect(memoria.get("admin-empresas-cards")).toMatchObject({ visiveis: { slug: true } });
    expect(memoria.get("admin-empresas-tabela")).toBeUndefined();
  });
});
