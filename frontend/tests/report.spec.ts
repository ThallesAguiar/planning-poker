import { expect, test, type Page } from "@playwright/test";

expect.configure({ timeout: 15000 });

const appUrl = process.env.FRONTEND_URL ?? "http://localhost:5174";
const apiUrl = process.env.VITE_API_URL ?? "http://localhost:3000";

async function createPublicRoom(request: { post: (url: string, options?: any) => Promise<any> }, name: string) {
  const response = await request.post(`${apiUrl}/rooms`, {
    data: { name, visibility: "PUBLIC" },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { id: string; code: string };
}

async function joinViaEntry(page: Page, name: string, code: string) {
  await page.goto(`${appUrl}/room/${code}`);
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByRole("button", { name: /^Entrar na sala/ }).click();
  await expect(page.locator(".app-shell")).toBeVisible();
}

test("runs a round, generates a report and shows enriched report page + downloads", async ({
  browser,
  request,
}) => {
  const roomName = `Sala relatorio ${Date.now()}`;
  const room = await createPublicRoom(request, roomName);

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await joinViaEntry(pageA, "Ana", room.code);
  await joinViaEntry(pageB, "Bia", room.code);

  await pageA.getByLabel("Titulo da historia").fill("Login e2e");
  await pageA.getByRole("button", { name: "Adicionar historia" }).click();
  await pageA.getByRole("button", { name: "Iniciar rodada" }).click();

  await pageA.locator(".card", { hasText: /^5$/ }).click();
  await pageA.getByRole("button", { name: "Jogar carta" }).click();
  await pageB.locator(".card", { hasText: /^8$/ }).click();
  await pageB.getByRole("button", { name: "Jogar carta" }).click();
  await expect(pageA.getByRole("button", { name: "Revelar cartas" })).toBeEnabled();
  await pageA.getByRole("button", { name: "Revelar cartas" }).click();
  await expect(pageA.getByText(/Fase: Discussao/)).toBeVisible();

  // revote -> unanimous
  await pageA.getByRole("button", { name: "Revotar" }).click();
  await pageA.locator(".card", { hasText: /^5$/ }).click();
  await pageA.getByRole("button", { name: "Jogar carta" }).click();
  await pageB.locator(".card", { hasText: /^5$/ }).click();
  await pageB.getByRole("button", { name: "Jogar carta" }).click();
  await expect(pageA.getByRole("button", { name: "Revelar cartas" })).toBeEnabled();
  await pageA.getByRole("button", { name: "Revelar cartas" }).click();
  await expect(pageA.getByText(/Fase: Revelacao/)).toBeVisible();

  await pageA.getByRole("button", { name: "Finalizar", exact: true }).click();
  await pageA.getByRole("button", { name: "Confirmar estimativa" }).click();
  await expect(pageA.getByText("Estimada")).toBeVisible();

  const token = await pageA.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("planning-poker-token:"));
    return key ? (localStorage.getItem(key) ?? "") : "";
  });
  expect(token.length).toBeGreaterThan(0);

  // REST reports the room (accepted by id or invite code, like the UI sends)
  const generation = await request.post(`${apiUrl}/rooms/${room.code}/report`, {});
  expect(generation.ok()).toBeTruthy();
  const report = (await generation.json()) as { id: string; roomId: string };

  await pageA.goto(`${appUrl}/report/${report.id}`);

  await expect(pageA.locator(".report-page")).toBeVisible();
  await expect(pageA.locator(".report-muted")).toContainText(roomName);
  await expect(pageA.locator(".report-muted")).toContainText(room.code);
  await expect(pageA.getByText("Backlog concluído")).toBeVisible();
  await expect(pageA.getByText("Divergência resolvida")).toBeVisible();
  await expect(pageA.getByText("Todos votaram")).toBeVisible();
  await expect(pageA.getByText("Login e2e", { exact: true })).toBeVisible();
  await expect(pageA.getByText(/Rodada 1:/)).toBeVisible();
  await expect(pageA.getByText(/Rodada 2:/)).toBeVisible();
  await expect(pageA.locator(".report-participation", { hasText: "Ana" })).toBeVisible();
  await expect(pageA.locator(".report-participation", { hasText: "Bia" })).toBeVisible();

  // CSV and PDF downloads
  const csv = await request.get(`${apiUrl}/reports/${report.id}/export.csv`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const csvText = await csv.text();
  expect(csvText).toContain('"Historia"');
  // CSV seccional: expoe as mesmas secoes da tela (sintese, participacao, badges, anotacoes da mesa)
  expect(csvText).toContain("SECAO");

  const pdf = await request.get(`${apiUrl}/reports/${report.id}/export.pdf`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  await contextA.close();
  await contextB.close();
});

test("records a vote justification, shows per-vote names, a heuristic task chip and mesa notes", async ({
  browser,
  request,
}) => {
  const roomName = `Sala relatorio just ${Date.now()}`;
  const room = await createPublicRoom(request, roomName);

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await joinViaEntry(pageA, "Ana", room.code);
  await joinViaEntry(pageB, "Bia", room.code);

  // Mensagem sem historia (fora de rodada) -> "Anotacoes da mesa"
  await pageA.getByLabel("Mensagem do chat").fill("vamos comecar a planejamento");
  await pageA.getByLabel("Mensagem do chat").press("Enter");
  await expect(pageA.getByText("vamos comecar a planejamento")).toBeVisible();

  await pageA.getByLabel("Titulo da historia").fill("Pesquisa just");
  await pageA.getByRole("button", { name: "Adicionar historia" }).click();
  await pageA.getByRole("button", { name: "Iniciar rodada" }).click();

  // Ana justifica a nota antes de jogar
  await pageA.locator(".card", { hasText: /^5$/ }).click();
  await pageA.locator(".hand-justification").fill("simples de implementar");
  await pageA.getByRole("button", { name: "Jogar carta" }).click();

  // Bia diverge para gerar divergencia (spread > 0) e depois consenso
  await pageB.locator(".card", { hasText: /^8$/ }).click();
  await pageB.getByRole("button", { name: "Jogar carta" }).click();
  await expect(pageA.getByRole("button", { name: "Revelar cartas" })).toBeEnabled();
  await pageA.getByRole("button", { name: "Revelar cartas" }).click();

  // a justificativa aparece na carta revelada do felt
  await expect(pageA.locator(".seat-justification", { hasText: "simples de implementar" })).toBeVisible();

  await pageA.getByRole("button", { name: "Revotar" }).click();
  await pageA.locator(".card", { hasText: /^5$/ }).click();
  await pageA.getByRole("button", { name: "Jogar carta" }).click();
  await pageB.locator(".card", { hasText: /^5$/ }).click();
  await pageB.getByRole("button", { name: "Jogar carta" }).click();
  await expect(pageA.getByRole("button", { name: "Revelar cartas" })).toBeEnabled();
  await pageA.getByRole("button", { name: "Revelar cartas" }).click();
  await pageA.getByRole("button", { name: "Finalizar", exact: true }).click();
  await pageA.getByRole("button", { name: "Confirmar estimativa" }).click();
  await expect(pageA.getByText("Estimada")).toBeVisible();

  const generation = await request.post(`${apiUrl}/rooms/${room.code}/report`, {});
  expect(generation.ok()).toBeTruthy();
  const report = (await generation.json()) as { id: string; roomId: string };
  await pageA.goto(`${appUrl}/report/${report.id}`);

  await expect(pageA.locator(".report-page")).toBeVisible();
  // votos por rodada com nome (Ana com justificativa; Bia aparece nas duas rodadas)
  await expect(pageA.getByText('Ana → 5 · "simples de implementar"')).toBeVisible();
  await expect(pageA.locator(".report-vote-detail", { hasText: "Bia → 5" }).first()).toBeVisible();
  await expect(pageA.getByText(/Rodada 1:/)).toBeVisible();
  // justificativa persistida no relatorio
  await expect(pageA.getByText("simples de implementar")).toBeVisible();
  // task sugerida pelas heuristicas (divergencia inicial 5/8) - o texto aparece nas tasks por historia e no resumo
  await expect(pageA.getByText("Detalhar critérios de aceite da história com o time").first()).toBeVisible();
  // anotacoes da mesa (mensagem fora de rodada)
  await expect(pageA.locator(".report-room-notes", { hasText: "vamos comecar a planejamento" })).toBeVisible();

  // Exporta pelo botao da pagina (usa summary.roomCode -> chave local com o codigo da sala).
  // Regressao: antes usava report.roomId (UUID) e o token nunca era encontrado.
  const [csvDownload] = await Promise.all([
    pageA.waitForEvent("download"),
    pageA.getByRole("button", { name: "Baixar CSV" }).click(),
  ]);
  expect(csvDownload.suggestedFilename()).toMatch(/\.csv$/);

  await contextA.close();
  await contextB.close();
});