import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { TenantCounts, TenantOrganization } from "@/hooks/useTenantDetail";

const mutate = vi.fn();
vi.mock("@/hooks/useUpdateTenant", () => ({ useUpdateTenant: () => ({ mutate }) }));
vi.mock("@/hooks/motor/useAtalhoDesfazer", () => ({ useAtalhoDesfazer: () => undefined }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/i18n/useLocaleDeData", () => ({ useTagDeIdioma: () => "pt-BR" }));

import { FichaDaEmpresa } from "./FichaDaEmpresa";

const ORG: TenantOrganization = {
  id: "bbbbbbbb-0000-4000-8000-000000000001",
  slug: "acme",
  display_name: "Acme",
  legal_name: "Acme Ltda",
  cnpj: null,
  status: "active",
  timezone: "America/Sao_Paulo",
  locale: "pt-BR",
  currency: "BRL",
  country: "BR",
  dpo_email: null,
  privacy_policy_url: null,
  ai_budget_cents: 5000,
  media_retention_days: 365,
  interface_settings: { preset: "completa" },
  onboarded_at: null,
  suspended_at: null,
  suspended_reason: null,
  agencia_lead_id: null,
  onboarding_state: null,
  created_at: "2026-01-01T00:00:00Z",
  settings: {},
};
const COUNTS: TenantCounts = {
  user_count: 1,
  conversations_count: 2,
  messages_count: 3,
  leads_count: 4,
  orders_count: 5,
  vendas_pagas: 2,
  lgpd_requests_pending: 0,
  ai_invocations_30d: 0,
  waha_sessions_count: 0,
};

beforeEach(() => {
  mutate.mockClear();
  window.localStorage.clear();
});

describe("FichaDaEmpresa", () => {
  it("não oferece Plano nem Nuvemshop, e o slug é só leitura", () => {
    render(<FichaDaEmpresa organization={ORG} counts={COUNTS} />);
    expect(screen.queryByText("Plano")).toBeNull();
    expect(screen.queryByText(/nuvemshop/i)).toBeNull();
    expect(screen.getByText("acme").tagName).toBe("CODE");
    expect(screen.queryByLabelText("Identificador (slug)")).toBeNull();
  });

  it("sair do campo com valor novo salva só o campo, guardando o anterior para o Ctrl+Z", () => {
    render(<FichaDaEmpresa organization={ORG} counts={COUNTS} />);
    const campo = screen.getByLabelText("Nome");
    fireEvent.change(campo, { target: { value: "Acme Brasil" } });
    fireEvent.blur(campo);
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      patch: { display_name: "Acme Brasil" },
      anterior: { display_name: "Acme" },
    });
  });

  it("sair do campo sem mudar não salva; nome vazio volta ao valor", () => {
    render(<FichaDaEmpresa organization={ORG} counts={COUNTS} />);
    const campo = screen.getByLabelText("Nome") as HTMLInputElement;
    fireEvent.blur(campo);
    fireEvent.change(campo, { target: { value: "  " } });
    fireEvent.blur(campo);
    expect(mutate).not.toHaveBeenCalled();
    expect(campo.value).toBe("Acme");
  });

  it("orçamento de IA vai em centavos; vazio vira sem limite (null)", () => {
    render(<FichaDaEmpresa organization={ORG} counts={COUNTS} />);
    const campo = screen.getByLabelText("Orçamento mensal de IA");
    fireEvent.change(campo, { target: { value: "75,5" } });
    fireEvent.blur(campo);
    expect(mutate.mock.calls[0]?.[0].patch).toEqual({ ai_budget_cents: 7550 });
    fireEvent.change(campo, { target: { value: "" } });
    fireEvent.blur(campo);
    expect(mutate.mock.calls[1]?.[0].patch).toEqual({ ai_budget_cents: null });
  });
});
