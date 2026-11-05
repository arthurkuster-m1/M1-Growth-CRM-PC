import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { AdminTenantRow } from "@/hooks/useAdminTenants";

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/i18n/useLocaleDeData", () => ({ useTagDeIdioma: () => "pt-BR" }));

import { TenantsTable } from "./TenantsTable";

const linha = (extra: Partial<AdminTenantRow>): AdminTenantRow => ({
  id: "bbbbbbbb-0000-4000-8000-000000000001",
  slug: "acme",
  display_name: "Acme Brasil",
  legal_name: null,
  cnpj: null,
  status: "active",
  onboarded_at: "2026-01-02T00:00:00Z",
  suspended_at: null,
  created_at: "2026-01-01T00:00:00Z",
  cor_agencia: null,
  cor_marca: "#366d6f",
  user_count: [{ count: 1 }],
  conversations_count: [{ count: 12 }],
  ...extra,
});

describe("TenantsTable (cartões)", () => {
  it("cada empresa é um link para a ficha, com iniciais na cor da marca e contagens", () => {
    render(
      <TenantsTable
        data={[linha({})]}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={() => {}}
      />,
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/admin/tenants/bbbbbbbb-0000-4000-8000-000000000001");
    const iniciais = screen.getByText("AB");
    expect(iniciais.style.backgroundColor).toBe("rgb(54, 109, 111)");
    expect(screen.getByText(/1 pessoa ·/)).toBeTruthy();
    expect(screen.getByText("Ativo")).toBeTruthy();
  });

  it("ativo sem onboarding concluído aparece como Onboarding; suspensa como Suspenso", () => {
    render(
      <TenantsTable
        data={[
          linha({ onboarded_at: null }),
          linha({ id: "cccccccc-0000-4000-8000-000000000002", status: "suspended" }),
        ]}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={() => {}}
      />,
    );
    expect(screen.getByText("Onboarding")).toBeTruthy();
    expect(screen.getByText("Suspenso")).toBeTruthy();
  });

  it("sem empresas mostra o vazio", () => {
    render(
      <TenantsTable
        data={[]}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={() => {}}
      />,
    );
    expect(screen.getByText("Nenhuma empresa encontrada")).toBeTruthy();
  });
});
