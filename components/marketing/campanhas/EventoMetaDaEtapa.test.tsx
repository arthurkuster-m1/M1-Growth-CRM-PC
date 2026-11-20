import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const salvar = vi.fn(async () => ({ ok: true as const }));
vi.mock("@/app/actions/settings/regraMetaDaEtapa", () => ({
  salvarRegraMetaDaEtapa: (...a: unknown[]) => (salvar as (...x: unknown[]) => unknown)(...a),
}));
vi.mock("@/hooks/i18n/useT", () => ({ useT: () => (s: string) => s }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { EventoMetaDaEtapa } from "./EventoMetaDaEtapa";

const etapa = { id: "e1", name: "Qualificado", is_won: false, is_lost: false };

function montar(over: Partial<React.ComponentProps<typeof EventoMetaDaEtapa>> = {}) {
  const aoSalvar = vi.fn();
  render(
    <EventoMetaDaEtapa
      etapa={etapa}
      regra={null}
      personalizados={["AgendouVisita"]}
      conectada
      ligada
      podeEditar
      aoSalvar={aoSalvar}
      {...over}
    />,
  );
  return aoSalvar;
}

afterEach(() => {
  cleanup();
  salvar.mockClear();
});

describe("EventoMetaDaEtapa — o bloquinho Meta CAPI da etapa", () => {
  it("ligar sugere o evento pelo nome da etapa (Qualificado → QualifiedLead)", async () => {
    const aoSalvar = montar();
    fireEvent.click(screen.getByRole("switch"));
    await waitFor(() =>
      expect(salvar).toHaveBeenCalledWith({
        stage_id: "e1",
        enabled: true,
        meta_event: "QualifiedLead",
      }),
    );
    await waitFor(() => expect(aoSalvar).toHaveBeenCalled());
  });

  it("trocar o evento oferece os padrões e os personalizados já criados", async () => {
    montar({ regra: { stageId: "e1", enabled: true, metaEvent: "QualifiedLead" } });
    fireEvent.click(screen.getByLabelText("Evento enviado à Meta"));
    expect(screen.getByText(/LeadSubmitted/)).toBeTruthy();
    fireEvent.click(screen.getByText("AgendouVisita (personalizado)"));
    await waitFor(() =>
      expect(salvar).toHaveBeenCalledWith({
        stage_id: "e1",
        enabled: true,
        meta_event: "AgendouVisita",
      }),
    );
  });

  it("cria um evento personalizado novo e já o usa; nome inválido não salva", async () => {
    montar({ regra: { stageId: "e1", enabled: true, metaEvent: "QualifiedLead" } });
    fireEvent.click(screen.getByLabelText("Evento enviado à Meta"));
    fireEvent.click(screen.getByText("+ Criar evento personalizado…"));
    const campo = screen.getByLabelText("Nome do evento personalizado");
    fireEvent.change(campo, { target: { value: "1ruim" } });
    expect(
      (screen.getByRole("button", { name: "Criar e usar" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(campo, { target: { value: "VisitaMarcada" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar e usar" }));
    await waitFor(() =>
      expect(salvar).toHaveBeenCalledWith({
        stage_id: "e1",
        enabled: true,
        meta_event: "VisitaMarcada",
      }),
    );
  });

  it("etapa de ganho mostra a compra automática e etapa de perda diz que não envia", () => {
    montar({ etapa: { ...etapa, is_won: true } });
    expect(screen.getByText(/vende|venda sai sozinha/i)).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
    cleanup();
    montar({ etapa: { ...etapa, is_lost: true } });
    expect(screen.getByText(/perda não é conversão/)).toBeTruthy();
  });

  it("avisa onde conectar quando a Meta CAPI não está conectada; sem permissão, não edita", () => {
    montar({ conectada: false, podeEditar: false });
    expect(screen.getByRole("link", { name: /Conexões › Meta Ads/ })).toBeTruthy();
    expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(true);
  });
});
