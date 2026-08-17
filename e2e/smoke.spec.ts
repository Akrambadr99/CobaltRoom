import { expect, test } from '@playwright/test'

test('loads the Atlas Ops foundation', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Atlas Ops')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Atlas Ops' }),
  ).toBeVisible()
  await expect(page.getByRole('main')).toContainText('Foundation initialized')
})
