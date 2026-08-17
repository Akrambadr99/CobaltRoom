import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { GlobalSearch } from './GlobalSearch'
import { AppProviders } from '../../app/providers/AppProviders'
import { createAtlasQueryClient } from '../../app/query-client'
import { createAppServices } from '../../app/services'
import { SimulatedNetwork } from '../../data'
import { render, screen } from '../../test/render'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

function renderSearch(simulator = new SimulatedNetwork()) {
  const services = createAppServices({ simulator })
  return render(
    <AppProviders queryClient={createAtlasQueryClient()} services={services}>
      <MemoryRouter>
        <GlobalSearch />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

describe('GlobalSearch', () => {
  it('focuses with the slash shortcut and navigates to a result', async () => {
    const user = userEvent.setup()
    renderSearch()
    const searchbox = screen.getByRole('searchbox', { name: 'Search all issues' })

    await user.keyboard('/')
    expect(searchbox).toHaveFocus()
    await user.type(searchbox, 'telemetry')

    const result = await screen.findByRole('link', {
      name: /Close the device telemetry coverage gap/i,
    })
    expect(screen.getByRole('list', { name: 'Issue search results' })).toBeVisible()
    await user.click(result)

    expect(screen.getByTestId('location')).toHaveTextContent('/issues/issue_')
    expect(searchbox).toHaveValue('')
  })

  it('hides stale results while a newer debounced search is pending', async () => {
    const user = userEvent.setup()
    renderSearch(
      new SimulatedNetwork({
        latency: (operation) =>
          operation === 'issue.list' || operation === 'project.list' ? 300 : 0,
      }),
    )
    const searchbox = screen.getByRole('searchbox', { name: 'Search all issues' })
    await user.type(searchbox, 'restart')
    expect(await screen.findByText('Searching issues…')).toBeVisible()

    await user.clear(searchbox)
    await user.type(searchbox, 'telemetry')

    expect(
      screen.queryByText('Review intermittent restart incidents'),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByText('Close the device telemetry coverage gap'),
    ).toBeVisible()
    expect(
      screen.queryByText('Review intermittent restart incidents'),
    ).not.toBeInTheDocument()
  })

  it('supports empty, error-retry, and Escape dismissal states', async () => {
    const user = userEvent.setup()
    renderSearch(
      new SimulatedNetwork({
        failure: (operation, requestId) =>
          operation === 'issue.list' && requestId === 'req_000001'
            ? 'Search failed once.'
            : null,
      }),
    )
    const searchbox = screen.getByRole('searchbox', { name: 'Search all issues' })
    await user.type(searchbox, 'zzzz-no-match')

    expect(await screen.findByText('Search is temporarily unavailable.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No issues match “zzzz-no-match”.')).toBeVisible()

    await user.click(searchbox)
    await user.keyboard('{Escape}')
    expect(searchbox).toHaveValue('')
    expect(searchbox).not.toHaveFocus()
    expect(screen.queryByText(/No issues match/)).not.toBeInTheDocument()
  })
})
