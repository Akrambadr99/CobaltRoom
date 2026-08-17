import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SettingsPage } from './SettingsPage'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import { SimulatedNetwork } from '../../data'
import { render, screen } from '../../test/render'

function renderSettings(simulator = new SimulatedNetwork()) {
  const services = createAppServices({ simulator })
  render(
    <AppProviders queryClient={createAtlasQueryClient()} services={services}>
      <SettingsPage />
    </AppProviders>,
  )
  return services
}

describe('SettingsPage', () => {
  it('updates authoritative notification and versioned device preferences', async () => {
    const user = userEvent.setup()
    const services = renderSettings()
    const comments = await screen.findByRole('checkbox', { name: /New comments/ })
    expect(comments).toBeChecked()

    await user.click(comments)
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Notification preferences saved.',
    )
    expect(
      (await services.gateway.getNotificationPreferences(services.workspaceId)).comments,
    ).toBe(false)

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Issues per page' }),
      '10',
    )
    expect(services.preferences.getSnapshot().issuePageSize).toBe(10)
  })

  it('rolls back optimistic settings when the gateway rejects the update', async () => {
    const user = userEvent.setup()
    renderSettings(
      new SimulatedNetwork({
        failure: (operation) =>
          operation === 'notification.preferences.update'
            ? 'Settings service unavailable.'
            : null,
      }),
    )
    const assignments = await screen.findByRole('checkbox', {
      name: /Issue assignments/,
    })
    await user.click(assignments)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Notification preferences could not be saved.',
    )
    expect(assignments).toBeChecked()
  })
})
