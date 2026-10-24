import { expect, test } from '@playwright/test';

test('dashboard renders the foundation state', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('R1 foundation · offline mode')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open strategies' })).toBeVisible();
  await expect(page.getByText('Operating guardrails')).toBeVisible();
});
