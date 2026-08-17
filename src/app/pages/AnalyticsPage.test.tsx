import { describe, expect, it } from 'vitest'

import { AnalyticsPage } from './AnalyticsPage'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import { FixedClock, SimulatedNetwork } from '../../data'
import { isoDateTime } from '../../domain'
import { render, screen } from '../../test/render'

function renderAnalytics(simulator = new SimulatedNetwork()) {
  const services = createAppServices({
    simulator,
    clock: new FixedClock(isoDateTime('2026-02-10T12:00:00.000Z')),
  })
  render(
    <AppProviders queryClient={createAtlasQueryClient()} services={services}>
      <AnalyticsPage />
    </AppProviders>,
  )
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
  })

  it('offers explicit recovery when aggregate loading fails', async () => {
    renderAnalytics(new SimulatedNetwork({ failure: () => 'Analytics unavailable.' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Analytics are unavailable',
    )
    expect(screen.getByRole('button', { name: 'Retry analytics' })).toBeEnabled()
  })
})
