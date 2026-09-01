import { expect, test } from "@playwright/test";

const appUrl = process.env.FRONTEND_URL ?? "http://localhost:5174";
const apiUrl = process.env.VITE_API_URL ?? "http://localhost:3000";

test("home shows one card at a time and switches between account and room", async ({
  page,
}) => {
  await page.goto(appUrl);

  await expect(page.getByRole("tab", { name: "Sua conta" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".account-card")).toHaveCount(1);
  await expect(page.locator("form.join-panel")).toHaveCount(0);

  await page.getByRole("tab", { name: "Mesa" }).click();
  await expect(page.getByRole("tab", { name: "Mesa" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("form.join-panel")).toHaveCount(1);
  await expect(page.locator(".account-card")).toHaveCount(0);

  await page.getByRole("tab", { name: "Sua conta" }).click();
  await expect(page.locator(".account-card")).toHaveCount(1);
  await expect(page.locator("form.join-panel")).toHaveCount(0);
});

test("register shows name and avatar fields and creates account", async ({ page }) => {
  const email = `e2e-${Date.now()}@test.com`;

  await page.goto(appUrl);
  await page.getByRole("button", { name: "Cadastro" }).click();

  await expect(page.getByLabel("Nome")).toBeVisible();
  await expect(page.getByText("Seu avatar")).toBeVisible();

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Nome").fill("Jogador E2E");
  await page.getByLabel("Senha da conta").fill("senha123");
  await page.getByRole("button", { name: "♠" }).click();
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page.getByRole("tab", { name: "Mesa" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
});

test("logs in with registered account and stays on home account card", async ({
  page,
  request,
}) => {
  const email = `login-${Date.now()}@test.com`;
  const register = await request.post(`${apiUrl}/auth/register`, {
    data: { email, password: "senha123", name: "Jogador Login", avatar: "♣" },
  });
  expect(register.ok()).toBeTruthy();

  await page.goto(appUrl);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Senha da conta").fill("senha123");
  await page.getByRole("button", { name: "Entrar na conta" }).click();

  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("Sair")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Mesa" })).toBeVisible();
  await expect(page.locator("form.join-panel")).toHaveCount(0);
});

test("creates private room and opens poker table directly", async ({ page }) => {
  await page.goto(appUrl);

  await page.getByRole("tab", { name: "Mesa" }).click();
  await page.getByRole("button", { name: "Criar sala" }).click();
  await page.getByLabel("Nome da sala").fill(`Sprint Playwright ${Date.now()}`);
  await page.getByLabel("Sala privada").check();
  await page.getByLabel("Senha da sala").fill("1234");
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
  await page.getByRole("tab", { name: "Mesa" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Jogador Playwright");
  await page.getByLabel("Codigo da sala").fill(room.code);
  await page.getByLabel("Senha da sala").fill("1234");
  await page.getByRole("button", { name: /^Entrar na sala/ }).click();

  await expect(page).toHaveURL(new RegExp(`/room/${room.code}$`));
  await expect(page.getByText("Entrar na sala privada")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Revelar cartas|Revelar votos/ })).toBeVisible();
});

test("opens direct room url with the same entry layout and no legacy duplicate screen", async ({
  page,
  request,
}) => {
  const roomName = `Sala url direta ${Date.now()}`;
  const response = await request.post(`${apiUrl}/rooms`, {
    data: { name: roomName, visibility: "PRIVATE", password: "1234" },
  });
  expect(response.ok()).toBeTruthy();
  const room = await response.json();

  await page.goto(`${appUrl}/room/${room.code}`);

  await expect(page.getByText("PLANNING POKER")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entrar na sala privada" })).toBeVisible();
  await expect(page.locator("form.join-panel")).toHaveCount(1);

  await page.getByLabel("Nome").fill("Jogador URL");
  await page.getByLabel("Senha da sala").fill("1234");
  await page.getByRole("button", { name: /^Entrar na sala/ }).click();

  await expect(page).toHaveURL(new RegExp(`/room/${room.code}$`));
  await expect(page.getByRole("button", { name: /Revelar cartas|Revelar votos/ })).toBeVisible();
});

test("does not enter private room with wrong password", async ({
  page,
  request,
}) => {
  const roomName = `Sala senha invalida ${Date.now()}`;
  const response = await request.post(`${apiUrl}/rooms`, {
    data: { name: roomName, visibility: "PRIVATE", password: "1234" },
  });
  expect(response.ok()).toBeTruthy();
  const room = await response.json();

  await page.goto(appUrl);
  await page.getByRole("tab", { name: "Mesa" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Jogador Erro");
  await page.getByLabel("Codigo da sala").fill(room.code);
  await page.getByLabel("Senha da sala").fill("9999");
  await page.getByRole("button", { name: /^Entrar na sala/ }).click();

  await expect(page).toHaveURL(appUrl);
  await expect(page.getByRole("alert")).toContainText(
    "Senha invalida ou sala indisponivel.",
  );
  await expect(
    page.getByRole("button", { name: /Revelar cartas|Revelar votos/ }),
  ).toHaveCount(0);
});

test("direct room entry with wrong password never flashes poker table", async ({
  page,
  request,
}) => {
  const roomName = `Sala direta senha invalida ${Date.now()}`;
  const response = await request.post(`${apiUrl}/rooms`, {
    data: { name: roomName, visibility: "PRIVATE", password: "1234" },
  });
  expect(response.ok()).toBeTruthy();
  const room = await response.json();

  await page.goto(`${appUrl}/room/${room.code}`);
  await page.getByLabel("Nome").fill("Jogador Direto Erro");
  await page.getByLabel("Senha da sala").fill("9999");
  await page.evaluate(() => {
    (window as any).__sawPokerTable = Boolean(document.querySelector(".app-shell"));
    const observer = new MutationObserver(() => {
      if (document.querySelector(".app-shell")) {
        (window as any).__sawPokerTable = true;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    (window as any).__pokerTableObserver = observer;
  });

  await page.getByRole("button", { name: /^Entrar na sala/ }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Senha invalida ou sala indisponivel.",
  );
  await page.waitForTimeout(500);

  const sawPokerTable = await page.evaluate(() => {
    (window as any).__pokerTableObserver?.disconnect();
    return (window as any).__sawPokerTable;
  });
  expect(sawPokerTable).toBe(false);
});

test("does not enter room when code does not exist", async ({ page }) => {
  await page.goto(appUrl);
  await page.getByRole("tab", { name: "Mesa" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Jogador Inexistente");
  await page.getByLabel("Codigo da sala").fill(`ZZ${Date.now().toString().slice(-4)}`);
  await page.getByRole("button", { name: /^Entrar na sala/ }).click();

  await expect(page).toHaveURL(appUrl);
  await expect(page.getByRole("alert")).toContainText("Sala nao encontrada.");
  await expect(
    page.getByRole("button", { name: /Revelar cartas|Revelar votos/ }),
  ).toHaveCount(0);
});

test("reload on room route restores session without flashing entry screen", async ({
  page,
  request,
}) => {
  const roomName = `Sala reload ${Date.now()}`;
  const response = await request.post(`${apiUrl}/rooms`, {
    data: { name: roomName, visibility: "PRIVATE", password: "1234" },
  });
  expect(response.ok()).toBeTruthy();
  const room = await response.json();

  await page.goto(appUrl);
  await page.getByRole("tab", { name: "Mesa" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Jogador Reload");
  await page.getByLabel("Codigo da sala").fill(room.code);
  await page.getByLabel("Senha da sala").fill("1234");
  await page.getByRole("button", { name: /^Entrar na sala/ }).click();

  await expect(page).toHaveURL(new RegExp(`/room/${room.code}$`));
  await expect(
    page.getByRole("button", { name: /Revelar cartas|Revelar votos/ }),
  ).toBeVisible();

  await page.reload();

  await expect(
    page.getByRole("button", { name: /Revelar cartas|Revelar votos/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entrar na mesa" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Entrar na sala privada" }),
  ).toHaveCount(0);
});

test("room connection stays on websocket without polling flood", async ({
  page,
  request,
}) => {
  const pollingRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/socket.io/") && req.url().includes("transport=polling")) {
      pollingRequests.push(req.url());
    }
  });

  const roomName = `Sala websocket ${Date.now()}`;
  const response = await request.post(`${apiUrl}/rooms`, {
    data: { name: roomName, visibility: "PRIVATE", password: "1234" },
  });
  expect(response.ok()).toBeTruthy();
  const room = await response.json();

  await page.goto(appUrl);
  await page.getByRole("tab", { name: "Mesa" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Jogador Socket");
  await page.getByLabel("Codigo da sala").fill(room.code);
  await page.getByLabel("Senha da sala").fill("1234");
  await page.getByRole("button", { name: /^Entrar na sala/ }).click();

  await expect(page).toHaveURL(new RegExp(`/room/${room.code}$`));
  await expect(
    page.getByRole("button", { name: /Revelar cartas|Revelar votos/ }),
  ).toBeVisible();

  await page.waitForTimeout(1500);
  expect(pollingRequests).toHaveLength(0);
});
