import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { NotificationCenter } from './NotificationCenter'
import { createAtlasQueryClient } from '../../app/query-client'
import { AppProviders } from '../../app/providers/AppProviders'
import { createAppServices } from '../../app/services'
import {
  createAtlasFixtures,
  InMemoryDataStore,
  SimulatedNetwork,
} from '../../data'
import { isoDateTime, notificationCategory, notificationId } from '../../domain'
import { render, screen, within } from '../../test/render'

function renderNotificationCenter(
  simulator = new SimulatedNetwork(),
  dataStore?: InMemoryDataStore,
) {
  render(
    <AppProviders
      queryClient={createAtlasQueryClient()}
      services={createAppServices({
        simulator,
        ...(dataStore ? { dataStore } : {}),
      })}
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

  it('loads older notifications through bounded server pages', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const template = fixtures.notifications[0]
    if (!template) throw new Error('Expected a notification fixture.')
    const notifications = Array.from({ length: 21 }, (_, index) => ({
      ...template,
      id: notificationId(`notification_page_${index.toString().padStart(3, '0')}`),
      title: `Page notification ${String(index + 1)}`,
      occurredAt: isoDateTime(
        `2026-01-${(index + 1).toString().padStart(2, '0')}T09:00:00.000Z`,
      ),
    }))
    const dataStore = new InMemoryDataStore({ ...fixtures, notifications })

    renderNotificationCenter(new SimulatedNetwork(), dataStore)
    await user.click(
      await screen.findByRole('button', { name: 'Notifications, 21 unread' }),
    )

    expect(screen.getAllByRole('listitem')).toHaveLength(20)
    await user.click(screen.getByRole('button', { name: 'Load older notifications' }))
    const oldestNotification = await screen.findByText('Page notification 1')
    expect(oldestNotification).toBeVisible()
    expect(screen.getAllByRole('listitem')).toHaveLength(21)
    expect(
      screen.queryByRole('button', { name: 'Load older notifications' }),
    ).not.toBeInTheDocument()

    const oldestItem = oldestNotification.closest('li')
    if (!oldestItem) throw new Error('Expected the oldest notification item.')
    await user.click(within(oldestItem).getByRole('button', { name: 'Mark as read' }))
    expect(
      await screen.findByRole('button', { name: 'Notifications, 20 unread' }),
    ).toBeVisible()
  })

  it('filters categories and routes generalized entity targets', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const template = fixtures.notifications[0]
    const project = fixtures.projects[0]
    const membership = fixtures.memberships[0]
    if (!template || !project || !membership) {
      throw new Error('Expected notification routing fixtures.')
    }
    const notifications = [
      ...fixtures.notifications,
      {
        ...template,
        id: notificationId('notification_project_routing_001'),
        kind: 'project-update' as const,
        target: { kind: 'project' as const, id: project.id },
        title: 'Project delivery changed',
      },
      {
        ...template,
        id: notificationId('notification_admin_routing_001'),
        kind: 'workspace-administration' as const,
        target: { kind: 'administration' as const, id: membership.id },
        title: 'Workspace role changed',
      },
      {
        ...template,
        id: notificationId('notification_governance_routing_001'),
        kind: 'governance' as const,
        target: { kind: 'governance' as const, id: 'fixture-access-check-001' },
        title: 'Access review requires attention',
      },
    ]
    renderNotificationCenter(
      new SimulatedNetwork(),
      new InMemoryDataStore({ ...fixtures, notifications }),
    )

    await user.click(
      await screen.findByRole('button', { name: 'Notifications, 4 unread' }),
    )
    const category = screen.getByRole('combobox', { name: 'Category' })
    expect(category).toHaveTextContent('Work (2)')
    expect(category).toHaveTextContent('Collaboration (1)')

    await user.selectOptions(category, 'administration')
    const administration = await screen.findByRole('link', {
      name: /Workspace role changed/,
    })
    expect(administration).toHaveAttribute('href', '/administration')
    expect(screen.queryByText('Project delivery changed')).not.toBeInTheDocument()

    await user.selectOptions(category, 'governance')
    expect(await screen.findByRole('link', {
      name: /Access review requires attention/,
    })).toHaveAttribute(
      'href',
      '/governance?request=fixture-access-check-001',
    )

    await user.selectOptions(category, 'work')
    expect(await screen.findByRole('link', { name: /Project delivery changed/ }))
      .toHaveAttribute('href', `/projects/${project.id}`)
  })

  it('filters read state and scopes bulk updates to matching or selected notifications', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const actorId = fixtures.memberships.find(({ role }) => role === 'admin')?.userId
    const actorNotifications = fixtures.notifications.filter(
      ({ recipientId }) => recipientId === actorId,
    )
    if (!actorId || actorNotifications.length !== 2) {
      throw new Error('Expected two actor notification fixtures.')
    }
    const notifications = fixtures.notifications.map((notification) =>
      notification.recipientId === actorId
        ? { ...notification, readAt: null }
        : notification,
    )
    const dataStore = new InMemoryDataStore({ ...fixtures, notifications })
    renderNotificationCenter(new SimulatedNetwork(), dataStore)

    await user.click(
      await screen.findByRole('button', { name: 'Notifications, 2 unread' }),
    )
    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), 'collaboration')
    await user.click(screen.getByRole('button', { name: 'Mark matching read' }))
    expect(
      await screen.findByRole('button', { name: 'Notifications, 1 unread' }),
    ).toBeVisible()
    expect(
      dataStore.read().data.notifications.filter(
        ({ recipientId, readAt }) => recipientId === actorId && readAt === null,
      ),
    ).toHaveLength(1)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Category' }), '')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'unread')
    const unread = actorNotifications.find(
      ({ kind }) => notificationCategory(kind) === 'work',
    )
    if (!unread) throw new Error('Expected an unread work notification.')
    expect(await screen.findByText(unread.title)).toBeVisible()
    expect(screen.queryByText(actorNotifications.find(({ id }) => id !== unread.id)?.title ?? ''))
      .not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: `Select ${unread.title}` }))
    await user.click(screen.getByRole('button', { name: 'Mark selected read' }))
    expect(
      await screen.findByRole('button', { name: 'Notifications, 0 unread' }),
    ).toBeVisible()
    expect(await screen.findByText('1 selected notifications marked as read.'))
      .toHaveAttribute('role', 'status')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'read')
    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
  })
})
