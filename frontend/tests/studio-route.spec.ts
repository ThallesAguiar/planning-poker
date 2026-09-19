import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const appUrl = process.env.FRONTEND_URL ?? 'http://localhost:5174';
const apiUrl = process.env.VITE_API_URL ?? 'http://localhost:3000';

type AccountSession = {
  user: { id: string; email: string; name: string; avatar: string };
  token: string;
};

async function registerAccount(request: { post: (url: string, options?: unknown) => Promise<any> }, name: string) {
  const response = await request.post(`${apiUrl}/auth/register`, {
    data: { email: `${name.toLowerCase().replaceAll(' ', '-')}-${Date.now()}@test.com`, password: 'senha123', name, avatar: '♠' },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as AccountSession;
}

async function setAccount(context: BrowserContext, account: AccountSession) {
  await context.addInitScript((session) => {
    localStorage.setItem('planning-poker-account', JSON.stringify(session.user));
    localStorage.setItem('planning-poker-account-token', session.token);
    localStorage.setItem('planning-poker-account-expires-at', new Date(Date.now() + 60 * 60 * 1000).toISOString());
  }, account);
}

async function createOwnedRoom(request: { post: (url: string, options?: unknown) => Promise<any> }, owner: AccountSession) {
  const created = await request.post(`${apiUrl}/rooms`, { data: { name: `Studio E2E ${Date.now()}`, visibility: 'PUBLIC' } });
  expect(created.ok()).toBeTruthy();
  const room = (await created.json()) as { code: string };
  const joined = await request.post(`${apiUrl}/rooms/${room.code}/join`, {
    headers: { authorization: `Bearer ${owner.token}` },
    data: { name: owner.user.name, avatar: owner.user.avatar, role: 'PO' },
  });
  expect(joined.ok()).toBeTruthy();
  return room;
}

async function createGuestOwnedRoom(request: { post: (url: string, options?: unknown) => Promise<any> }) {
  const created = await request.post(`${apiUrl}/rooms`, { data: { name: `Guest Studio ${Date.now()}`, visibility: 'PUBLIC' } });
  expect(created.ok()).toBeTruthy();
  const room = (await created.json()) as { code: string };
  const joined = await request.post(`${apiUrl}/rooms/${room.code}/join`, {
    data: { name: 'Guest Owner', avatar: '♠', role: 'PO', sessionId: crypto.randomUUID() },
  });
  expect(joined.ok()).toBeTruthy();
  const session = (await joined.json()) as { token: string };
  return { ...room, guestToken: session.token };
}

test('room Studio loads for owner and survives refresh', async ({ browser, request }) => {
  const owner = await registerAccount(request, 'Owner Studio');
  const room = await createOwnedRoom(request, owner);
  const context = await browser.newContext();
  await setAccount(context, owner);
  const page = await context.newPage();

  await page.goto(`${appUrl}/rooms/${room.code}/studio`);
  await expect(page.getByRole('heading', { name: 'Studio de IA da sala', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Provedor' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Provedor' })).toBeVisible();
  await context.close();
});

test('account Studio defaults new agent responses to Brazilian Portuguese', async ({ browser, request }) => {
  const account = await registerAccount(request, 'Language Studio');
  const context = await browser.newContext();
  await setAccount(context, account);
  const page = await context.newPage();

  await page.goto(`${appUrl}/studio`);
  const language = page.getByLabel('Idioma das respostas');
  await expect(language).toHaveValue('pt-BR');
  await language.selectOption('en');
  await expect(language).toHaveValue('en');
  await context.close();
});

test('room Studio blocks guest, non-owner, and unknown room without form', async ({ browser, request }) => {
  const owner = await registerAccount(request, 'Owner Guard');
  const room = await createOwnedRoom(request, owner);

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await guestPage.goto(`${appUrl}/rooms/${room.code}/studio`);
  await expect(guestPage.getByText('Entre com sua conta para configurar a IA desta mesa.')).toBeVisible();
  await expect(guestPage.getByRole('heading', { name: 'Provedor' })).toHaveCount(0);
  await guestContext.close();

  const other = await registerAccount(request, 'Other Guard');
  const otherContext = await browser.newContext();
  await setAccount(otherContext, other);
  const otherPage = await otherContext.newPage();
  await otherPage.goto(`${appUrl}/rooms/${room.code}/studio`);
  await expect(otherPage.getByRole('alert')).toContainText('Não foi possível carregar o Studio da sala');
  await expect(otherPage.getByRole('heading', { name: 'Provedor' })).toHaveCount(0);
  await otherPage.goto(`${appUrl}/rooms/CODEINEXISTENTE/studio`);
  await expect(otherPage.getByText('Sala não encontrada.')).toBeVisible();
  await expect(otherPage.getByRole('heading', { name: 'Provedor' })).toHaveCount(0);
  await otherContext.close();
});

test('account claims its own guest-created room before opening room Studio', async ({ browser, request }) => {
  const room = await createGuestOwnedRoom(request);
  const account = await registerAccount(request, 'Claim Studio');
  const context = await browser.newContext();
  await setAccount(context, account);
  await context.addInitScript(({ code, token }) => {
    localStorage.setItem(`planning-poker-token:guest:${code}`, token);
  }, { code: room.code, token: room.guestToken });
  const page = await context.newPage();

  await page.goto(`${appUrl}/rooms/${room.code}/studio`);
  await expect(page.getByRole('heading', { name: 'Provedor' })).toBeVisible();
  await context.close();
});
