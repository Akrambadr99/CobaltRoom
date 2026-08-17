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
