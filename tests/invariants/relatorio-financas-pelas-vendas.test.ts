import { describe, expect, it } from "vitest";

import { sql } from "./gov-helpers";

/**
 * FINANÇAS PELAS VENDAS (migration 0672).
 *
 * `fn_relatorio_financas` agrega as parcelas recebidas/previstas das oportunidades, e não
 * comandas. Como a antiga, é INVOKER: o escopo é a RLS de cada tabela, e a rota resolve a
 * organização do lado confiável. Estes casos prendem a exposição — a conta em si é lida
 * na tela (`faturamento-cada-moeda-no-seu-bloco.test.tsx`).
 */
describe("fn_relatorio_financas — exposição", () => {
  it("é SECURITY INVOKER", () => {
    const linha = sql(`
      select p.prosecdef
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'fn_relatorio_financas';
    `);
    expect(linha).toBe("f");
  });

  it("não é alcançável pela anon key, e é por quem tem sessão", () => {
    const assinatura = "public.fn_relatorio_financas(uuid,date,date)";
    expect(sql(`select has_function_privilege('anon', '${assinatura}', 'EXECUTE');`)).toBe("f");
    expect(sql(`select has_function_privilege('authenticated', '${assinatura}', 'EXECUTE');`)).toBe(
      "t",
    );
  });
});
