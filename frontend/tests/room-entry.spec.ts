import { expect, test } from "@playwright/test";

const appUrl = process.env.FRONTEND_URL ?? "http://localhost:5174";
const apiUrl = process.env.VITE_API_URL ?? "http://localhost:3000";

test("creates private room and opens poker table directly", async ({ page }) => {
  await page.goto(appUrl);

  await page.getByRole("button", { name: "Criar sala" }).click();
  await page.getByLabel("Nome da sala").fill(`Sprint Playwright ${Date.now()}`);
  await page.getByLabel("Sala privada").check();
  await page.getByRole("textbox", { name: /Senha/ }).fill("1234");
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/room\/[^/]+$/);
  await expect(page.getByText("Entrar na sala privada")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Revelar cartas|Revelar votos/ })).toBeVisible();
});

test("joins private room from home with code and password directly", async ({
  page,
  request,
}) => {
  const roomName = `Sala privada ${Date.now()}`;
  const response = await request.post(`${apiUrl}/rooms`, {
    data: { name: roomName, visibility: "PRIVATE", password: "1234" },
  });
  expect(response.ok()).toBeTruthy();
  const room = await response.json();

  await page.goto(appUrl);
  await page.locator("input").nth(0).fill("Jogador Playwright");
  await page.locator("input").nth(1).fill(room.code);
  await page.locator("input").nth(2).fill("1234");
  await page.getByRole("button", { name: /^Entrar na sala/ }).click();

  await expect(page).toHaveURL(new RegExp(`/room/${room.code}$`));
  await expect(page.getByText("Entrar na sala privada")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Revelar cartas|Revelar votos/ })).toBeVisible();
});
