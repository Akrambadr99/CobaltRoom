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
  await expect(
    page.getByRole('heading', { level: 2, name: 'Field reliability' }),
  ).toBeVisible()
  await expect(page.getByText('3 issues').first()).toBeVisible()

  await page.getByRole('link', { name: 'Field reliability' }).click()
  await expect(page).toHaveURL(/\/projects\/prj_/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Field reliability' }),
  ).toBeVisible()
  await expect(page.getByText('Close the device telemetry coverage gap')).toBeVisible()

  await page.getByRole('link', { name: 'Issues' }).click()
  await expect(page).toHaveURL('/issues')
  await expect(page.getByRole('table', { name: 'Workspace issues' })).toBeVisible()
  await expect(page.getByText('6 matching issues')).toBeVisible()

  await page.getByRole('searchbox', { name: 'Search issues' }).fill('restart')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page).toHaveURL('/issues?q=restart')
  await expect(page.getByText('Review intermittent restart incidents')).toBeVisible()

  await page
    .getByRole('checkbox', { name: 'Select Review intermittent restart incidents' })
    .check()
  await page.getByLabel('Set priority').selectOption('urgent')
  await page.getByRole('button', { name: 'Apply priority' }).click()
  await expect(page.getByText('1 issue updated.')).toBeVisible()
})
