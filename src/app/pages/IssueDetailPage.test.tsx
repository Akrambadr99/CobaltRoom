import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { IssueDetailPage } from './IssueDetailPage'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import { createAtlasFixtures, SimulatedNetwork } from '../../data'
import { render, screen } from '../../test/render'

function getFixtureIssue() {
  const issue = createAtlasFixtures().issues[0]
  if (!issue) throw new Error('Expected a fixture issue.')
  return issue
}

function renderIssueDetail(path: string) {
  const services = createAppServices({ simulator: new SimulatedNetwork() })
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
  })

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
})
