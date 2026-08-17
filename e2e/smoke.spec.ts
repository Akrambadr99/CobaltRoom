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
  await expect(page.getByRole('dialog', { name: 'Edit issue' })).not.toBeVisible()
  await expect(page.locator('.app-shell')).not.toHaveAttribute('inert', '')

  const commentDraft = page.getByLabel('Add a comment')
  await commentDraft.fill('Confirmed incident owners and next steps.')
  await expect(commentDraft).toHaveValue('Confirmed incident owners and next steps.')
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
    page.getByText(/use its status menu as a keyboard-accessible alternative/i),
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
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Review intermittent restart incidents',
    }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('region', { name: 'Issue collaboration' })
      .getByRole('listitem')
      .filter({ hasText: 'Moved from Triage to Investigating.' }),
  ).toBeVisible()
})

test('moves board work with a pointer while preserving the keyboard alternative', async ({
  page,
}) => {
  await page.goto('/board')
  const issueTitle = 'Close the device telemetry coverage gap'
  const dragHandle = page.getByRole('button', { name: `Drag ${issueTitle}` })
  const targetColumn = page.locator('section.kanban-column').filter({
    has: page.getByRole('heading', { level: 2, name: 'Resolved' }),
  })

  await dragHandle.dragTo(targetColumn)

  await expect(targetColumn.getByRole('link', { name: issueTitle })).toBeVisible()
  await expect(
    page.getByText(`${issueTitle} moved to Resolved.`),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: `Drag ${issueTitle}` })).toBeFocused()
  const moveControl = page.getByRole('combobox', { name: `Move ${issueTitle}` })
  const resolvedValue = await moveControl
    .locator('option', { hasText: 'Resolved' })
    .getAttribute('value')
  if (!resolvedValue) throw new Error('Expected the resolved workflow value.')
  await expect(moveControl).toHaveValue(resolvedValue)
})

test('moderates an issue comment with confirmation and an audit trail', async ({
  page,
}) => {
  await page.goto('/issues')
  await page
    .getByRole('link', { name: 'Publish the launch readiness brief' })
    .click()

  await page.getByRole('button', { name: 'Remove comment' }).click()
  await expect(page.getByText('Remove this comment?')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm remove' }).click()

  await expect(page.getByText('Comment removed by moderation.')).toBeVisible()
  const tombstone = page.getByText('Comment removed by Omar Haddad.')
  await expect(tombstone).toBeVisible()
  await expect(tombstone.locator('..')).toBeFocused()
  await expect(page.getByText('Removed a comment as a moderator.')).toBeVisible()
})

test('searches globally with the keyboard shortcut', async ({ page }) => {
  await page.goto('/')

  const searchbox = page.getByRole('searchbox', { name: 'Search all issues' })
  await expect(searchbox).toBeVisible()
  await page.keyboard.press('/')
  await expect(searchbox).toBeFocused()
  await searchbox.fill('telemetry')
  await page
    .getByRole('link', { name: /Close the device telemetry coverage gap/i })
    .click()

  await expect(page).toHaveURL(/\/issues\/issue_/)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Close the device telemetry coverage gap',
    }),
  ).toBeVisible()
})

test('restores a private saved view and page-size preference after reload', async ({
  page,
}) => {
  await page.goto('/issues')
  await expect(page.getByRole('table', { name: 'Workspace issues' })).toBeVisible()

  await page.getByLabel('Priority').selectOption('urgent')
  await expect(page.getByText('2 matching issues')).toBeVisible()
  await page.getByLabel('View name').fill('Urgent operations')
  await page.getByRole('button', { name: 'Save current view' }).click()
  await expect(
    page.getByText('Urgent operations saved as a private view.'),
  ).toBeVisible()
  await page.getByLabel('Rows per page').selectOption('10')

  await page.reload()
  await expect(page.getByLabel('Rows per page')).toHaveValue('10')
  await page.getByLabel('Priority').selectOption('')
  await expect(page.getByText('6 matching issues')).toBeVisible()
  await page.getByLabel('Open saved view').selectOption({
    label: 'Urgent operations',
  })

  await expect(page).toHaveURL(/priority=urgent/)
  await expect(page.getByText('2 matching issues')).toBeVisible()
})

test('opens a permission-aware command palette and starts issue creation', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Commands' })).toBeVisible()

  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog', { name: 'Command palette' })
  await expect(palette).toBeVisible()
  await expect(page.locator('.app-shell')).toHaveAttribute('inert', '')
  const commandSearch = palette.getByRole('combobox', { name: 'Search commands' })
  await commandSearch.fill('create issue')
  await commandSearch.press('Enter')

  await expect(page).toHaveURL('/issues?create=1')
  await expect(page.getByRole('dialog', { name: 'Create issue' })).toBeVisible()
})

test('reviews and clears the notification inbox', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Notifications, 1 unread' })
  await expect(trigger).toBeVisible()
  await trigger.click()

  const inbox = page.getByRole('region', { name: 'Notifications' })
  await expect(inbox).toBeVisible()
  await expect(inbox.getByText('New comment on OPS-1')).toBeVisible()
  await inbox.getByRole('button', { name: 'Mark all read' }).click()

  await expect(
    page.getByRole('button', { name: 'Notifications, 0 unread' }),
  ).toBeVisible()
  await expect(page.getByText('1 notification marked as read.')).toBeAttached()
})

test('persists dashboard widgets and reviews authoritative analytics', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByText('Tracked issues')).toBeVisible()
  await page.getByRole('button', { name: 'Customize dashboard' }).click()
  await page.getByRole('checkbox', { name: 'Overdue issues' }).check()
  await expect(
    page.getByLabel('Workspace summary').getByText('Overdue issues', { exact: true }),
  ).toBeVisible()

  await page.reload()
  await expect(
    page.getByLabel('Workspace summary').getByText('Overdue issues', { exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Analytics' }).click()

  await expect(page).toHaveURL('/analytics')
  await expect(
    page.getByRole('table', {
      name: 'Project issue volume, completion, urgency, and overdue work',
    }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Issues by priority' })).toBeVisible()
})

test('configures notification delivery and device settings', async ({ page }) => {
  await page.goto('/settings')
  const comments = page.getByRole('checkbox', { name: /New comments/ })
  await expect(comments).toBeChecked()
  await comments.click()
  await expect(page.getByText('Notification preferences saved.')).toBeVisible()
  await expect(comments).not.toBeChecked()

  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(comments).not.toBeChecked()

  await page.getByRole('combobox', { name: 'Issues per page' }).selectOption('10')
  await expect(page.getByText('Device preferences saved.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Issues per page' })).toHaveValue('10')
})

test('reviews the protected governance audit report', async ({ page }) => {
  await page.goto('/governance')
  await expect(page.getByRole('heading', { name: 'Governance' })).toBeVisible()
  const auditLog = page.getByRole('table', {
    name: 'Authoritative workspace audit events',
  })
  await expect(auditLog).toContainText('fixtures.created')

  await page.getByRole('combobox', { name: 'Outcome' }).selectOption('rejected')
  await expect(page.getByText('1 matching events')).toBeVisible()
  await expect(auditLog).toContainText('fixture-access-check-001')
  await expect(auditLog).not.toContainText('fixture-bootstrap-001')
})
