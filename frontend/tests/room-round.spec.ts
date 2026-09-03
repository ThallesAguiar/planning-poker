import { expect, test, type Page } from "@playwright/test";

expect.configure({ timeout: 15000 });

const appUrl = process.env.FRONTEND_URL ?? "http://localhost:5174";
const apiUrl = process.env.VITE_API_URL ?? "http://localhost:3000";

async function createPublicRoom(request: { post: (url: string, options?: any) => Promise<any> }) {
  const response = await request.post(`${apiUrl}/rooms`, {
    data: { name: `Sala roda ${Date.now()}` },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { code: string };
}

async function joinViaEntry(page: Page, name: string, code: string) {
  await page.goto(`${appUrl}/room/${code}`);
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByRole("button", { name: /^Entrar na sala/ }).click();
  await expect(page.locator(".app-shell")).toBeVisible();
}

test("full round with two sessions: story, vote, reveal gating, discussion, revote, finalize", async ({
  browser,
  request,
}) => {
  const room = await createPublicRoom(request as any);

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await joinViaEntry(pageA, "Ana", room.code);
  await joinViaEntry(pageB, "Bia", room.code);

  // only the PO sees the story add form
  await expect(pageA.getByLabel("Titulo da historia")).toBeVisible();
  await expect(pageB.getByLabel("Titulo da historia")).toHaveCount(0);

  // reveal is blocked early (lobby / no votes yet)
  await expect(pageA.getByRole("button", { name: "Revelar cartas" })).toBeDisabled();

  await pageA.getByLabel("Titulo da historia").fill("Login OAuth");
  await pageA.getByLabel("Descricao da historia").fill("Proteger rotas privadas");
  await pageA.getByRole("button", { name: "Adicionar historia" }).click();
  await expect(pageA.getByText("Login OAuth")).toBeVisible();

  await pageA.getByRole("button", { name: "Iniciar rodada" }).click();
  await expect(pageA.getByText("Proteger rotas privadas")).toBeVisible();
  await expect(pageB.getByText("Proteger rotas privadas")).toBeVisible();
  await expect(pageA.getByText(/Fase: Votacao/)).toBeVisible();

  // still blocked before any vote
  await expect(pageA.getByRole("button", { name: "Revelar cartas" })).toBeDisabled();

  // Ana votes 5
  await pageA.locator(".card", { hasText: /^5$/ }).click();
  await pageA.getByRole("button", { name: "Jogar carta" }).click();
  await expect(pageA.getByText("Carta jogada", { exact: false })).toBeVisible();
  await expect(pageA.getByText(/1 de 2 jogaram/)).toBeVisible();

  // Bia votes 8 -> reveal becomes enabled
  await pageB.locator(".card", { hasText: /^8$/ }).click();
  await pageB.getByRole("button", { name: "Jogar carta" }).click();
  await expect(pageA.getByText(/2 de 2 jogaram/)).toBeVisible();
  await expect(pageA.getByRole("button", { name: "Revelar cartas" })).toBeEnabled();

  // reveal -> divergence opens discussion
  await pageA.getByRole("button", { name: "Revelar cartas" }).click();
  await expect(pageA.getByText(/Fase: Discussao/)).toBeVisible();
  await expect(pageB.getByText(/Fase: Discussao/)).toBeVisible();
  await expect(pageB.getByText(/justifiquem seus votos/i)).toBeVisible();

  // revote
  await pageA.getByRole("button", { name: "Revotar" }).click();
  await expect(pageA.getByText(/Fase: Votacao/)).toBeVisible();

  // unanimous now
  await pageA.locator(".card", { hasText: /^8$/ }).click();
  await pageA.getByRole("button", { name: "Jogar carta" }).click();
  await pageB.locator(".card", { hasText: /^8$/ }).click();
  await pageB.getByRole("button", { name: "Jogar carta" }).click();
  await expect(pageA.getByRole("button", { name: "Revelar cartas" })).toBeEnabled();
  await pageA.getByRole("button", { name: "Revelar cartas" }).click();
  await expect(pageA.getByText(/Fase: Revelacao/)).toBeVisible();

  // finalize
  await pageA.getByRole("button", { name: "Finalizar", exact: true }).click();
  await pageA.getByRole("button", { name: "Confirmar estimativa" }).click();
  await expect(pageA.getByText("Estimada")).toBeVisible();

  await contextA.close();
  await contextB.close();
});

test("presence: offline mark and moderator removal, reconnection without duplicates", async ({
  browser,
  request,
}) => {
  const room = await createPublicRoom(request as any);

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await joinViaEntry(pageA, "Ana", room.code);
  await joinViaEntry(pageB, "Bia", room.code);

  // reconnection keeps single participant
  await pageB.reload();
  await expect(pageB.locator(".app-shell")).toBeVisible();
  await expect(pageA.locator(".person", { hasText: "Bia" })).toHaveCount(1);

  // closing B marks it offline for A
  await contextB.close();
  await expect(pageA.locator(".person", { hasText: "Bia" })).toContainText("Offline");

  // moderator removes Bia
  const biaRow = pageA.locator(".person", { hasText: "Bia" });
  await biaRow.getByRole("button", { name: "Remover" }).click();
  await biaRow.getByRole("button", { name: "Confirmar?" }).click();
  await expect(pageA.locator(".person", { hasText: "Bia" })).toHaveCount(0);

  await contextA.close();
});

test("table is usable on a mobile viewport without regressions to the felt", async ({ browser, request }) => {
  const room = await createPublicRoom(request as any);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await joinViaEntry(page, "Ana", room.code);
  await expect(page.locator(".felt")).toBeVisible();
  await expect(page.locator(".hand")).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "hidden");
  await context.close();
});