import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VerificarWhatsapp } from "./_verificar-whatsapp";

const post = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiClient: { post: (...a: unknown[]) => post(...a) } }));

afterEach(() => {
  cleanup();
  post.mockReset();
});

const CANAIS = [{ id: "s1", display_name: "Comercial", phone_number: "+5541900000000" }];
const contagem = { tem: 2, naoTem: 1, incerta: 1, pendente: 90 };

describe("VerificarWhatsapp", () => {
  it("repete em lotes até não sobrar ninguém e avisa a tela a cada volta", async () => {
    post
      .mockResolvedValueOnce({
        data: { verificadas: 40, tem: 30, nao_tem: 8, incerto: 2, restantes: 50 },
      })
      .mockResolvedValueOnce({
        data: { verificadas: 40, tem: 30, nao_tem: 8, incerto: 2, restantes: 10 },
      })
      .mockResolvedValueOnce({
        data: { verificadas: 10, tem: 8, nao_tem: 2, incerto: 0, restantes: 0 },
      });
    const aoTerminar = vi.fn(async () => undefined);
    render(
      <VerificarWhatsapp
        campanhaId="c1"
        canais={CANAIS}
        canalInicial="s1"
        contagem={contagem}
        aoTerminar={aoTerminar}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Verificar 90 empresas" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(3));
    expect(post.mock.calls[0]![1]).toEqual({
      action: "verify_whatsapp",
      id: "c1",
      channel_session_id: "s1",
    });
    await waitFor(() => expect(aoTerminar).toHaveBeenCalledTimes(3));
  });

  it("'tentar de novo as incertas' pede o refazer só na primeira volta", async () => {
    post.mockResolvedValue({
      data: { verificadas: 1, tem: 1, nao_tem: 0, incerto: 0, restantes: 0 },
    });
    render(
      <VerificarWhatsapp
        campanhaId="c1"
        canais={CANAIS}
        canalInicial="s1"
        contagem={contagem}
        aoTerminar={async () => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Tentar de novo as incertas/ }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]![1]).toMatchObject({ refazer_incertas: true });
  });

  it("sem conexão WAHA, explica o que fazer em vez de mostrar um botão que não funciona", () => {
    render(
      <VerificarWhatsapp
        campanhaId="c1"
        canais={[]}
        canalInicial=""
        contagem={contagem}
        aoTerminar={async () => undefined}
      />,
    );
    expect(screen.getByText(/conecte um número de WhatsApp comum/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("mostra a falha da verificação sem travar o botão", async () => {
    post.mockRejectedValue(new Error("O serviço de WhatsApp não está configurado."));
    render(
      <VerificarWhatsapp
        campanhaId="c1"
        canais={CANAIS}
        canalInicial="s1"
        contagem={contagem}
        aoTerminar={async () => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Verificar 90 empresas" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/não está configurado/),
    );
    expect(screen.getByRole("button", { name: "Verificar 90 empresas" })).toBeEnabled();
  });
});
