import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({ mutate: vi.fn(), get: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));

vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("@/lib/i18n/IdiomaProvider", () => ({ useIdioma: () => "pt-BR" }));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: vi.fn() }));
vi.mock("@/components/team/InterfaceEditor", () => ({ InterfaceEditor: () => null }));
vi.mock("@/hooks/useCreateTenant", () => ({
  useCreateTenant: () => ({ mutate: h.mutate, isPending: false }),
}));
vi.mock("@/lib/api/client", () => ({ apiClient: { get: h.get } }));

import { NovaEmpresaDialog } from "./NovaEmpresaDialog";

const LEAD = {
  id: "11111111-0000-4000-8000-000000000001",
  title: "Clínica Aurora",
  status: "won",
  contact_name: "Dra. Aurora",
  contact_email: "aurora@clinica.com",
};

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NovaEmpresaDialog aberto aoFechar={() => {}} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.get.mockResolvedValue({ data: { agencia: { id: "a", name: "Assessoria M1" }, leads: [LEAD] } });
});

describe("NovaEmpresaDialog", () => {
  it("pede só nome, slug, e-mail do dono, lead e interface; o slug sai do nome", () => {
    montar();
    expect(screen.getByLabelText(/Nome da empresa/)).toBeTruthy();
    expect(screen.getByLabelText(/Identificador/)).toBeTruthy();
    expect(screen.getByLabelText(/E-mail do dono/)).toBeTruthy();
    expect(screen.getByLabelText(/Lead no CRM da agência/)).toBeTruthy();
    expect(screen.queryByText("Plano")).toBeNull();
    fireEvent.change(screen.getByLabelText(/Nome da empresa/), {
      target: { value: "Loja da Maria" },
    });
    expect((screen.getByLabelText(/Identificador/) as HTMLInputElement).value).toBe(
      "loja-da-maria",
    );
  });

  it("escolher o lead espelha nome e e-mail nos campos vazios e envia o vínculo", async () => {
    montar();
    fireEvent.click(await screen.findByRole("button", { name: /Clínica Aurora/ }));
    expect((screen.getByLabelText(/Nome da empresa/) as HTMLInputElement).value).toBe(
      "Clínica Aurora",
    );
    expect((screen.getByLabelText(/Identificador/) as HTMLInputElement).value).toBe(
      "clinica-aurora",
    );
    expect((screen.getByLabelText(/E-mail do dono/) as HTMLInputElement).value).toBe(
      "aurora@clinica.com",
    );

    fireEvent.click(screen.getByRole("button", { name: "Criar empresa" }));
    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(h.mutate.mock.calls[0]?.[0]).toMatchObject({
      display_name: "Clínica Aurora",
      slug: "clinica-aurora",
      owner_email: "aurora@clinica.com",
      agencia_lead_id: LEAD.id,
    });
  });

  it("não sobrescreve o que a pessoa já digitou, e sem os 3 campos o botão fica desligado", async () => {
    montar();
    const criar = screen.getByRole("button", { name: "Criar empresa" }) as HTMLButtonElement;
    expect(criar.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Nome da empresa/), { target: { value: "Meu Nome" } });
    fireEvent.change(screen.getByLabelText(/E-mail do dono/), { target: { value: "eu@x.com" } });
    fireEvent.click(await screen.findByRole("button", { name: /Clínica Aurora/ }));
    expect((screen.getByLabelText(/Nome da empresa/) as HTMLInputElement).value).toBe("Meu Nome");
    expect((screen.getByLabelText(/E-mail do dono/) as HTMLInputElement).value).toBe("eu@x.com");
  });

  it("criada a empresa, atualiza o que veio do servidor (seletor e trocador de empresas)", async () => {
    montar();
    fireEvent.click(await screen.findByRole("button", { name: /Clínica Aurora/ }));
    fireEvent.click(screen.getByRole("button", { name: "Criar empresa" }));
    await waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1));
    expect(h.refresh).not.toHaveBeenCalled();
    h.mutate.mock.calls[0]?.[1].onSuccess({
      data: {
        id: "x",
        slug: "clinica-aurora",
        display_name: "Clínica Aurora",
        owner_invitation: null,
      },
    });
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });
});
