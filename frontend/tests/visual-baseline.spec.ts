import { expect, test } from "@playwright/test";

const appUrl = process.env.FRONTEND_URL ?? "http://localhost:5174";
const apiUrl = process.env.VITE_API_URL ?? "http://localhost:3000";

test("entry shell keeps approved visual structure", async ({ page }) => {
  await page.goto(appUrl);

  await expect(page.getByText("PLANNING POKER")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entrar na mesa" })).toBeVisible();
  await expect(page.locator(".entry-card-fan")).toBeVisible();
  await expect(page.locator("form.join-panel")).toHaveCount(1);
});

test("room shell keeps table structure after joining", async ({ page, request }) => {
  const response = await request.post(`${apiUrl}/rooms`, {
    data: { name: `Visual ${Date.now()}`, visibility: "PUBLIC" },
  });
  expect(response.ok()).toBeTruthy();
  const room = await response.json();

  await page.goto(appUrl);
  await page.locator("input").nth(0).fill("Jogador Visual");
  await page.locator("input").nth(1).fill(room.code);
  await page.getByRole("button", { name: /^Entrar na sala/ }).click();

  await expect(page).toHaveURL(new RegExp(`/room/${room.code}$`));
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator(".felt")).toBeVisible();
  await expect(page.locator(".cards")).toBeVisible();
});

test("dashboard and profile shells keep approved structure", async ({ page }) => {
  await page.goto(`${appUrl}/rooms`);
  await expect(page.locator(".dashboard-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Minhas Salas" })).toBeVisible();

  await page.goto(`${appUrl}/profile`);
  await expect(page.locator(".dashboard-shell")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible();
});
