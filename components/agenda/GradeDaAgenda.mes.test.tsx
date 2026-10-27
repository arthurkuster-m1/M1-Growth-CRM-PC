/**
 * A visão MÊS: ocupação do Google fora de 07h–18h não aparece, tudo em ordem cronológica, clicar
 * numa faixa abre o compromisso e duplo clique num dia cria um compromisso nele.
 * (Pedido de 26/10/2026, depois de ver a célula cheia de "05:00 Ocupado".)
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const avisar = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { message: avisar, success: vi.fn(), error: vi.fn() } }));

import { GradeDaAgenda, doDiaNoMes } from "./GradeDaAgenda";
import type { Agendamento } from "./tipos";

const FUSO = "America/Sao_Paulo";
const AGORA = new Date("2026-10-25T15:00:00Z"); // 12:00 em São Paulo
const dia = new Date(2026, 9, 23, 12); // 23/10

const ag = (id: string, hora: number, origem: Agendamento["origem"], titulo = id): Agendamento => ({
  id,
  titulo,
  responsavelId: "u1",
  comeca: `2026-10-23T${String(hora + 3).padStart(2, "0")}:00:00Z`, // hora local = hora (UTC-3)
  termina: `2026-10-23T${String(hora + 4).padStart(2, "0")}:00:00Z`,
  origem,
  situacao: "confirmed",
});

describe("doDiaNoMes", () => {
  const lista = [
    ag("nove", 9, "ui"),
    ag("cinco", 5, "google_sync"),
    ag("cinco-e-40", 5, "google_sync"),
    ag("meio-dia-google", 12, "google_sync"),
    ag("seis-nosso", 6, "ui"),
    ag("dezoito-google", 18, "google_sync"),
    ag("dezessete-google", 17, "google_sync"),
  ];

  it("esconde só a ocupação do Google fora de 07h–18h; compromisso nosso aparece a qualquer hora", () => {
    const ids = doDiaNoMes(lista, dia, FUSO).map((c) => c.id);
    expect(ids).not.toContain("cinco");
    expect(ids).not.toContain("cinco-e-40");
    expect(ids).not.toContain("dezoito-google"); // 18:00 já é fora (a janela é 07:00–17:59)
    expect(ids).toContain("seis-nosso");
    expect(ids).toContain("meio-dia-google");
    expect(ids).toContain("dezessete-google");
  });

  it("vem em ordem cronológica (o das 9h nunca antes do das 6h)", () => {
    const ids = doDiaNoMes(lista, dia, FUSO).map((c) => c.id);
    expect(ids).toEqual(["seis-nosso", "nove", "meio-dia-google", "dezessete-google"]);
  });
});

function mes(extra: Partial<React.ComponentProps<typeof GradeDaAgenda>> = {}) {
  return render(
    <GradeDaAgenda
      visao="mes"
      ancora={new Date(2026, 9, 25, 12)}
      agora={AGORA}
      fuso={FUSO}
      agendamentos={[ag("a1", 9, "ui", "Reunião")]}
      pessoas={[]}
      {...extra}
    />,
  );
}

describe("visão mês — interação", () => {
  it("clicar na faixa abre o compromisso", () => {
    const abrir = vi.fn();
    mes({ onAbrirAgendamento: abrir });
    fireEvent.click(screen.getByTestId("chip-mes-a1"));
    expect(abrir).toHaveBeenCalledWith("a1");
  });

  it("a ocupação do Google não abre", () => {
    const abrir = vi.fn();
    mes({ onAbrirAgendamento: abrir, agendamentos: [ag("g1", 10, "google_sync", "Ocupado")] });
    fireEvent.click(screen.getByTestId("chip-mes-g1"));
    expect(abrir).not.toHaveBeenCalled();
  });

  it("duplo clique num dia futuro cria o compromisso nele, às 9h", () => {
    const marcar = vi.fn();
    mes({
      interacao: {
        horariosPorDia: {},
        motivo: null,
        duracaoMin: 30,
        onMarcarEm: marcar,
      },
    });
    fireEvent.doubleClick(screen.getByTestId("celula-mes-2026-10-28"));
    expect(marcar).toHaveBeenCalledWith("2026-10-28T12:00:00.000Z"); // 09:00 em UTC-3
  });

  it("dia que já passou não cria compromisso", () => {
    const marcar = vi.fn();
    mes({ interacao: { horariosPorDia: {}, motivo: null, duracaoMin: 30, onMarcarEm: marcar } });
    fireEvent.doubleClick(screen.getByTestId("celula-mes-2026-10-20"));
    expect(marcar).not.toHaveBeenCalled();
    // E o app diz por quê, em vez de parecer que o duplo clique quebrou.
    expect(avisar).toHaveBeenCalledWith("Não é possível agendar em um dia que já passou.");
  });

  it("duplo clique numa faixa não cria compromisso por baixo", () => {
    const marcar = vi.fn();
    mes({
      onAbrirAgendamento: () => undefined,
      interacao: { horariosPorDia: {}, motivo: null, duracaoMin: 30, onMarcarEm: marcar },
      agendamentos: [ag("a1", 9, "ui", "Reunião")],
    });
    fireEvent.doubleClick(screen.getByTestId("chip-mes-a1"));
    expect(marcar).not.toHaveBeenCalled();
  });

  it("sem interação (quem só lê), duplo clique não faz nada", () => {
    mes();
    expect(() => fireEvent.doubleClick(screen.getByTestId("celula-mes-2026-10-28"))).not.toThrow();
  });
});

describe("painel do dia no mês", () => {
  it("tocar num dia abre embaixo os compromissos dele, com as propriedades padrão", () => {
    mes();
    fireEvent.click(screen.getByTestId("celula-mes-2026-10-23"));
    const painel = screen.getByTestId("painel-do-dia");
    expect(painel.dataset.dia).toBe("2026-10-23");
    expect(painel.textContent).toContain("Reunião");
    // padrão: horário e status, sem nenhuma busca extra
    expect(painel.textContent).toContain("Confirmado");
  });

  it("um dia sem compromisso diz isso", () => {
    mes();
    fireEvent.click(screen.getByTestId("celula-mes-2026-10-20"));
    expect(screen.getByTestId("painel-do-dia").textContent).toContain("Nenhum compromisso");
  });
});
