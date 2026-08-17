import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AnalyticsPage } from './AnalyticsPage'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import { FixedClock, SimulatedNetwork } from '../../data'
import { isoDateTime } from '../../domain'
import { render, screen } from '../../test/render'

function renderAnalytics(
  simulator = new SimulatedNetwork(),
  path = '/analytics',
) {
  const services = createAppServices({
    simulator,
    clock: new FixedClock(isoDateTime('2026-02-10T12:00:00.000Z')),
  })
  render(
    <AppProviders queryClient={createAtlasQueryClient()} services={services}>
      <MemoryRouter initialEntries={[path]}>
        <AnalyticsPage />
        <LocationProbe />
      </MemoryRouter>
    </AppProviders>,
  )
}

function LocationProbe() {
  return <div data-testid="analytics-location">{useLocation().search}</div>
}

describe('AnalyticsPage', () => {
  it('renders gateway aggregates with semantic project health data', async () => {
    renderAnalytics()
    expect(screen.getByRole('status')).toHaveTextContent('Loading analytics')
    expect(await screen.findByRole('heading', { name: 'Project delivery health' })).toBeVisible()

    const table = screen.getByRole('table', {
      name: 'Project issue volume, completion, urgency, and overdue work',
    })
    expect(table).toHaveTextContent('Field reliability')
    expect(table).toHaveTextContent('Launch readiness')
    expect(screen.getByText('Snapshot generated')).toHaveTextContent(
      'Feb 10, 2026, 12:00 PM',
    )
    expect(screen.getByRole('table', {
      name: 'Created and updated issue counts by reporting period',
    })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Urgent' })).toHaveAttribute(
      'href',
      '/issues?priority=urgent',
    )
  })

  it('stores reporting range in the URL and renders deterministic period totals', async () => {
    const user = userEvent.setup()
    renderAnalytics(new SimulatedNetwork(), '/analytics?range=all-time')

    const range = await screen.findByRole('combobox', { name: 'Time range' })
    expect(range).toHaveValue('all-time')
    expect(screen.getByText('Created in range').closest('.metric-card')).toHaveTextContent('6')
    await user.selectOptions(range, '90-days')
    expect(screen.getByTestId('analytics-location')).toHaveTextContent('range=90-days')
    expect(await screen.findByRole('combobox', { name: 'Time range' })).toHaveValue('90-days')
  })

  it('offers explicit recovery when aggregate loading fails', async () => {
    renderAnalytics(new SimulatedNetwork({ failure: () => 'Analytics unavailable.' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Analytics are unavailable',
    )
    expect(screen.getByRole('button', { name: 'Retry analytics' })).toBeEnabled()
  })
})
