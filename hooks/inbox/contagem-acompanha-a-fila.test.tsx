/**
 * Assumir, devolver, transferir, adiar, encerrar e arquivar uma conversa mexem nas abas e no
 * contador da Fila do menu NA HORA — não só no polling de 60s.
 *
 * Os números vêm de `["conversation-counts"]`, uma busca separada da lista. Estes hooks só
 * invalidavam a lista, então o número ficava velho até a próxima volta do relógio.
 */
import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/client", () => ({
  apiClient: { post: vi.fn(async () => ({ data: {} })), patch: vi.fn(async () => ({ data: {} })), delete: vi.fn(async () => ({ data: {} })) },
}));
vi.mock("@/components/feedback/ApiErrorToast", () => ({ showApiError: () => undefined }));

import { agendarRecargaDasConversas } from "./recargaDasConversas";
import { useClaimConversation } from "./useClaimConversation";
import { useReleaseConversation } from "./useReleaseConversation";
import { useCloseConversation, useArchiveConversation } from "./useCloseConversation";
import { useTransferConversation } from "./useTransferConversation";
import { useSnoozeConversation } from "./useSnoozeConversation";

function montar<T>(hook: () => T) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const spy = vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const r = renderHook(hook, { wrapper });
  return { qc, spy, r };
}
const contou = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.some(([f]) => JSON.stringify((f as { queryKey: unknown }).queryKey) === '["conversation-counts"]');

describe("a contagem acompanha a ação", () => {
  const casos: Array<[string, () => { mutate: (a: never) => void }, unknown]> = [
    ["assumir", useClaimConversation as never, { conversation_id: "c1" }],
    ["devolver à fila", useReleaseConversation as never, { conversation_id: "c1" }],
    ["encerrar", useCloseConversation as never, { conversation_id: "c1" }],
    ["arquivar", useArchiveConversation as never, { conversation_id: "c1" }],
    ["transferir", useTransferConversation as never, { conversation_id: "c1", to_user_id: "u2" }],
  ];
  for (const [nome, hook, args] of casos) {
    it(`${nome} invalida a contagem`, async () => {
      const { spy, r } = montar(hook);
      await act(async () => r.result.current.mutate(args as never));
      await waitFor(() => expect(contou(spy)).toBe(true));
    });
  }

  it("adiar invalida a contagem", async () => {
    const { spy, r } = montar(useSnoozeConversation as never);
    const m = r.result.current as unknown as Record<string, { mutate: (a: unknown) => void }>;
    const alvo = Object.values(m).find((v) => v && typeof v.mutate === "function");
    await act(async () => alvo?.mutate({ conversation_id: "c1", until: "2030-01-01T00:00:00Z" }));
    await waitFor(() => expect(contou(spy)).toBe(true));
  });

  it("evento do realtime também recarrega a contagem", async () => {
    const { qc, spy } = montar(() => null);
    agendarRecargaDasConversas(qc);
    await waitFor(() => expect(contou(spy)).toBe(true));
  });
});
