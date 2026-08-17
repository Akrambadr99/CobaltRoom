import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { IssuesPage } from './IssuesPage'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import { createAtlasFixtures, SimulatedNetwork } from '../../data'
import type { UserId } from '../../domain'
import { render, screen, waitFor, within } from '../../test/render'

function LocationProbe() {
  const location = useLocation()
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  )
}

function renderIssues(
  path = '/issues',
  simulator = new SimulatedNetwork(),
  actorId?: UserId,
) {
  const services = createAppServices({
    simulator,
    ...(actorId ? { actorId } : {}),
  })

  return {
    services,
    ...render(
      <AppProviders
        queryClient={createAtlasQueryClient()}
        services={services}
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
            <Route path="/issues/:issueId" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    ),
  }
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

  it('prevents selecting issues a read-only actor cannot mutate', async () => {
    const fixtures = createAtlasFixtures()
    const viewerId = fixtures.memberships.find(({ role }) => role === 'viewer')?.userId

    if (!viewerId) throw new Error('Expected a read-only fixture actor.')

    renderIssues('/issues', new SimulatedNetwork(), viewerId)

    const table = await screen.findByRole('table', { name: 'Workspace issues' })
    expect(
      within(table).getByRole('checkbox', {
        name: 'Select all rows on this page',
      }),
    ).toBeDisabled()
    for (const checkbox of within(table).getAllByRole('checkbox')) {
      expect(checkbox).toBeDisabled()
    }
    expect(
      screen.queryByRole('button', { name: 'Create issue' }),
    ).not.toBeInTheDocument()
  })

  it(
    'creates a fully classified issue and navigates to its detail route',
    async () => {
      const user = userEvent.setup()
      const { services } = renderIssues()

      await screen.findByRole('table', { name: 'Workspace issues' })
      await user.click(screen.getByRole('button', { name: 'Create issue' }))
      const dialog = screen.getByRole('dialog', { name: 'Create issue' })
      const title = await within(dialog).findByLabelText('Title')
      expect(within(dialog).getByLabelText('Project')).toHaveFocus()

      await user.click(
        within(dialog).getByRole('button', { name: 'Create issue' }),
      )
      expect(within(dialog).getByText('Enter an issue title.')).toBeVisible()

      await user.selectOptions(
        within(dialog).getByLabelText('Project'),
        within(dialog).getByRole('option', { name: 'Launch readiness' }),
      )
      expect(within(dialog).getByLabelText('Status')).toHaveDisplayValue('Backlog')
      await user.type(title, 'Coordinate the launch decision review')
      await user.type(
        within(dialog).getByLabelText('Description'),
        'Confirm decisions, owners, and escalation paths.',
      )
      await user.selectOptions(within(dialog).getByLabelText('Type'), 'story')
      await user.selectOptions(within(dialog).getByLabelText('Priority'), 'high')
      await user.selectOptions(
        within(dialog).getByLabelText('Assignee'),
        within(dialog).getByRole('option', { name: 'Omar Haddad' }),
      )
      await user.type(within(dialog).getByLabelText('Due date'), '2026-03-04')
      await user.click(within(dialog).getByLabelText('Customer impact'))
      await user.click(
        within(dialog).getByRole('button', { name: 'Create issue' }),
      )

      await waitFor(() => {
        expect(screen.getByTestId('location')).toHaveTextContent(
          /^\/issues\/issue_/,
        )
      })
      const created = await services.gateway.listIssues({
        filters: {
          workspaceId: services.workspaceId,
          search: 'launch decision review',
        },
      })
      const createdIssue = created.items[0]
      expect(createdIssue).toMatchObject({
        type: 'story',
        priority: 'high',
        title: 'Coordinate the launch decision review',
        dueDate: '2026-03-04',
      })
      expect(createdIssue?.assigneeId).not.toBeNull()
      expect(createdIssue?.labelIds).toHaveLength(1)
    },
    10_000,
  )

  it('prevents dismissal while a creation request is in flight', async () => {
    const user = userEvent.setup()
    renderIssues(
      '/issues',
      new SimulatedNetwork({
        latency: (operation) => (operation === 'issue.create' ? 150 : 0),
      }),
    )

    await screen.findByRole('table', { name: 'Workspace issues' })
    await user.click(screen.getByRole('button', { name: 'Create issue' }))
    const dialog = screen.getByRole('dialog', { name: 'Create issue' })
    await user.type(await within(dialog).findByLabelText('Title'), 'Durable request')
    await user.click(within(dialog).getByRole('button', { name: 'Create issue' }))

    expect(within(dialog).getByRole('button', { name: 'Creating…' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(dialog).toBeVisible()
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        /^\/issues\/issue_/,
      )
    })
  })

  it('limits the creation project selector to the actor project scope', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const memberId = fixtures.memberships.find(({ role }) => role === 'member')?.userId

    if (!memberId) throw new Error('Expected a project-scoped member fixture.')

    renderIssues('/issues', new SimulatedNetwork(), memberId)
    await screen.findByRole('table', { name: 'Workspace issues' })
    await user.click(screen.getByRole('button', { name: 'Create issue' }))
    const dialog = screen.getByRole('dialog', { name: 'Create issue' })
    const project = await within(dialog).findByLabelText('Project')

    expect(project).toHaveDisplayValue('Field reliability')
    expect(within(project).getAllByRole('option')).toHaveLength(1)
    expect(
      within(project).queryByRole('option', { name: 'Launch readiness' }),
    ).not.toBeInTheDocument()
  })

  it('offers recovery when issue creation metadata fails to load', async () => {
    const user = userEvent.setup()
    renderIssues(
      '/issues',
      new SimulatedNetwork({
        failure: (operation) =>
          operation === 'issue.creation-metadata'
            ? 'Scripted metadata failure.'
            : null,
      }),
    )

    await screen.findByRole('table', { name: 'Workspace issues' })
    await user.click(screen.getByRole('button', { name: 'Create issue' }))

    expect(
      await screen.findByText('Issue fields could not be loaded.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry fields' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
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
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/issues$/)
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
