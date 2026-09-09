import { expect } from '@playwright/test';

export async function loginPage(page, origin, person = 'Alice Martin') {
  await page.goto(origin + '/connexion');
  await page.getByRole('link', { name: 'Se connecter', exact: true }).click();
  await page.getByRole('button', { name: person, exact: true }).click();
  await expect.poll(() => page.url() === origin + '/espace', { message: 'OIDC returned to the workspace (callback URLs are not logged)' }).toBe(true);
  await expect(page.getByRole('status').filter({ hasText: 'Chargement' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Les accès de votre équipe' })).toBeVisible();
}

export async function teamReady(page) {
  await expect(page.getByRole('heading', { name: 'Membres', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Chargement' })).toHaveCount(0);
}
