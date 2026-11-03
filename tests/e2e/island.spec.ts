import { mkdirSync } from 'node:fs';
import { expect, test } from 'playwright/test';

test.beforeAll(() => {
  mkdirSync('artifacts', { recursive: true });
});

test('plays through fresh island, tended island, upgrades sheet, and away modal', async ({
  page,
}, testInfo) => {
  const tag = testInfo.project.name;

  await page.goto('/');
  await page.waitForFunction(() => window.__ISLAND__?.ready === true);
  await expect(page.getByRole('heading', { name: 'Island Idle' })).toBeVisible();
  await expect(page.locator('#scene')).toBeVisible();

  // 1. Fresh island screenshot
  await page.screenshot({ path: `artifacts/01-fresh-${tag}.png` });

  // 2. Fish by clicking projected 3D water/dock coordinate and plant crops on 3D plots
  const dockPt = await page.evaluate(() => window.__ISLAND__?.project('dock') ?? null);
  expect(dockPt).not.toBeNull();
  if (dockPt) {
    await page.mouse.click(dockPt.x, dockPt.y);
  }

  for (let i = 0; i < 4; i += 1) {
    const plotPt = await page.evaluate(
      (idx) => window.__ISLAND__?.project({ plot: idx }) ?? null,
      i,
    );
    expect(plotPt).not.toBeNull();
    if (plotPt) {
      await page.mouse.click(plotPt.x, plotPt.y);
    }
  }

  const tendedState = await page.evaluate(() => window.__ISLAND__?.getState());
  expect(tendedState?.plots.every((p) => p.cropId !== null)).toBe(true);
  await page.screenshot({ path: `artifacts/02-tended-${tag}.png` });

  // 3. Verify a 4-hour jump does NOT say the 4h offline cap was reached
  await page.getByRole('button', { name: 'Away 4h' }).click();
  await expect(page.getByRole('heading', { name: 'While You Were Away' })).toBeVisible();
  await expect(page.locator('#away-duration')).not.toContainText('4h offline cap reached');
  await page.getByRole('button', { name: /Collect & Sell/i }).click();

  await page.evaluate(() => {
    window.__ISLAND__?.jumpHours(4);
    window.__ISLAND__?.collect('sell');
    window.__ISLAND__?.sell();
  });

  await page.getByRole('button', { name: /Upgrades/i }).click();
  await expect(page.getByRole('heading', { name: 'Island Upgrades' })).toBeVisible();

  await page.getByRole('button', { name: 'Buy Better Rod' }).click();
  await page.getByRole('button', { name: 'Buy Fertile Soil' }).click();
  await page.getByRole('button', { name: 'Buy Market Stall' }).click();
  await page.getByRole('button', { name: 'Buy Auto-fisher' }).click();

  await expect(page.getByTestId('upgrade-level-rod')).toHaveText('Lv. 1/5');
  await expect(page.getByTestId('upgrade-level-soil')).toHaveText('Lv. 1/5');
  await expect(page.getByTestId('upgrade-level-market')).toHaveText('Lv. 1/5');
  await expect(page.getByTestId('upgrade-level-auto_fisher')).toHaveText('Owned');

  await page.screenshot({ path: `artifacts/03-upgrades-${tag}.png` });
  await page.getByRole('button', { name: 'Close upgrades' }).click();

  // 4. Reload with an 8-hour simulated jump via reloadJumpHours and verify the Away modal shows the cap notice
  await page.evaluate(() => {
    window.__ISLAND__?.reloadJumpHours(8);
  });
  await page.waitForFunction(() => window.__ISLAND__?.ready === true);
  await expect(page.getByRole('heading', { name: 'While You Were Away' })).toBeVisible();
  await expect(page.locator('#away-duration')).toContainText('4h offline cap reached');
  await page.screenshot({ path: `artifacts/04-away-${tag}.png` });

  await page.getByRole('button', { name: /Collect & Sell/i }).click();
  await expect(page.getByRole('heading', { name: 'While You Were Away' })).toBeHidden();
});
