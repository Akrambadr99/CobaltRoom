import { expect, test } from '@playwright/test'

test('GridLoom exposes its primary domain workflow', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('GridLoom')
  await expect(page.getByRole('heading', { level: 1, name: 'Energy balance' })).toBeVisible()
  await page.getByRole('button', { name: 'history' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Interval provenance' })).toBeVisible()
})
