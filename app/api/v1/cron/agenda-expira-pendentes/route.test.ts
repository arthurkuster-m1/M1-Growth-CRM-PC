/**
 * A expiração automática do pedido não confirmado está DESLIGADA: soltar o horário é ato manual do
 * atendente. A rota só autentica e responde que não fez nada — não lê nem cancela compromisso, e não
 * audita (rodada sem efeito não audita).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/env", () => ({ env: { INTERNAL_SECRET: "segredo", INTERNAL_CRON_SECRET: "" } }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

const req = (auth?: string) =>
  new NextRequest("http://localhost/x", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => vi.clearAllMocks());

describe("agenda-expira-pendentes (desligada)", () => {
  it("com o segredo: não toca em compromisso nenhum e não audita", async () => {
    const res = await GET(req("Bearer segredo"));
    expect(res.status).toBe(200);
    const corpo = await res.json();
    expect(corpo.data).toMatchObject({ expirados: 0, desativado: true });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("sem o segredo, 403", async () => {
    const res = await GET(req());
    expect(res.status).toBe(403);
  });
});
