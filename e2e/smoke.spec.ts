import { expect, test } from '@playwright/test'

test('loads the shell and navigates with accessible controls', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Atlas Ops')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Dashboard' }),
  ).toBeVisible()
  await expect(page.getByText('Tracked issues')).toBeVisible()
  await expect(page.getByText('5 of 6 issues')).toBeVisible()

  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused()

  const launchPriority = page.getByRole('combobox', {
    name: 'Priority for Publish the launch readiness brief',
  })
  await launchPriority.selectOption('low')
  await expect(
    page.getByText('Priority updated for Publish the launch readiness brief.'),
  ).toBeVisible()
  await expect(launchPriority).toHaveValue('low')

  await page.getByRole('link', { name: 'Projects' }).click()
  await expect(page).toHaveURL('/projects')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Projects' }),
  ).toBeVisible()
})
