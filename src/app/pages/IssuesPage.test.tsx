import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { IssuesPage } from './IssuesPage'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import { SimulatedNetwork } from '../../data'
import { render, screen, within } from '../../test/render'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.search}</output>
}

function renderIssues(
  path = '/issues',
  simulator = new SimulatedNetwork(),
) {
  return render(
    <AppProviders
      queryClient={createAtlasQueryClient()}
      services={createAppServices({ simulator })}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/issues"
            element={
              <>
                <IssuesPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

describe('IssuesPage', () => {
  it('loads paginated issue data and exposes sortable table semantics', async () => {
    const user = userEvent.setup()
    renderIssues()

    expect(screen.getByText('Loading issues…')).toBeVisible()
    const table = await screen.findByRole('table', { name: 'Workspace issues' })

    expect(within(table).getAllByRole('row')).toHaveLength(6)
    expect(screen.getByText('6 matching issues')).toBeVisible()
    expect(screen.getByText('Page 1 of 2')).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /Title/ })).not.toHaveAttribute(
      'aria-sort',
    )
    expect(
      screen.getByRole('columnheader', { name: /Due/ }),
    ).not.toHaveAttribute('aria-sort')

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Page 2 of 2')).toBeVisible()
    expect(screen.getByTestId('location')).toHaveTextContent('page=2')
    expect(within(table).getAllByRole('row')).toHaveLength(2)
  })

  it('writes filters and sorting to the URL', async () => {
    const user = userEvent.setup()
    renderIssues()

    await screen.findByRole('table', { name: 'Workspace issues' })
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')

    expect(await screen.findByText('2 matching issues')).toBeVisible()
    expect(screen.getByTestId('location')).toHaveTextContent('priority=high')

    await user.clear(screen.getByLabelText('Search issues'))
    await user.type(screen.getByLabelText('Search issues'), 'restart')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('1 matching issue')).toBeVisible()
    expect(screen.getByText('Review intermittent restart incidents')).toBeVisible()
    expect(screen.getByTestId('location')).toHaveTextContent('q=restart')

    await user.click(screen.getByRole('button', { name: /Title/ }))
    expect(screen.getByTestId('location')).toHaveTextContent('sort=title')
    expect(screen.getByTestId('location')).toHaveTextContent('direction=ascending')
  })

  it('shows a useful empty state for a valid query with no matches', async () => {
    renderIssues('/issues?q=does-not-exist')

    expect(await screen.findByText('No matching issues')).toBeVisible()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('recovers from a page that is outside the available result set', async () => {
    const user = userEvent.setup()
    renderIssues('/issues?page=99')

    expect(await screen.findByText('Page out of range')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Return to first page' }))

    expect(await screen.findByRole('table', { name: 'Workspace issues' })).toBeVisible()
    expect(screen.getByTestId('location')).toHaveTextContent(/^$/)
  })

  it('retains selections across pages and applies a bulk priority update', async () => {
    const user = userEvent.setup()
    renderIssues()

    await screen.findByRole('table', { name: 'Workspace issues' })
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select Publish the launch readiness brief',
      }),
    )
    expect(screen.getByLabelText('Bulk issue actions')).toHaveTextContent(
      '1 issue selected',
    )

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 2 of 2')
    await user.click(
      screen.getByRole('checkbox', { name: 'Select Tune restart anomaly alerts' }),
    )
    expect(screen.getByLabelText('Bulk issue actions')).toHaveTextContent(
      '2 issues selected',
    )

    await user.selectOptions(screen.getByLabelText('Set priority'), 'medium')
    await user.click(screen.getByRole('button', { name: 'Apply priority' }))

    expect(await screen.findByText('2 issues updated.')).toBeVisible()
    expect(screen.queryByLabelText('Bulk issue actions')).not.toBeInTheDocument()
  })

  it('keeps a failed bulk item selected and retries it with refreshed data', async () => {
    const user = userEvent.setup()
    let shouldFail = true
    const simulator = new SimulatedNetwork({
      failure: (operation) => {
        if (operation === 'issue.update' && shouldFail) {
          shouldFail = false
          return 'Temporary write outage.'
        }
        return null
      },
    })
    renderIssues('/issues', simulator)

    await screen.findByRole('table', { name: 'Workspace issues' })
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Select Publish the launch readiness brief',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Apply priority' }))

    expect(
      await screen.findByText(/1 issue failed and remains selected.*Temporary write outage/),
    ).toBeVisible()
    expect(screen.getByLabelText('Bulk issue actions')).toHaveTextContent(
      '1 issue selected',
    )

    await user.click(screen.getByRole('button', { name: 'Apply priority' }))
    expect(await screen.findByText('1 issue updated.')).toBeVisible()
    expect(screen.queryByLabelText('Bulk issue actions')).not.toBeInTheDocument()
  })
})
