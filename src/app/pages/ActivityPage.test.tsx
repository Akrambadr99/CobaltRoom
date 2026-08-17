import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import {
  createAtlasFixtures,
  InMemoryDataStore,
  SimulatedNetwork,
} from '../../data'
import { activityEventId, isoDateTime } from '../../domain'
import { render, screen } from '../../test/render'
import { ActivityPage } from './ActivityPage'

function renderActivity(
  initialEntry = '/activity',
  dataStore?: InMemoryDataStore,
  simulator?: SimulatedNetwork,
) {
  const services = createAppServices({
    ...(dataStore ? { dataStore } : {}),
    ...(simulator ? { simulator } : {}),
  })
  render(
    <AppProviders queryClient={createAtlasQueryClient()} services={services}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ActivityPage />
      </MemoryRouter>
    </AppProviders>,
  )
  return services
}

describe('ActivityPage', () => {
  it('renders a semantic feed with URL-backed actor, action, and entity links', async () => {
    const user = userEvent.setup()
    renderActivity()

    const timeline = await screen.findByRole('list', { name: 'Workspace activity timeline' })
    expect(timeline).toHaveTextContent('Moved the launch brief into progress.')
    expect(timeline).toHaveTextContent('OPS-1 · Publish the launch readiness brief')

    await user.click(screen.getByRole('link', { name: 'issue.updated' }))
    expect(await screen.findByText('1 matching events')).toBeVisible()
    expect(screen.getByRole('combobox', { name: 'Action' })).toHaveValue('issue.updated')

    await user.click(screen.getByRole('link', { name: /Filter activity for OPS-1/ }))
    expect(
      await screen.findByRole('textbox', { name: 'Entity ID' }),
    ).not.toHaveValue('')
  })

  it('recovers stale page links against large deterministic history', async () => {
    const fixtures = createAtlasFixtures()
    const source = fixtures.activityEvents[0]
    if (!source) throw new Error('Expected an activity fixture.')
    const activityEvents = Array.from({ length: 21 }, (_, index) => ({
      ...source,
      id: activityEventId(`activity_page_${index.toString().padStart(3, '0')}`),
      occurredAt: isoDateTime(`2026-02-${(index + 1).toString().padStart(2, '0')}T10:00:00.000Z`),
      summary: `Activity history ${String(index + 1)}.`,
    }))
    renderActivity(
      '/activity?page=99',
      new InMemoryDataStore({ ...fixtures, activityEvents }),
    )

    expect(await screen.findByText('Page 2 of 2')).toBeVisible()
    expect(screen.getByText('Activity history 1.')).toBeVisible()
  })

  it('isolates gateway failures and offers an accessible retry', async () => {
    renderActivity(
      '/activity',
      undefined,
      new SimulatedNetwork({
        failure: (operation) => operation === 'activity.list' ? 'Activity history unavailable.' : null,
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Workspace activity unavailable')
    expect(screen.getByRole('button', { name: 'Retry activity' })).toBeVisible()
  })

  it('ignores impossible dates from shared links', async () => {
    renderActivity('/activity?from=2026-02-31')

    expect(await screen.findByText('1 matching events')).toBeVisible()
    expect(screen.getByLabelText('From date')).toHaveValue('')
  })

  it('applies date filters, reports empty history, and clears URL state', async () => {
    const user = userEvent.setup()
    renderActivity()
    await screen.findByText('1 matching events')

    await user.type(screen.getByLabelText('From date'), '2026-02-02')
    await user.click(screen.getByRole('button', { name: 'Apply filters' }))
    expect(await screen.findByText('No activity matches these filters.')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByText('1 matching events')).toBeVisible()
    expect(screen.getByLabelText('From date')).toHaveValue('')
  })
})
