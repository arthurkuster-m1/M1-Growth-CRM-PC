/**
 * TODA TELA DO ADMINISTRADOR DA INSTALAÇÃO TEM PORTA NO MENU DELE.
 *
 * `navegacao-completude.test.ts` cobre só `app/app/**` (a navegação do tenant); o
 * menu do administrador era a lista `NAV_ITEMS` do antigo `AdminSidebar` (hoje: `lib/agencia/menu.ts`),
 * e nada o vigiava. Foi assim que `/admin/modulos` nasceu sem porta no PR #1578: as
 * rotas de honorários mandavam o operador instalar o módulo "em Módulos", e só se
 * chegava lá digitando a URL.
 *
 * O recorte é o primeiro nível de `app/admin/(protected)/`: é ali que mora cada
 * tela do menu. Subpáginas (`tenants/new`, `audit/[entryId]`) são alcançadas de
 * dentro da tela-mãe, não do menu.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = join(process.cwd(), "app", "admin", "(protected)");
// O menu do admin é o do Modo agência (`lib/agencia/menu.ts`) + a página Configurações
// (`lib/admin/configuracoes.ts`), que lista as telas de configuração da instalação.
const MENU = ["lib/agencia/menu.ts", "lib/admin/configuracoes.ts"]
  .map((f) => readFileSync(join(process.cwd(), f), "utf8"))
  .join("\n");

/** Telas que o dono tirou do menu em 04/11/2026 (Inbox, Extensões, Destinos internos): continuam
 * existindo, sem porta. Entrada nova aqui exige decisão do dono — não é atalho para esconder tela. */
const SEM_PORTA_POR_DECISAO = new Set(["/admin/inbox", "/admin/extensoes", "/admin/destinos-internos"]);

function telasDoPrimeiroNivel(): string[] {
  return readdirSync(RAIZ, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("[") && !d.name.startsWith("("))
    .filter((d) => existsSync(join(RAIZ, d.name, "page.tsx")))
    .map((d) => `/admin/${d.name}`)
    .sort();
}

describe("menu do administrador da instalação", () => {
  it("o instrumento enxerga as telas (controle: /admin/dashboard existe e tem porta)", () => {
    expect(telasDoPrimeiroNivel()).toContain("/admin/dashboard");
    expect(MENU).toContain('href: "/admin/dashboard"');
    expect(MENU).toContain("ROTA_DAS_CONFIGURACOES");
  });

  it("toda tela de primeiro nível tem uma entrada no menu", () => {
    const semPorta = telasDoPrimeiroNivel().filter((href) => !SEM_PORTA_POR_DECISAO.has(href))
      .filter((href) => !MENU.includes(`href: "${href}"`) && href !== "/admin/ajustes");
    expect(
      semPorta,
      "tela do administrador sem porta no menu: acrescente-a a lib/admin/configuracoes.ts (ou ao menu em lib/agencia/menu.ts)",
    ).toEqual([]);
  });
});
