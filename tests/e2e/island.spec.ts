import { mkdirSync } from 'node:fs';
import { expect, test } from 'playwright/test';

test.beforeAll(() => {
  mkdirSync('artifacts', { recursive: true });
});

test('shows the placeholder island', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__ISLAND__?.ready === true);
  await expect(page.getByRole('heading', { name: 'Island Idle' })).toBeVisible();
  await expect(page.locator('#scene')).toBeVisible();
  await page.screenshot({ path: `artifacts/island-${testInfo.project.name}.png` });
});
