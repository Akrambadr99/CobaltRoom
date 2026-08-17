import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { IssueDetailPage } from './IssueDetailPage'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import {
  createAtlasFixtures,
  FixedClock,
  SimulatedNetwork,
  type Clock,
  type RequestSimulator,
} from '../../data'
import { isoDateTime, type UserId } from '../../domain'
import { render, screen, within } from '../../test/render'

function getFixtureIssue() {
  const issue = createAtlasFixtures().issues[0]
  if (!issue) throw new Error('Expected a fixture issue.')
  return issue
}

function renderIssueDetail(
  path: string,
  actorId?: UserId,
  simulator: RequestSimulator = new SimulatedNetwork(),
  clock?: Clock,
) {
  const services = createAppServices({
    simulator,
    ...(actorId ? { actorId } : {}),
    ...(clock ? { clock } : {}),
  })
  render(
    <AppProviders queryClient={createAtlasQueryClient()} services={services}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/issues/:issueId" element={<IssueDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
  return services
}

describe('IssueDetailPage', () => {
  it('loads a deep-linked issue and edits validated fields', async () => {
    const user = userEvent.setup()
    const issue = getFixtureIssue()
    renderIssueDetail(`/issues/${issue.id}`)

    expect(screen.getByText('Loading issue…')).toBeVisible()
    expect(await screen.findByRole('heading', { name: issue.title })).toBeVisible()
    expect(screen.getByText('Launch readiness')).toBeVisible()
    expect(
      await screen.findByText(/include explicit rollback owners/i),
    ).toBeVisible()
    expect(screen.getByText(/Moved the launch brief into progress/i)).toBeVisible()

    const editButton = screen.getByRole('button', { name: 'Edit issue' })
    await user.click(editButton)
    const title = screen.getByLabelText('Title')
    expect(title).toHaveFocus()
    await user.clear(title)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(screen.getByText('Enter an issue title.')).toBeVisible()

    await user.type(title, 'Publish the final launch brief')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Issue changes saved.')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Publish the final launch brief' }),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(editButton).toHaveFocus()
  }, 10_000)

  it('refreshes after a revision conflict and preserves the draft for retry', async () => {
    const user = userEvent.setup()
    const fixtureIssue = getFixtureIssue()
    const services = renderIssueDetail(`/issues/${fixtureIssue.id}`)

    await screen.findByRole('heading', { name: fixtureIssue.title })
    await services.gateway.updateIssue({
      id: fixtureIssue.id,
      expectedRevision: fixtureIssue.revision,
      changes: { description: 'A concurrent editor changed this description.' },
    })

    await user.click(screen.getByRole('button', { name: 'Edit issue' }))
    const title = screen.getByLabelText('Title')
    await user.clear(title)
    await user.type(title, 'Conflict-safe launch brief')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText(/changed elsewhere.*latest revision is loaded/i),
    ).toBeVisible()
    expect(title).toHaveValue('Conflict-safe launch brief')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Issue changes saved.')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Conflict-safe launch brief' }),
    ).toBeVisible()
  })

  it('rejects malformed branded issue identifiers without requesting data', async () => {
    renderIssueDetail('/issues/not-an-issue')
    expect(
      await screen.findByRole('heading', { name: 'Issue not found' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Return to issues' })).toHaveAttribute(
      'href',
      '/issues',
    )
  })

  it('presents issues as read-only when the actor cannot update them', async () => {
    const fixtures = createAtlasFixtures()
    const issue = fixtures.issues[0]
    const viewerId = fixtures.memberships.find(({ role }) => role === 'viewer')?.userId

    if (!issue || !viewerId) {
      throw new Error('Expected issue and viewer fixtures.')
    }

    renderIssueDetail(`/issues/${issue.id}`, viewerId)

    expect(await screen.findByRole('heading', { name: issue.title })).toBeVisible()
    expect(screen.getByText('Read-only access')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Edit issue' }),
    ).not.toBeInTheDocument()
    expect(
      await screen.findByText(/include explicit rollback owners/i),
    ).toBeVisible()
    expect(screen.queryByRole('form', { name: 'Add comment' })).not.toBeInTheDocument()
  })

  it('validates and creates a comment with focus-preserving feedback', async () => {
    const user = userEvent.setup()
    const issue = getFixtureIssue()
    const clock = new FixedClock(isoDateTime('2026-03-01T10:30:00.000Z'))
    renderIssueDetail(
      `/issues/${issue.id}`,
      undefined,
      new SimulatedNetwork(),
      clock,
    )

    const comment = await screen.findByLabelText('Add a comment')
    await user.click(screen.getByRole('button', { name: 'Add comment' }))
    expect(
      screen.getByText('Enter a comment between 1 and 5,000 characters.'),
    ).toBeVisible()

    await user.type(comment, 'Confirmed the escalation and rollback owners.')
    await user.click(screen.getByRole('button', { name: 'Add comment' }))

    const status = await screen.findByText('Comment added.')
    expect(status).toHaveAttribute('role', 'status')
    expect(comment).toHaveValue('')
    expect(comment).toHaveFocus()
    expect(
      screen.getByText('Confirmed the escalation and rollback owners.'),
    ).toBeVisible()
    const activityColumn = screen
      .getByRole('heading', { name: 'Activity' })
      .closest<HTMLElement>('.issue-collaboration__column')
    if (!activityColumn) throw new Error('Expected the activity column.')
    expect(within(activityColumn).getByText('Added a comment.')).toBeVisible()
    expect(screen.getAllByText('Mar 1, 2026, 10:30 AM')).toHaveLength(2)
  })

  it('offers independent recovery when collaboration history fails', async () => {
    const issue = getFixtureIssue()
    renderIssueDetail(
      `/issues/${issue.id}`,
      undefined,
      new SimulatedNetwork({
        failure: (operation) =>
          operation === 'issue.activity' ? 'Scripted history failure.' : null,
      }),
    )

    expect(await screen.findByRole('heading', { name: issue.title })).toBeVisible()
    expect(
      await screen.findByText('Comments and activity could not be loaded.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry history' })).toBeEnabled()
  })

  it('preserves a comment draft when submission fails', async () => {
    const user = userEvent.setup()
    const issue = getFixtureIssue()
    renderIssueDetail(
      `/issues/${issue.id}`,
      undefined,
      new SimulatedNetwork({
        failure: (operation) =>
          operation === 'comment.create' ? 'Comment service unavailable.' : null,
      }),
    )

    const comment = await screen.findByLabelText('Add a comment')
    await user.type(comment, 'Keep this draft after failure.')
    await user.click(screen.getByRole('button', { name: 'Add comment' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Comment service unavailable.',
    )
    expect(comment).toHaveValue('Keep this draft after failure.')
    expect(screen.getByRole('button', { name: 'Add comment' })).toBeEnabled()
  })
})
