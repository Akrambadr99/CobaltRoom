import { MemoryRouter, Route, Routes } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ProjectDetailPage } from './ProjectDetailPage'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import {
  createAtlasFixtures,
  InMemoryDataStore,
  SimulatedNetwork,
  type RequestSimulator,
} from '../../data'
import type { UserId } from '../../domain'
import { render, screen, waitFor, within } from '../../test/render'

function renderProjectDetail(
  path: string,
  options: {
    readonly actorId?: UserId
    readonly store?: InMemoryDataStore
    readonly simulator?: RequestSimulator
  } = {},
) {
  const services = createAppServices({
    simulator: options.simulator ?? new SimulatedNetwork(),
    ...(options.actorId ? { actorId: options.actorId } : {}),
    ...(options.store ? { dataStore: options.store } : {}),
  })
  return render(
    <AppProviders
      queryClient={createAtlasQueryClient()}
      services={services}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
}

describe('ProjectDetailPage', () => {
  it('loads a deep-linked project and its issue context', async () => {
    const reliabilityProject = createAtlasFixtures().projects.find(
      ({ key }) => key === 'REL',
    )

    if (!reliabilityProject) {
      throw new Error('Expected the reliability fixture project.')
    }

    renderProjectDetail(`/projects/${reliabilityProject.id}`)

    expect(screen.getByRole('status')).toHaveTextContent('Loading project')
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Field reliability',
      }),
    ).toBeVisible()
    expect(screen.getByText('3 issues')).toBeVisible()
    expect(screen.getByText('Close the device telemetry coverage gap')).toBeVisible()
    expect(screen.getByRole('link', { name: '← Projects' })).toHaveAttribute(
      'href',
      '/projects',
    )
  })

  it('does not expose project membership administration to a workspace viewer', async () => {
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects[0]
    const viewer = fixtures.memberships.find(({ role }) => role === 'viewer')
    if (!project || !viewer) throw new Error('Expected viewer and project fixtures.')

    renderProjectDetail(`/projects/${project.id}`, { actorId: viewer.userId })
    expect(
      await screen.findByRole('heading', { level: 1, name: project.name }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Project members' }),
    ).not.toBeInTheDocument()
  })

  it('edits validated project fields and transfers leadership', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects.find(({ key }) => key === 'OPS')
    if (!project) throw new Error('Expected a launch project fixture.')

    renderProjectDetail(`/projects/${project.id}`)
    await screen.findByRole('heading', { level: 1, name: project.name })
    await user.click(screen.getByRole('button', { name: 'Edit project' }))
    const name = screen.getByLabelText('Name')
    await user.clear(name)
    await user.click(screen.getByRole('button', { name: 'Save project' }))
    expect(screen.getByRole('alert')).toHaveTextContent('1 to 120 characters')

    await user.type(name, 'Launch assurance')
    await user.selectOptions(screen.getByLabelText('Lead'), 'Maya Chen')
    await user.selectOptions(screen.getByLabelText('Status'), 'paused')
    await user.click(screen.getByRole('button', { name: 'Save project' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Launch assurance' }),
    ).toBeVisible()
    expect(screen.getByText('OPS · paused')).toBeVisible()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen
          .getByRole('heading', { name: 'Project activity' })
          .closest('section'),
      ).toHaveTextContent('Omar Haddad Updated OPS.')
    })
  })

  it('adds project members and confirms removal with assigned-work reassignment', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects.find(({ key }) => key === 'OPS')
    const observer = fixtures.users.find(({ displayName }) => displayName === 'Theo Martin')
    const productLead = fixtures.users.find(({ displayName }) => displayName === 'Maya Chen')
    const lead = fixtures.users.find(({ displayName }) => displayName === 'Omar Haddad')
    if (!project || !observer || !productLead || !lead) {
      throw new Error('Expected project administration fixtures.')
    }
    const store = new InMemoryDataStore(fixtures)
    renderProjectDetail(`/projects/${project.id}`, { store })
    const memberTable = await screen.findByRole('table', {
      name: 'Project membership administration',
    })

    await user.click(screen.getByRole('button', { name: 'Add member' }))
    let dialog = await screen.findByRole('dialog', { name: 'Add project member' })
    await user.selectOptions(within(dialog).getByLabelText('Member'), observer.id)
    await user.selectOptions(within(dialog).getByLabelText('Project role'), 'viewer')
    await user.click(within(dialog).getByRole('button', { name: 'Add member' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(within(memberTable).getByRole('row', { name: /Theo Martin/ })).toHaveTextContent(
      'Viewer',
    )

    await user.click(
      within(memberTable).getByRole('button', { name: 'Manage Maya Chen' }),
    )
    dialog = await screen.findByRole('dialog', { name: 'Manage Maya Chen' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Remove from project' }),
    )
    const confirmation = await screen.findByRole('dialog', {
      name: 'Remove Maya Chen?',
    })
    expect(within(confirmation).getByLabelText('Reassign 1 assigned issue to'))
      .toHaveValue(lead.id)
    const remove = within(confirmation).getByRole('button', { name: 'Remove member' })
    expect(remove).toHaveFocus()
    await user.click(remove)
    await waitFor(() => {
      expect(within(memberTable).queryByRole('row', { name: /Maya Chen/ }))
        .not.toBeInTheDocument()
    })
    expect(
      store.read().data.issues.filter(
        ({ projectId, assigneeId }) =>
          projectId === project.id && assigneeId === productLead.id,
      ),
    ).toHaveLength(0)
  })

  it('recovers when a member receives assigned work during removal confirmation', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects.find(({ key }) => key === 'OPS')
    const observer = fixtures.users.find(({ displayName }) => displayName === 'Theo Martin')
    const lead = fixtures.users.find(({ displayName }) => displayName === 'Omar Haddad')
    const issue = fixtures.issues.find(({ projectId }) => projectId === project?.id)
    if (!project || !observer || !lead || !issue) {
      throw new Error('Expected project removal concurrency fixtures.')
    }
    const store = new InMemoryDataStore(fixtures)
    renderProjectDetail(`/projects/${project.id}`, { store })
    const memberTable = await screen.findByRole('table', {
      name: 'Project membership administration',
    })

    await user.click(screen.getByRole('button', { name: 'Add member' }))
    let dialog = await screen.findByRole('dialog', { name: 'Add project member' })
    await user.selectOptions(within(dialog).getByLabelText('Member'), observer.id)
    await user.click(within(dialog).getByRole('button', { name: 'Add member' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(
      within(memberTable).getByRole('button', { name: 'Manage Theo Martin' }),
    )
    dialog = await screen.findByRole('dialog', { name: 'Manage Theo Martin' })
    await user.click(
      within(dialog).getByRole('button', { name: 'Remove from project' }),
    )
    let confirmation = await screen.findByRole('dialog', {
      name: 'Remove Theo Martin?',
    })
    expect(within(confirmation).queryByLabelText(/Reassign/)).not.toBeInTheDocument()

    const concurrent = store.read()
    store.commit(concurrent.version, {
      ...concurrent.data,
      issues: concurrent.data.issues.map((candidate) =>
        candidate.id === issue.id
          ? {
              ...candidate,
              assigneeId: observer.id,
              revision: candidate.revision + 1,
            }
          : candidate,
      ),
    })
    await user.click(
      within(confirmation).getByRole('button', { name: 'Remove member' }),
    )

    expect(await within(confirmation).findByRole('alert')).toHaveTextContent(
      'This member owns project issues.',
    )
    confirmation = await screen.findByRole('dialog', {
      name: 'Remove Theo Martin?',
    })
    const reassignment = await within(confirmation).findByLabelText(
      'Reassign 1 assigned issue to',
    )
    await user.selectOptions(reassignment, lead.id)
    await user.click(
      within(confirmation).getByRole('button', { name: 'Remove member' }),
    )

    await waitFor(() => {
      expect(within(memberTable).queryByRole('row', { name: /Theo Martin/ }))
        .not.toBeInTheDocument()
    })
    expect(store.read().data.issues.find(({ id }) => id === issue.id)?.assigneeId)
      .toBe(lead.id)
  })

  it('archives a project through confirmation and exposes its read-only state', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects[0]
    const store = new InMemoryDataStore(fixtures)
    if (!project) throw new Error('Expected a fixture project.')

    renderProjectDetail(`/projects/${project.id}`, { store })
    await screen.findByRole('heading', { level: 1, name: project.name })
    await user.click(screen.getByRole('button', { name: 'Archive project' }))
    expect(screen.getByRole('dialog')).toHaveAccessibleDescription(
      'Existing work remains visible, but issues and comments become read-only.',
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Archive project',
      }),
    )

    expect(
      await screen.findByText(
        'This project is archived. Its issues and comments are read-only.',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Edit project' })).not.toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.getByRole('table', { name: 'Project membership administration' }),
      ).toHaveTextContent('Read-only project')
    })
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument()
    expect(store.read().data.projects.find(({ id }) => id === project.id)).toMatchObject({
      status: 'archived',
      revision: 2,
    })
    await waitFor(() => {
      expect(
        screen
          .getByRole('heading', { name: 'Project activity' })
          .closest('section'),
      ).toHaveTextContent('Omar Haddad Archived OPS.')
    })
  })

  it('keeps project details usable when activity history fails', async () => {
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects[0]
    if (!project) throw new Error('Expected a fixture project.')
    renderProjectDetail(`/projects/${project.id}`, {
      simulator: new SimulatedNetwork({
        failure: (operation) =>
          operation === 'project.activity.get'
            ? 'Scripted activity failure.'
            : null,
      }),
    })

    expect(
      await screen.findByRole('heading', { level: 1, name: project.name }),
    ).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Project activity could not be loaded.',
    )
    expect(screen.getByRole('button', { name: 'Retry activity' })).toBeVisible()
  })

  it('rolls back a rejected update while preserving the project draft', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects[0]
    if (!project) throw new Error('Expected a fixture project.')

    renderProjectDetail(`/projects/${project.id}`, {
      simulator: new SimulatedNetwork({
        failure: (operation) =>
          operation === 'project.update' ? 'Scripted project write failure.' : null,
      }),
    })
    await screen.findByRole('heading', { level: 1, name: project.name })
    await user.click(screen.getByRole('button', { name: 'Edit project' }))
    const name = screen.getByLabelText('Name')
    await user.clear(name)
    await user.type(name, 'Preserved project draft')
    await user.click(screen.getByRole('button', { name: 'Save project' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Scripted project write failure.',
    )
    expect(name).toHaveValue('Preserved project draft')
    expect(screen.getByRole('heading', { level: 1, name: project.name })).toBeVisible()
  })

  it('does not expose lifecycle controls to a read-only workspace viewer', async () => {
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects[0]
    const viewer = fixtures.memberships.find(({ role }) => role === 'viewer')
    if (!project || !viewer) throw new Error('Expected project and viewer fixtures.')

    renderProjectDetail(`/projects/${project.id}`, { actorId: viewer.userId })
    await screen.findByRole('heading', { level: 1, name: project.name })
    expect(screen.queryByRole('button', { name: 'Edit project' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Archive project' })).not.toBeInTheDocument()
  })

  it('renders a safe not-found state for an invalid branded route id', async () => {
    renderProjectDetail('/projects/not-a-project-id')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Project not found' }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Return to projects' }),
    ).toHaveAttribute('href', '/projects')
  })
})
