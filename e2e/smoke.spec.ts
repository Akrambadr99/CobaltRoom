import { expect, test } from '@playwright/test'

test('loads the shell and navigates with accessible controls', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Atlas Ops')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Dashboard' }),
  ).toBeVisible()

  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()

  await page.getByRole('link', { name: 'Projects' }).click()
  await expect(page).toHaveURL('/projects')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Projects' }),
  ).toBeVisible()
})
