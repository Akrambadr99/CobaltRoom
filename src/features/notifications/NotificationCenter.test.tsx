import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { NotificationCenter } from './NotificationCenter'
import { createAtlasQueryClient } from '../../app/query-client'
import { AppProviders } from '../../app/providers/AppProviders'
import { createAppServices } from '../../app/services'
import { SimulatedNetwork } from '../../data'
import { render, screen } from '../../test/render'

function renderNotificationCenter(simulator = new SimulatedNetwork()) {
  render(
    <AppProviders
      queryClient={createAtlasQueryClient()}
      services={createAppServices({ simulator })}
    >
      <MemoryRouter>
        <NotificationCenter />
      </MemoryRouter>
    </AppProviders>,
  )
}

describe('NotificationCenter', () => {
  it('announces unread state and supports reversible inbox updates', async () => {
    const user = userEvent.setup()
    renderNotificationCenter()

    const trigger = await screen.findByRole('button', {
      name: 'Notifications, 1 unread',
    })
    await user.click(trigger)
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Mark as read' }))
    expect(
      await screen.findByRole('button', { name: 'Notifications, 0 unread' }),
    ).toBeVisible()
    expect(await screen.findByText('Notification marked as read.')).toHaveAttribute(
      'role',
      'status',
    )

    const markUnread = screen.getAllByRole('button', { name: 'Mark as unread' }).at(0)
    if (!markUnread) throw new Error('Expected a read notification control.')
    await user.click(markUnread)
    expect(
      await screen.findByRole('button', { name: 'Notifications, 1 unread' }),
    ).toBeVisible()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('rolls back an optimistic read when the gateway rejects it', async () => {
    const user = userEvent.setup()
    renderNotificationCenter(
      new SimulatedNetwork({
        failure: (operation) =>
          operation === 'notification.mark-read' ? 'Inbox update unavailable.' : null,
      }),
    )

    await user.click(
      await screen.findByRole('button', { name: 'Notifications, 1 unread' }),
    )
    await user.click(screen.getByRole('button', { name: 'Mark as read' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The notification update did not complete. Your inbox was restored.',
    )
    expect(
      screen.getByRole('button', { name: 'Notifications, 1 unread' }),
    ).toBeVisible()
  })
})
