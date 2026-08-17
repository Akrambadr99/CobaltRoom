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

  await page.getByRole('link', { name: 'Review intermittent restart incidents' }).click()
  await expect(page).toHaveURL(/\/issues\/issue_/)
  await page.getByRole('button', { name: 'Edit issue' }).click()
  await page.getByLabel('Title').fill('Review restart incident clusters')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(
    page.getByRole('heading', { level: 1, name: 'Review restart incident clusters' }),
  ).toBeVisible()

  await page.getByLabel('Add a comment').fill('Confirmed incident owners and next steps.')
  await page.getByRole('button', { name: 'Add comment' }).click()
  await expect(page.getByText('Comment added.')).toBeVisible()
  await expect(page.getByText('Confirmed incident owners and next steps.')).toBeVisible()
})

test('creates a permission-aware issue with workflow metadata', async ({ page }) => {
  await page.goto('/issues')
  await expect(page.getByRole('table', { name: 'Workspace issues' })).toBeVisible()

  await page.getByRole('button', { name: 'Create issue' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create issue' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Project').selectOption({ label: 'Launch readiness' })
  await dialog.getByLabel('Title').fill('Coordinate launch decision review')
  await dialog
    .getByLabel('Description')
    .fill('Confirm decisions, owners, and escalation paths.')
  await dialog.getByLabel('Type').selectOption('story')
  await dialog.getByLabel('Priority').selectOption('high')
  await dialog.getByLabel('Assignee').selectOption({ label: 'Omar Haddad' })
  await dialog.getByLabel('Due date').fill('2026-03-04')
  await dialog.getByLabel('Customer impact').check()
  await dialog.getByRole('button', { name: 'Create issue' }).click()

  await expect(page).toHaveURL(/\/issues\/issue_/)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Coordinate launch decision review',
    }),
  ).toBeVisible()
  await expect(page.getByText('High')).toBeVisible()
  await expect(page.getByText('Story')).toBeVisible()
  await expect(page.getByText('2026-03-04')).toBeVisible()
})

test('moves work across the accessible project board', async ({ page }) => {
  await page.goto('/board')

  await expect(page).toHaveURL(/\/board\?project=prj_/)
  await expect(
    page.getByRole('heading', { level: 1, name: 'Board' }),
  ).toBeVisible()
  await expect(
    page.getByText(/use each issue’s status menu to move it without drag and drop/i),
  ).toBeVisible()

  const moveControl = page.getByRole('combobox', {
    name: 'Move Review intermittent restart incidents',
  })
  await expect(moveControl).toHaveValue(/status_/)
  await moveControl.selectOption({ label: 'Investigating' })

  await expect(
    page.getByText('Review intermittent restart incidents moved to Investigating.'),
  ).toBeVisible()
  await expect(moveControl).toHaveValue(/status_/)
  await page.getByRole('link', { name: 'Review intermittent restart incidents' }).click()
  await expect(page).toHaveURL(/\/issues\/issue_/)
  await expect(page.getByText('Investigating')).toBeVisible()
  await expect(page.getByText('Moved from Triage to Investigating.')).toBeVisible()
})
