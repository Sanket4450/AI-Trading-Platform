import { expect, test } from '@playwright/test';

test('dashboard renders the R2 research state', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Research is a capability boundary, not a label.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open catalog' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open data health' })).toBeVisible();
});
