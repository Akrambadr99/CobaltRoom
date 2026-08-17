import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { DashboardPage } from './DashboardPage'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import {
  createAtlasFixtures,
  SimulatedNetwork,
  type RequestSimulator,
} from '../../data'
import type { UserId } from '../../domain'
import { render, screen } from '../../test/render'

function renderDashboard(
  simulator: RequestSimulator = new SimulatedNetwork(),
  actorId?: UserId,
) {
  const services = createAppServices({
    simulator,
    ...(actorId ? { actorId } : {}),
  })
  const queryClient = createAtlasQueryClient()

  return {
    services,
    ...render(
      <AppProviders queryClient={queryClient} services={services}>
        <DashboardPage />
      </AppProviders>,
    ),
  }
}

describe('DashboardPage', () => {
  it('loads workspace metrics and a priority-ordered issue queue', async () => {
    renderDashboard()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading workspace overview',
    )
    expect(await screen.findByText('Active projects')).toBeVisible()
    expect(screen.getByText('Tracked issues')).toBeVisible()
    expect(screen.getByText('5 of 6 issues')).toBeVisible()
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('updates issue priority through the mutation and reconciles the cache', async () => {
    const user = userEvent.setup()
    const { services } = renderDashboard()
    const initialIssues = await services.gateway.listIssues({
      filters: { workspaceId: services.workspaceId },
      page: { number: 1, size: 100 },
    })
    const initialIssue = initialIssues.items.find(
      ({ title }) => title === 'Publish the launch readiness brief',
    )

    if (!initialIssue) {
      throw new Error('Expected the launch readiness fixture issue.')
    }

    const priority = await screen.findByRole('combobox', {
      name: 'Priority for Publish the launch readiness brief',
    })

    await user.selectOptions(priority, 'low')

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Priority updated for Publish the launch readiness brief.',
    )
    expect(priority).toHaveValue('low')
    expect(screen.getAllByRole('listitem').at(-1)).toHaveTextContent(
      'Publish the launch readiness brief',
    )

    const issue = await services.gateway.getIssue(initialIssue.id)
    expect(issue.revision).toBeGreaterThan(1)
  })

  it('offers a retry action when dashboard requests fail', async () => {
    renderDashboard(
      new SimulatedNetwork({ failure: () => 'Scripted dashboard failure.' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Workspace data is unavailable',
    )
    expect(
      screen.getByRole('button', { name: 'Retry dashboard' }),
    ).toBeEnabled()
  })

  it('disables inline mutation controls for a read-only actor', async () => {
    const fixtures = createAtlasFixtures()
    const viewerId = fixtures.memberships.find(({ role }) => role === 'viewer')?.userId

    if (!viewerId) throw new Error('Expected a read-only fixture actor.')

    renderDashboard(new SimulatedNetwork(), viewerId)

    expect(
      await screen.findByRole('combobox', {
        name: 'Priority for Publish the launch readiness brief',
      }),
    ).toBeDisabled()
  })
})
