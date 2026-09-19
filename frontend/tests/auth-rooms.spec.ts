import { expect, test, type Page } from "@playwright/test";

expect.configure({ timeout: 15000 });

const appUrl = process.env.FRONTEND_URL ?? "http://localhost:5174";
const apiUrl = process.env.VITE_API_URL ?? "http://localhost:3000";

async function registerUser(request: { post: (url: string, options?: any) => Promise<any> }) {
  const email = `us-${Date.now()}@test.com`;
  const response = await request.post(`${apiUrl}/auth/register`, {
    data: { email, password: "senha123", name: "Camila E2E", avatar: "♦" },
  });
  expect(response.ok()).toBeTruthy();
  return { email, password: "senha123" };
}

async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto(appUrl);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha da conta").fill(password);
  await page.getByRole("button", { name: "Entrar na conta" }).click();
  await expect(page.getByText(email)).toBeVisible();
}

test("US1 logout clears session and invalid credentials show an error", async ({
  page,
  request,
}) => {
  const user = await registerUser(request);
  await loginViaUi(page, user.email, user.password);

  await page.locator(".account-card").getByRole("button", { name: "Sair" }).click();
  await expect(page.getByRole("button", { name: "Entrar na conta" })).toBeVisible();
  await expect(page.getByText(user.email)).toHaveCount(0);

  await page.getByLabel("E-mail").fill(user.email);
  await page.getByLabel("Senha da conta").fill("senha-errada");
  await page.getByRole("button", { name: "Entrar na conta" }).click();
  await expect(page.getByRole("alert")).toContainText("Login inválido.");

  await page.getByLabel("Senha da conta").fill(user.password);
  await page.getByRole("button", { name: "Entrar na conta" }).click();
  await expect(page.getByText(user.email)).toBeVisible();
});

test("US2 create room while logged in -> shows in Minhas Salas -> rejoin by account", async ({
  page,
  request,
}) => {
  const user = await registerUser(request);
  await loginViaUi(page, user.email, user.password);

  await page.getByRole("tab", { name: "Mesa" }).click();
  await page.locator(".mode-switch").getByRole("button", { name: "Criar sala" }).click();
  const roomName = `Sala US2 ${Date.now()}`;
  await page.getByLabel("Nome da sala").fill(roomName);
  await page.locator("form.join-panel button[type='submit']").click();
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.getByLabel("Título da história")).toBeVisible();

  // Dashboard reads the persisted authenticated membership after route navigation.
  await page.goto(`${appUrl}/rooms`);
  await expect(page.getByRole("heading", { name: "Minhas Salas" })).toBeVisible();
  const roomCard = page.locator(".room-card", { hasText: roomName });
  await expect(roomCard).toHaveCount(1);

  // reopen the poker table directly from the saved room
  await roomCard.getByRole("link", { name: "Entrar" }).click();
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator(".person", { hasText: "Camila E2E" })).toHaveCount(1);
});

test("owner deletes a saved room after permanent-loss confirmation", async ({ page, request }) => {
  const user = await registerUser(request);
  await loginViaUi(page, user.email, user.password);

  await page.getByRole("tab", { name: "Mesa" }).click();
  await page.locator(".mode-switch").getByRole("button", { name: "Criar sala" }).click();
  const roomName = `Sala excluir ${Date.now()}`;
  await page.getByLabel("Nome da sala").fill(roomName);
  await page.locator("form.join-panel button[type='submit']").click();
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.getByLabel("Título da história")).toBeVisible();

  await page.goto(`${appUrl}/rooms`);
  const roomCard = page.locator(".room-card", { hasText: roomName });
  await expect(roomCard).toHaveCount(1);
  const deleteButton = roomCard.getByRole("button", { name: `Excluir sala ${roomName}` });
  await expect(deleteButton).toHaveAttribute("title", /participantes, histórias, votos e relatórios/);
  await deleteButton.click();
  const deleteDialog = page.getByRole("dialog", { name: "Excluir sala?" });
  await expect(deleteDialog).toContainText("Esta ação não pode ser desfeita.");
  await deleteDialog.getByRole("button", { name: "Excluir permanentemente" }).click();

  await expect(roomCard).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("excluída");
});
