const { test, expect } = require('@playwright/test');

async function join(page, name) {
  await page.goto('/');
  await page.locator('#name-input').fill(name);
  await page.getByRole('button', { name: 'JACK IN' }).click();
  await expect(page.locator('#join-screen')).toBeHidden();
}

test('a split cell eats a slightly smaller player after a left click', async ({ page }) => {
  await join(page, 'Alice');
  await expect(page.locator('#score')).toHaveText('CREDITS: 100');
  await expect.poll(() => page.evaluate(async () => {
    const { gameState } = await import('/static/js/gameState.js');
    return gameState.currSnapshot?.players.map(p => [p.name, ...p.cells[0].slice(0, 2)]);
  })).toEqual([['Bob', 580, 500], ['Alice', 500, 500]]);
  await expect(page.locator('#leaderboard-content')).toContainText('Bob');

  await page.mouse.move(900, 400);
  await page.locator('#gameCanvas').click({ position: { x: 900, y: 400 }, button: 'left' });

  await expect.poll(() => page.evaluate(async () => {
    const { gameState } = await import('/static/js/gameState.js');
    const player = gameState.currSnapshot?.players.find(p => p.name === 'Alice');
    return player?.cells.length;
  }), { timeout: 3000 }).toBe(2);

  await expect(page.locator('#leaderboard-content')).not.toContainText('Bob', { timeout: 3000 });
  await expect(page.locator('#score')).toHaveText('CREDITS: 249');

  await page.waitForTimeout(1000);
});
