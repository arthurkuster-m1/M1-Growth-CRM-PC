const { chromium } = require("playwright");
const { execSync } = require("node:child_process");
const EV = "/home/user/M1-Growth-CRM-PC/evidence/automacoes-de-tag";
const BASE = "http://127.0.0.1:3000";
const TOKEN = "tokenteste0123456789abcdef0123456789";
const CRON = "cronsecretlocal0123456789abcdef0123456789abcdef0123456789abcd";
const psql = (q) => execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U supabase_admin -d postgres -Atq -c "${q.replace(/"/g, '\\"')}"`).toString().trim();
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function zap(page, tel, nome, texto, id) {
  const r = await page.request.post(`${BASE}/api/v1/webhooks/waha/${TOKEN}`, {
    data: { event: "message", session: "sessao_teste", payload: { id, from: `${tel}@c.us`, fromMe: false, body: texto, timestamp: Math.floor(Date.now() / 1000), _data: { notifyName: nome } } },
  });
  return r.status();
}
async function drain(page) {
  for (let i = 0; i < 4; i++) {
    await page.request.post(`${BASE}/api/v1/cron/event-log-drain`, { headers: { authorization: `Bearer ${CRON}` } });
    await sleep(800);
  }
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill("dono@teste.com");
  await page.locator("#password").fill("SenhaForte#2026x");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/app/, { timeout: 60000 });
  log("login ok:", page.url());
  await page.screenshot({ path: `${EV}/00-depois-do-login.png` });

  await page.goto(`${BASE}/app/automacoes`);
  await page.getByRole("tab", { name: "Regras" }).waitFor({ timeout: 30000 });
  await page.screenshot({ path: `${EV}/01-central-de-automacoes.png`, fullPage: true });

  // ---- cria as três regras pelos modelos ----
  async function criarPeloModelo(titulo, ajustar) {
    await page.getByRole("button", { name: new RegExp(titulo) }).click();
    await page.getByRole("heading", { name: "Nova automação" }).waitFor();
    if (ajustar) await ajustar();
    await page.screenshot({ path: `${EV}/editor-${titulo.slice(0, 12).replace(/\W/g, "_")}.png` });
    await page.getByRole("button", { name: "Criar automação" }).click();
    await page.getByRole("heading", { name: "Nova automação" }).waitFor({ state: "detached", timeout: 15000 });
  }
  await page.waitForTimeout(2500);
  await criarPeloModelo("Marcar quem enviar um texto");
  await criarPeloModelo("Marcar quem mandar N mensagens", async () => {
    const v = page.locator('input[value="5"]').first();
    await v.fill("2");
  });
  await criarPeloModelo("Marcar quem ficou sem atendimento", async () => {
    await page.locator("#dias-do-tempo").fill("1");
  });
  await page.screenshot({ path: `${EV}/02-tres-regras-criadas.png`, fullPage: true });

  // liga as três (nascem pausadas)
  const switches = page.getByRole("switch");
  const n = await switches.count();
  for (let i = 0; i < n; i++) if ((await switches.nth(i).getAttribute("aria-checked")) === "false") await switches.nth(i).click();
  await sleep(1500);
  log("regras:", psql("select name||' | '||trigger_event||' | ativa='||is_active||' | '||trigger_config::text from automation_rules order by created_at"));
  await page.screenshot({ path: `${EV}/03-regras-ligadas.png`, fullPage: true });

  // ---- mensagens de WhatsApp ----
  log("A:", await zap(page, "5511911110001", "Ana Obrigado", "Oi! Vim pela página #obrigado", "wamid.A1"));
  log("B1:", await zap(page, "5511911110002", "Bruno Engajado", "Oi", "wamid.B1"));
  await drain(page);
  log("B2:", await zap(page, "5511911110002", "Bruno Engajado", "Quero saber o preço", "wamid.B2"));
  log("C:", await zap(page, "5511911110003", "Carla Sem Resposta", "Alguém aí?", "wamid.C1"));
  await drain(page);
  await sleep(2000);
  await drain(page);

  // viagem no tempo: a mensagem da Carla ficou 3h sem resposta
  psql(`update conversations set last_inbound_at = now() - interval '3 hours', last_message_at = now() - interval '3 hours' where contact_id = (select id from contacts where phone_number like '%11911110003%' limit 1)`);
  const rc = await page.request.post(`${BASE}/api/v1/cron/lead-time-triggers`, { headers: { authorization: `Bearer ${CRON}` } });
  log("cron lead-time-triggers:", rc.status(), (await rc.text()).slice(0, 300));
  await drain(page);
  await sleep(2000);
  await drain(page);

  log("TAGS CONTATOS:\n" + psql("select phone_number||' | '||coalesce(display_name,'')||' | tags='||tags::text from contacts order by phone_number"));
  log("TAGS LEADS:\n" + psql("select c.phone_number||' | lead tags='||l.tags::text from crm_leads l join contacts c on c.id=l.contact_id order by c.phone_number"));
  log("RUNS:\n" + psql("select r.name||' | '||x.status||' | '||x.actions_result::text from automation_rule_runs x join automation_rules r on r.id=x.rule_id order by x.created_at"));

  // ---- pela tela: Execuções + fichas ----
  await page.goto(`${BASE}/app/automacoes`);
  await page.getByRole("tab", { name: "Execuções" }).click();
  await sleep(1500);
  await page.screenshot({ path: `${EV}/04-execucoes.png`, fullPage: true });

  for (const [tel, nome] of [["11911110001", "ana"], ["11911110002", "bruno"], ["11911110003", "carla"]]) {
    const id = psql(`select id from contacts where phone_number like '%${tel}%' limit 1`);
    if (!id) { log("sem contato", tel); continue; }
    await page.goto(`${BASE}/app/contacts/${id}`);
    await sleep(2500);
    const tags = page.getByRole("button", { name: /^Tags/ });
    await page.screenshot({ path: `${EV}/05-ficha-${nome}.png`, fullPage: true });
  }
  await browser.close();
})().catch((e) => { console.error("FALHOU:", e); process.exit(1); });
