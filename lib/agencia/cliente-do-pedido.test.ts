import { beforeEach, describe, expect, it, vi } from "vitest";

const cab = new Map<string, string>();
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => cab.get(k.toLowerCase()) ?? null }) }));

import type { UserOrgMembership } from "@/lib/auth/types";

import { clienteDoPedido } from "./cliente-do-pedido";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const m = (id: string, role: UserOrgMembership["role"]) =>
  ({ organization_id: id, organization_name: id, role }) as UserOrgMembership;

beforeEach(() => cab.clear());

describe("cliente do pedido (modo agência)", () => {
  it("sem header, não troca nada", async () => {
    expect(await clienteDoPedido([m(A, "admin")])).toBeNull();
  });
  it("aceita só organização de que a pessoa é manager ou admin", async () => {
    cab.set("x-agencia-cliente", B);
    expect(await clienteDoPedido([m(A, "admin"), m(B, "manager")])).toBe(B);
    expect(await clienteDoPedido([m(A, "admin"), m(B, "agent")])).toBeNull();
    expect(await clienteDoPedido([m(A, "admin")])).toBeNull();
  });
  it("id forjado ou que não é uuid não vale", async () => {
    cab.set("x-agencia-cliente", C);
    expect(await clienteDoPedido([m(A, "admin"), m(B, "admin")])).toBeNull();
    cab.set("x-agencia-cliente", "../etc");
    expect(await clienteDoPedido([m(A, "admin")])).toBeNull();
  });
});
