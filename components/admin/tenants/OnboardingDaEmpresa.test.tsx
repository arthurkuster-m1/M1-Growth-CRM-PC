import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type { TenantOrganization } from "@/hooks/useTenantDetail";

const mutate = vi.fn();
vi.mock("@/hooks/useUpdateTenant", () => ({ useUpdateTenant: () => ({ mutate }) }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/hooks/i18n/useLocaleDeData", () => ({ useTagDeIdioma: () => "pt-BR" }));

import { OnboardingDaEmpresa } from "./OnboardingDaEmpresa";

const ORG = {
  id: "bbbbbbbb-0000-4000-8000-000000000001",
  display_name: "Acme",
  timezone: "America/Sao_Paulo",
  onboarded_at: null,
  onboarding_state: { welcome: { accepted_at: "2026-11-01T12:00:00Z", o_que_faz: "Clínica" } },
} as unknown as TenantOrganization;

beforeEach(() => mutate.mockClear());

describe("OnboardingDaEmpresa", () => {
  it("mostra os campos do onboarding e o aceite dos termos", () => {
    render(<OnboardingDaEmpresa org={ORG} />);
    expect((screen.getByLabelText("O que a empresa faz") as HTMLInputElement).value).toBe(
      "Clínica",
    );
    expect(screen.getByText("America/Sao_Paulo")).toBeTruthy();
    expect(screen.queryByText("—")).toBeNull();
  });

  it("editar 'o que faz' salva só esse campo, guardando o anterior para o Ctrl+Z", () => {
    render(<OnboardingDaEmpresa org={ORG} />);
    const campo = screen.getByLabelText("O que a empresa faz");
    fireEvent.change(campo, { target: { value: "Clínica odontológica" } });
    fireEvent.blur(campo);
    expect(mutate.mock.calls[0]?.[0]).toMatchObject({
      patch: { onboarding: { o_que_faz: "Clínica odontológica" } },
      anterior: { onboarding: { o_que_faz: "Clínica" } },
    });
  });

  it("finalizar pede confirmação e então grava onboarded_at (com como desfazer)", () => {
    render(<OnboardingDaEmpresa org={ORG} />);
    fireEvent.click(screen.getByRole("button", { name: "Finalizar onboarding" }));
    expect(mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    const chamada = mutate.mock.calls[0]?.[0];
    expect(chamada.patch.onboarded_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(chamada.anterior).toEqual({ onboarded_at: null });
  });

  it("cancelar a confirmação não grava; já finalizado não oferece o botão", () => {
    const { rerender } = render(<OnboardingDaEmpresa org={ORG} />);
    fireEvent.click(screen.getByRole("button", { name: "Finalizar onboarding" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(mutate).not.toHaveBeenCalled();
    rerender(<OnboardingDaEmpresa org={{ ...ORG, onboarded_at: "2026-11-02T10:00:00Z" }} />);
    expect(screen.queryByRole("button", { name: "Finalizar onboarding" })).toBeNull();
    expect(screen.getByText("Onboarding finalizado")).toBeTruthy();
  });
});
