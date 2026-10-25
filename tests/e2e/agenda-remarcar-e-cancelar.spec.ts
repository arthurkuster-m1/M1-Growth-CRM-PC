import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { test, expect } from "./helpers/test";

import { escolherDiaDesenhado, irParaASemanaSeguinte } from "./helpers/agenda-semana-integra";

/**
 * REMARCAR E CANCELAR PELA TELA — as duas ações que só a IA conseguia fazer.
 *
 * ─── O defeito que esta spec fecha ───────────────────────────────────────
 *
 * `HistoricoDaAgenda` aceita `onRemarcar`/`onCancelar` desde que nasceu, com
 * `disabled={!onRemarcar}` nos botões, e `_client.tsx` montava o componente com
 * QUATRO props e nenhuma callback. Os dois botões nasciam cinzas em toda linha,
 * de toda organização, para sempre.
 *
 * E o `title` do botão cinza dizia *"Disponível quando a agenda estiver
 * conectada"* — falso, e pior que o silêncio: `PATCH`/`DELETE
 * /api/v1/agenda/agendamentos" não tocam o Google. Quem lia acreditava que
 * faltava conectar a agenda, quando faltava a fiação.
 *
 * Medido antes de consertar: `grep -rn "cancelarAgendamentoHandler|
 * alterarAgendamentoHandler" app/ components/ hooks/` → zero em `components/`,
 * zero em `hooks/`, zero em qualquer `app/app/**`. Inbox, ficha de contato e de
 * lead incluídos.
 *
 * ─── Por que a primeira asserção é sobre estar HABILITADO ────────────────
 *
 * Porque é exatamente o estado que existia. Uma spec que só testasse o fluxo
 * feliz passaria a existir DEPOIS do conserto e nunca provaria que o botão
 * deixou de ser decorativo — e controle decorativo é um defeito que esta base
 * já pagou uma vez (PR #295, cinco deles).
 */

/**
 * ⚠️ SEM `APP_URL`: as navegações são RELATIVAS, e o `baseURL` do
 * `playwright.config.ts` resolve.
 *
 * Isto era `process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"`, e o
 * fallback é o defeito: **o CI não define `PLAYWRIGHT_BASE_URL`**. Local eu
 * exportava a variável, então passava; no runner a spec batia em `:3000`, onde
 * não há nada, e as seis caíam em bloco com `ERR_CONNECTION_REFUSED` — que se
 * parece com "o servidor morreu" e é "eu bati na porta errada".
 *
 * O log mostra o formato exato: `··········FFFFFF` — dez testes passam, os seis
 * meus caem juntos, e os seguintes voltam a passar. Servidor vivo o tempo todo.
 *
 * As irmãs já faziam certo de dois jeitos: `agenda-tela-do-produto` usa caminho
 * relativo, e `agente-marca-consulta` usa `E2E_PORT ?? 3001`. Nenhuma inventa
 * 3000.
 */
const RAIZ = path.resolve(__dirname, "../..");

interface Creds {
  password: string;
  users: Record<string, { email: string } | undefined>;
  agenda?: { tipo_nome: string; tipo_slug: string };
}

function lerCreds(): Creds {
  const p = path.join(RAIZ, ".e2e-creds.json");
  if (!fs.existsSync(p))
    throw new Error("`.e2e-creds.json` ausente — rode `scripts/seed-e2e-credentials.ts`");
  let c = JSON.parse(fs.readFileSync(p, "utf8")) as Creds;
  if (!c.agenda) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-agenda.ts"], { stdio: "inherit" });
    c = JSON.parse(fs.readFileSync(p, "utf8")) as Creds;
  }
  if (!c.agenda) throw new Error("seed-e2e-agenda não gravou o bloco `agenda`");
  return c;
}

async function entrar(page: import("@playwright/test").Page, creds: Creds): Promise<string[]> {
  const usuario = creds.users.manager;
  if (!usuario) throw new Error(".e2e-creds.json sem o usuário `manager`");
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(usuario.email);
  await page.getByLabel(/senha/i).fill(creds.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app(\/|$)/, { timeout: 20_000 });
  await page.goto("/app/agenda");
  await expect(page.getByTestId("tela-agenda")).toBeVisible({ timeout: 20_000 });
  // ⚠️ A SEMANA SEGUINTE, e ela é a condição de os dois casos existirem.
  //
  // O caso de remarcar precisa de DOIS horários livres no mesmo dia ("só havia
  // um horário livre — o cenário não distingue remarcar de repetir"), e o dia
  // que o painel oferecia era hoje. Medido com o motor real numa sexta: 4 vagas
  // às 15h, 2 às 16h, ZERO das 17h em diante — e zero o sábado inteiro. Um dia
  // inteiro da semana seguinte oferece 18, a qualquer hora e em qualquer dia da
  // semana. Tabela em `helpers/agenda-semana-integra`.
  return irParaASemanaSeguinte(page);
}

/** Marca um compromisso pela tela e devolve o rótulo do horário escolhido. */
async function marcarUm(
  page: import("@playwright/test").Page,
  tipoNome: string,
  dias: readonly string[],
): Promise<string> {
  await page.getByRole("button", { name: /novo agendamento/i }).click();
  await expect(page.getByTestId("painel-de-marcacao")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("tipos-de-agendamento")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: new RegExp(`^${tipoNome}`) }).click();
  await escolherDiaDesenhado(page, dias);
  const horario = page.locator('[data-testid^="horario-"]').first();
  await expect(horario).toBeVisible({ timeout: 15_000 });
  const rotulo = (await horario.getAttribute("data-testid"))!.replace("horario-", "");
  await horario.click();
  await page.getByTestId("confirmar-marcacao").click();
  await expect(page.getByTestId("ver-na-agenda")).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  return rotulo;
}

// O teto padrão do Playwright é 30s, e estes dois casos fazem DUAS jornadas
// completas cada um (login + marcar + a ação). Estourar o teto vira "timeout",
// que é indistinguível de defeito — e foi o que aconteceu na primeira execução.
test.describe.configure({ timeout: 120_000 });

// A lista "Próximos / Aguardando / Passados / Cancelados" SAIU da página da Agenda em 26/10/2026
// (pedido do dono: abrir direto no calendário). Remarcar e cancelar passaram a viver só na página
// do compromisso — que ainda não tem spec própria; está no roteiro de testes manual. O que esta
// spec prende agora é a metade que dá para afirmar sem a página: marcar continua funcionando e a
// lista antiga não voltou à tela.
test("marcar pela tela continua funcionando e a Agenda abre direto na grade, sem a lista antiga", async ({
  page,
}) => {
  const creds = lerCreds();
  if (!creds.agenda) throw new Error("sem bloco agenda");
  const diasDaSemana = await entrar(page, creds);
  await marcarUm(page, creds.agenda.tipo_nome, diasDaSemana);

  await expect(page.getByTestId("grade-da-agenda")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByTestId("historico-da-agenda"),
    "a lista Próximos/Aguardando/Passados/Cancelados voltou à página da Agenda",
  ).toHaveCount(0);
});
