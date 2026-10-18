import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({ apiClient: { get: vi.fn() } }));

import { apiClient } from "@/lib/api/client";
import { useRadarDasOportunidades } from "./useRadarDasOportunidades";

describe("useRadarDasOportunidades", () => {
  it("devolve o balde de risco por oportunidade, lido da mesma rota do radar (até 500)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        items: [
          { id: "lead-1", risk: "critico" },
          { id: "lead-2", risk: "em_voo" },
        ],
      },
    });
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRadarDasOportunidades(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/leads/at-risk?limit=500");
    expect(result.current.data!.get("lead-1")).toBe("critico");
    expect(result.current.data!.get("lead-2")).toBe("em_voo");
    // Quem não está na lista está em dia: a rota só devolve quem saiu do "em dia".
    expect(result.current.data!.get("lead-3")).toBeUndefined();
  });
});
