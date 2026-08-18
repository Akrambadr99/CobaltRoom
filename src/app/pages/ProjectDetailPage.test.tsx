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
import { projectMemberId, type UserId } from '../../domain'
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
  const queryClient = createAtlasQueryClient()
  const result = render(
    <AppProviders
      queryClient={queryClient}
      services={services}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  )
  return { ...result, queryClient, services }
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

  it('optimistically watches a project and records durable collaboration activity', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects.find(({ key }) => key === 'OPS')
    if (!project) throw new Error('Expected a launch project fixture.')

    renderProjectDetail(`/projects/${project.id}`)
    const watch = await screen.findByRole('button', { name: 'Watch project' })
    const panel = screen.getByRole('heading', { name: 'Project watchers' }).closest('section')
    if (!panel) throw new Error('Expected the project watchers panel.')
    expect(within(panel).getByText('1 watcher')).toBeVisible()
    expect(within(panel).getByRole('list', {
      name: 'People watching this project',
    })).toHaveTextContent('Maya Chen')

    await user.click(watch)

    expect(await within(panel).findByRole('status')).toHaveTextContent(
      'You are now watching this project.',
    )
    const stop = within(panel).getByRole('button', {
      name: 'Stop watching project',
    })
    expect(stop).toHaveAttribute('aria-pressed', 'true')
    expect(stop).toHaveFocus()
    expect(within(panel).getByText('2 watchers')).toBeVisible()
    expect(within(panel).getByRole('list')).toHaveTextContent('Omar Haddad')
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Project activity' }).closest('section'),
      ).toHaveTextContent('Omar Haddad Started watching this project.')
    })
  })

  it('recovers authoritative project watch state after a concurrent change', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects.find(({ key }) => key === 'OPS')
    if (!project) throw new Error('Expected a launch project fixture.')
    const { services } = renderProjectDetail(`/projects/${project.id}`)
    const watch = await screen.findByRole('button', { name: 'Watch project' })

    await services.gateway.setProjectSubscription({
      projectId: project.id,
      expectedSubscribed: false,
      subscribed: true,
    })
    await user.click(watch)

    expect(
      await screen.findByText(
        'Watch state changed in another session. Current state restored.',
      ),
    ).toHaveAttribute('role', 'status')
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Stop watching project' }),
      ).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('coalesces repeated project watch activation while a request is in flight', async () => {
    const user = userEvent.setup()
    const project = createAtlasFixtures().projects[0]
    if (!project) throw new Error('Expected a project fixture.')
    const { services } = renderProjectDetail(`/projects/${project.id}`, {
      simulator: new SimulatedNetwork({
        latency: (operation) =>
          operation === 'project.subscription.update' ? 100 : 0,
      }),
    })
    const watch = await screen.findByRole('button', { name: 'Watch project' })

    await user.click(watch)
    expect(watch).toHaveAttribute('aria-disabled', 'true')
    await user.click(watch)
    expect(await screen.findByText('You are now watching this project.')).toBeVisible()

    const activity = await services.gateway.getProjectActivity(
      project.id,
      { number: 1, size: 20 },
    )
    expect(
      activity.events.items.filter(
        ({ event }) => event.action === 'project.subscribed',
      ),
    ).toHaveLength(1)
  })

  it('retries project watchers independently after a request failure', async () => {
    const user = userEvent.setup()
    const project = createAtlasFixtures().projects[0]
    let failed = false
    if (!project) throw new Error('Expected a project fixture.')
    renderProjectDetail(`/projects/${project.id}`, {
      simulator: new SimulatedNetwork({
        failure: (operation) => {
          if (operation !== 'project.subscription.get' || failed) return null
          failed = true
          return 'Project watchers are temporarily unavailable.'
        },
      }),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Project watchers could not be loaded.',
    )
    await user.click(screen.getByRole('button', { name: 'Retry project watchers' }))
    expect(await screen.findByRole('button', { name: 'Watch project' })).toBeVisible()
  })

  it('keeps archived projects from gaining new watchers', async () => {
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects[0]
    if (!project) throw new Error('Expected a project fixture.')
    const store = new InMemoryDataStore({
      ...fixtures,
      projects: fixtures.projects.map((candidate) =>
        candidate.id === project.id
          ? { ...candidate, status: 'archived' as const, revision: 2 }
          : candidate,
      ),
    })

    renderProjectDetail(`/projects/${project.id}`, { store })

    expect(
      await screen.findByText('Archived projects cannot gain new watchers.'),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Watch project' })).not.toBeInTheDocument()
  })

  it('edits validated project lifecycle fields', async () => {
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

  it('discards an edit draft after permission drift without reopening it later', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects.find(({ key }) => key === 'REL')
    const actorMembership = fixtures.memberships.find(({ role }) => role === 'admin')
    if (!project || !actorMembership) {
      throw new Error('Expected project authorization fixtures.')
    }
    const store = new InMemoryDataStore(fixtures)
    const { queryClient, services } = renderProjectDetail(
      `/projects/${project.id}`,
      { store },
    )
    await screen.findByRole('heading', { level: 1, name: project.name })
    await user.click(screen.getByRole('button', { name: 'Edit project' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit project' })
    await user.clear(within(dialog).getByLabelText('Name'))
    await user.type(within(dialog).getByLabelText('Name'), 'Unsaved project name')

    let current = store.read()
    store.commit(current.version, {
      ...current.data,
      memberships: current.data.memberships.map((membership) =>
        membership.id === actorMembership.id
          ? { ...membership, role: 'viewer' as const, revision: 2 }
          : membership,
      ),
    })
    await queryClient.invalidateQueries({
      queryKey: ['authorization', services.workspaceId],
    })

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Edit project' }))
        .not.toBeInTheDocument()
    })
    const status = await screen.findByText(
      'Your permission to edit this project changed. No changes were saved.',
    )
    expect(status).toHaveAttribute('role', 'status')
    expect(status).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Edit project' }))
      .not.toBeInTheDocument()
    expect((await services.gateway.getProjectEditMetadata(project.id)).project.name)
      .toBe(project.name)

    current = store.read()
    store.commit(current.version, {
      ...current.data,
      memberships: current.data.memberships.map((membership) =>
        membership.id === actorMembership.id
          ? { ...membership, role: 'admin' as const, revision: 3 }
          : membership,
      ),
    })
    await queryClient.invalidateQueries({
      queryKey: ['authorization', services.workspaceId],
    })

    expect(await screen.findByRole('button', { name: 'Edit project' })).toBeVisible()
    expect(screen.queryByRole('dialog', { name: 'Edit project' }))
      .not.toBeInTheDocument()
  })

  it('transfers leadership through an accessible governed confirmation', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects.find(({ key }) => key === 'OPS')
    const currentLead = fixtures.users.find(({ id }) => id === project?.leadId)
    const candidate = fixtures.users.find(({ displayName }) => displayName === 'Maya Chen')
    const alternate = fixtures.users.find(({ displayName }) => displayName === 'Theo Martin')
    if (!project || !currentLead || !candidate || !alternate) {
      throw new Error('Expected lead transfer fixtures.')
    }
    const store = new InMemoryDataStore({
      ...fixtures,
      projectMembers: [
        ...fixtures.projectMembers,
        {
          id: projectMemberId('pm_test_alternate_lead'),
          projectId: project.id,
          userId: alternate.id,
          role: 'viewer',
        },
      ],
    })
    renderProjectDetail(`/projects/${project.id}`, { store })
    await screen.findByRole('heading', { level: 1, name: project.name })

    const trigger = screen.getByRole('button', { name: 'Transfer lead' })
    await user.click(trigger)
    let dialog = await screen.findByRole('dialog', {
      name: 'Transfer project leadership',
    })
    expect(dialog).toHaveAccessibleDescription(
      'Leadership changes immediately update project permissions and member roles.',
    )
    expect(within(dialog).getByLabelText('New project lead')).toHaveValue(candidate.id)
    await user.selectOptions(
      within(dialog).getByLabelText('New project lead'),
      alternate.id,
    )
    await user.selectOptions(
      within(dialog).getByLabelText('New project lead'),
      candidate.id,
    )
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    dialog = await screen.findByRole('dialog', {
      name: 'Transfer project leadership',
    })
    await user.selectOptions(
      within(dialog).getByLabelText('Former lead’s new role'),
      'viewer',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Transfer leadership' }),
    )

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Maya Chen is now the project lead.',
    )
    expect(store.read().data.projects.find(({ id }) => id === project.id)?.leadId)
      .toBe(candidate.id)
    expect(store.read().data.projectMembers.find(
      ({ projectId, userId }) => projectId === project.id && userId === currentLead.id,
    )).toMatchObject({ role: 'viewer' })
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Project activity' }).closest('section'),
      ).toHaveTextContent(
        'Omar Haddad Transferred leadership from Omar Haddad to Maya Chen.',
      )
    })
  })

  it('preserves the selected lead after a concurrent project revision conflict', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects.find(({ key }) => key === 'OPS')
    const candidate = fixtures.users.find(({ displayName }) => displayName === 'Maya Chen')
    if (!project || !candidate) throw new Error('Expected lead conflict fixtures.')
    const store = new InMemoryDataStore(fixtures)
    renderProjectDetail(`/projects/${project.id}`, { store })
    await screen.findByRole('heading', { level: 1, name: project.name })
    await user.click(screen.getByRole('button', { name: 'Transfer lead' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Transfer project leadership',
    })
    const newLead = within(dialog).getByLabelText('New project lead')
    expect(newLead).toHaveValue(candidate.id)

    const concurrent = store.read()
    store.commit(concurrent.version, {
      ...concurrent.data,
      projects: concurrent.data.projects.map((item) =>
        item.id === project.id
          ? { ...item, description: 'Concurrent governance update.', revision: 2 }
          : item,
      ),
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Transfer leadership' }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'project changed after it was loaded',
    )
    expect(newLead).toHaveValue(candidate.id)
    await waitFor(() => {
      expect(within(dialog).getByText('2')).toBeVisible()
    })
  })

  it('retains the rejection reason when a candidate is suspended concurrently', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects.find(({ key }) => key === 'OPS')
    const candidate = fixtures.users.find(({ displayName }) => displayName === 'Maya Chen')
    const candidateMembership = fixtures.memberships.find(
      ({ userId }) => userId === candidate?.id,
    )
    if (!project || !candidate || !candidateMembership) {
      throw new Error('Expected concurrent candidate fixtures.')
    }
    const store = new InMemoryDataStore(fixtures)
    renderProjectDetail(`/projects/${project.id}`, { store })
    await screen.findByRole('heading', { level: 1, name: project.name })
    await user.click(screen.getByRole('button', { name: 'Transfer lead' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Transfer project leadership',
    })
    await within(dialog).findByLabelText('New project lead')

    const current = store.read()
    store.commit(current.version, {
      ...current.data,
      memberships: current.data.memberships.map((membership) =>
        membership.id === candidateMembership.id
          ? { ...membership, status: 'suspended' as const, revision: 2 }
          : membership,
      ),
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Transfer leadership' }),
    )

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'only to an active project member',
    )
    expect(await within(dialog).findByText(
      'No other active project member is eligible to become lead.',
    )).toBeVisible()
  })

  it('removes transfer actions when authorization changes while the dialog is open', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects.find(({ key }) => key === 'OPS')
    const candidate = fixtures.users.find(({ displayName }) => displayName === 'Maya Chen')
    const actorMembership = fixtures.memberships.find(
      ({ userId }) => userId === project?.leadId,
    )
    if (!project || !candidate || !actorMembership) {
      throw new Error('Expected live authorization fixtures.')
    }
    const store = new InMemoryDataStore(fixtures)
    const { queryClient, services } = renderProjectDetail(
      `/projects/${project.id}`,
      { store },
    )
    await screen.findByRole('heading', { level: 1, name: project.name })
    await user.click(screen.getByRole('button', { name: 'Transfer lead' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Transfer project leadership',
    })

    const current = store.read()
    store.commit(current.version, {
      ...current.data,
      projects: current.data.projects.map((item) =>
        item.id === project.id ? { ...item, leadId: candidate.id } : item,
      ),
      memberships: current.data.memberships.map((membership) =>
        membership.id === actorMembership.id
          ? { ...membership, role: 'member' as const, revision: 2 }
          : membership,
      ),
      projectMembers: current.data.projectMembers.map((membership) => {
        if (membership.projectId !== project.id) return membership
        if (membership.userId === project.leadId) {
          return { ...membership, role: 'contributor' as const }
        }
        if (membership.userId === candidate.id) {
          return { ...membership, role: 'lead' as const }
        }
        return membership
      }),
    })
    await queryClient.invalidateQueries({
      queryKey: ['authorization', services.workspaceId],
    })

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'permission to transfer this project changed',
    )
    expect(within(dialog).queryByRole('button', { name: 'Transfer leadership' }))
      .not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Transfer lead' }))
      .not.toBeInTheDocument()
    const close = within(dialog).getByRole('button', { name: 'Close' })
    expect(close).toHaveFocus()
    await user.click(close)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('explains when no other active project member can become lead', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects.find(({ key }) => key === 'OPS')
    if (!project) throw new Error('Expected lead eligibility fixtures.')
    const store = new InMemoryDataStore({
      ...fixtures,
      projectMembers: fixtures.projectMembers.filter(
        ({ projectId, role }) => projectId !== project.id || role === 'lead',
      ),
    })
    renderProjectDetail(`/projects/${project.id}`, { store })
    await screen.findByRole('heading', { level: 1, name: project.name })
    await user.click(screen.getByRole('button', { name: 'Transfer lead' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Transfer project leadership',
    })

    expect(within(dialog).getByText(
      'No other active project member is eligible to become lead.',
    )).toBeVisible()
    expect(within(dialog).queryByRole('button', { name: 'Transfer leadership' }))
      .not.toBeInTheDocument()
  })

  it('retries a transient eligible-member request without closing the dialog', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects.find(({ key }) => key === 'OPS')
    const candidate = fixtures.users.find(({ displayName }) => displayName === 'Maya Chen')
    if (!project || !candidate) throw new Error('Expected lead retry fixtures.')
    let attempts = 0
    renderProjectDetail(`/projects/${project.id}`, {
      simulator: new SimulatedNetwork({
        failure: (operation) => {
          if (operation !== 'administration.project-lead.get') return null
          attempts += 1
          return attempts === 1 ? 'Eligible members are temporarily unavailable.' : null
        },
      }),
    })
    await screen.findByRole('heading', { level: 1, name: project.name })
    await user.click(screen.getByRole('button', { name: 'Transfer lead' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Transfer project leadership',
    })

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Eligible members are temporarily unavailable.',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Retry eligible members' }),
    )
    expect(await within(dialog).findByLabelText('New project lead')).toHaveValue(
      candidate.id,
    )
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
    let confirmation = await screen.findByRole('dialog', {
      name: 'Remove Maya Chen?',
    })
    expect(within(confirmation).getByLabelText('Reassign 1 assigned issue to'))
      .toHaveValue(lead.id)
    let remove = within(confirmation).getByRole('button', { name: 'Remove member' })
    expect(remove).toHaveFocus()
    await user.click(
      within(confirmation).getByRole('button', { name: 'Keep member' }),
    )
    dialog = await screen.findByRole('dialog', { name: 'Manage Maya Chen' })
    const removeFromProject = within(dialog).getByRole('button', {
      name: 'Remove from project',
    })
    expect(removeFromProject).toHaveFocus()
    await user.click(removeFromProject)
    confirmation = await screen.findByRole('dialog', {
      name: 'Remove Maya Chen?',
    })
    remove = within(confirmation).getByRole('button', { name: 'Remove member' })
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

  it('reorders workflow stages and migrates issues before retiring a status', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects.find(({ key }) => key === 'OPS')
    const statuses = fixtures.workflowStatuses
      .filter(({ projectId }) => projectId === project?.id)
      .sort((left, right) => left.order - right.order)
    const active = statuses.find(({ name }) => name === 'In progress')
    const completed = statuses.find(({ name }) => name === 'Done')
    const completedIssue = fixtures.issues.find(({ statusId }) => statusId === completed?.id)
    if (!project || !active || !completed || !completedIssue) {
      throw new Error('Expected workflow editor fixtures.')
    }
    const store = new InMemoryDataStore(fixtures)
    renderProjectDetail(`/projects/${project.id}`, { store })
    const workflowTable = await screen.findByRole('table', {
      name: 'Project workflow administration',
    })

    await user.click(screen.getByRole('button', { name: 'Configure workflow' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Configure project workflow',
    })
    const names = within(dialog).getAllByLabelText(/Status \d+ name/)
    const backlogName = names[0]
    if (!backlogName) throw new Error('Expected the backlog workflow field.')
    await user.clear(backlogName)
    await user.type(backlogName, 'Intake queue')
    const backlogCategory = within(dialog).getAllByLabelText(/Status \d+ category/)[0]
    if (!backlogCategory) throw new Error('Expected the backlog workflow category.')
    await user.selectOptions(backlogCategory, 'unstarted')
    await user.click(within(dialog).getByRole('button', { name: 'Move In progress up' }))
    await user.click(within(dialog).getByRole('button', { name: 'Add status' }))
    const updatedNames = within(dialog).getAllByLabelText(/Status \d+ name/)
    const addedName = updatedNames.at(-1)
    if (!addedName) throw new Error('Expected the added workflow field.')
    await user.type(addedName, 'Verified')
    const categoryFields = within(dialog).getAllByLabelText(/Status \d+ category/)
    const addedCategory = categoryFields.at(-1)
    if (!addedCategory) throw new Error('Expected the added workflow category.')
    await user.selectOptions(addedCategory, 'completed')
    await user.click(within(dialog).getByRole('button', { name: 'Retire Done' }))
    expect(within(dialog).getByLabelText('Move 1 issue from Done to')).toHaveValue(active.id)
    await user.click(within(dialog).getByRole('button', { name: 'Save workflow' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => {
      const rows = within(workflowTable).getAllByRole('row').slice(1)
      expect(rows.map((row) => row.textContent)).toEqual([
        expect.stringContaining('In progress'),
        expect.stringContaining('Intake queueUnstarted'),
        expect.stringContaining('Verified'),
      ])
    })
    expect(store.read().data.issues.find(({ id }) => id === completedIssue.id)).toMatchObject({
      statusId: active.id,
      revision: completedIssue.revision + 1,
    })
  })

  it('preserves a workflow draft after a concurrent project revision conflict', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects.find(({ key }) => key === 'OPS')
    if (!project) throw new Error('Expected a workflow concurrency project.')
    const store = new InMemoryDataStore(fixtures)
    renderProjectDetail(`/projects/${project.id}`, { store })
    await screen.findByRole('table', { name: 'Project workflow administration' })
    await user.click(screen.getByRole('button', { name: 'Configure workflow' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Configure project workflow',
    })
    const backlogName = within(dialog).getAllByLabelText(/Status \d+ name/)[0]
    if (!backlogName) throw new Error('Expected the workflow draft field.')
    await user.clear(backlogName)
    await user.type(backlogName, 'Preserved intake draft')

    const concurrent = store.read()
    store.commit(concurrent.version, {
      ...concurrent.data,
      projects: concurrent.data.projects.map((candidate) =>
        candidate.id === project.id
          ? { ...candidate, name: 'Concurrent project name', revision: 2 }
          : candidate,
      ),
    })
    await user.click(within(dialog).getByRole('button', { name: 'Save workflow' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'project changed after it was loaded',
    )
    expect(backlogName).toHaveValue('Preserved intake draft')
    expect(within(dialog).getByRole('button', { name: 'Reload latest workflow' }))
      .toBeVisible()
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
    expect(screen.queryByRole('button', { name: 'Configure workflow' }))
      .not.toBeInTheDocument()
    expect(screen.getByText('Reactivate this project before changing its workflow.'))
      .toBeVisible()
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
