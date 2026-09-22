import { expect, test } from '@playwright/test'

test('supervisor previews meter archive, restores once, and sees stale snapshot blocked', async ({ page }) => {
  await page.goto('/meter-exchange')
  const recovery = page.getByRole('region', { name: 'Meter case recovery' })
  await expect(recovery.getByRole('button', { name: 'Capture selected case recovery snapshot' })).toBeDisabled()
  await page.getByLabel('Workload role').selectOption('Operations Supervisor')
  await recovery.getByRole('button', { name: 'Capture selected case recovery snapshot' }).click()
  await expect(page.getByLabel('Meter recovery preview')).toContainText('verified for restore')
  await recovery.getByRole('button', { name: 'Restore verified meter case' }).click()
  await expect(page.getByRole('status')).toContainText('restoration recorded')
  await expect(page.getByLabel('Meter recovery preview')).toContainText('restore blocked')
  await expect(recovery.getByRole('button', { name: 'Restore verified meter case' })).toBeDisabled()
  await page.reload()
  await expect(page.getByLabel('Meter recovery preview')).toContainText('restore blocked')
  await expect(page.getByRole('list', { name: 'Meter field custody activity' })).toContainText('recovery-restoration')
})
