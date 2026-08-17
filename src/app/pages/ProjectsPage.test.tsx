import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { ProjectsPage } from './ProjectsPage'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import { SimulatedNetwork, type RequestSimulator } from '../../data'
import { render, screen, within } from '../../test/render'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.search}</output>
}

function renderProjects(
  path = '/projects',
  simulator: RequestSimulator = new SimulatedNetwork(),
) {
  const services = createAppServices({ simulator })

  return render(
    <AppProviders queryClient={createAtlasQueryClient()} services={services}>
      <MemoryRouter initialEntries={[path]}>
        <ProjectsPage />
        <LocationProbe />
      </MemoryRouter>
    </AppProviders>,
  )
}

describe('ProjectsPage', () => {
  it('renders authoritative workflow-aware project summaries', async () => {
    renderProjects()

    expect(screen.getByText('Loading projects…')).toBeVisible()
    const projects = await screen.findByRole('list', {
      name: 'Workspace projects',
    })
    const projectCards = within(projects).getAllByRole('listitem')
    const firstProjectCard = projectCards[0]

    if (!firstProjectCard) throw new Error('Expected the first project card.')

    expect(projectCards).toHaveLength(2)
    expect(firstProjectCard).toHaveTextContent('Field reliability')
    expect(firstProjectCard).toHaveTextContent('Status: Active')
    expect(within(firstProjectCard).getByText('Open').nextSibling).toHaveTextContent('2')
    expect(within(firstProjectCard).getByText('Completed').nextSibling).toHaveTextContent('1')
    expect(within(firstProjectCard).getByText('Total').nextSibling).toHaveTextContent('3')
    expect(
      within(firstProjectCard).getByRole('link', { name: 'Field reliability' }),
    ).toHaveAttribute('href', expect.stringMatching(/^\/projects\/prj_/))
    expect(screen.getByText('2 matching projects')).toBeVisible()
  })

  it('writes search and status filters to resilient URL state', async () => {
    const user = userEvent.setup()
    renderProjects()
    await screen.findByRole('list', { name: 'Workspace projects' })

    await user.type(screen.getByRole('searchbox', { name: 'Search projects' }), 'REL')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('1 matching project')).toBeVisible()
    expect(screen.getByText('Field reliability')).toBeVisible()
    expect(screen.getByTestId('location')).toHaveTextContent('q=REL')

    await user.selectOptions(screen.getByLabelText('Status'), 'planned')
    expect(await screen.findByText('No matching projects')).toBeVisible()
    expect(screen.getByTestId('location')).toHaveTextContent('status=planned')
  })

  it('offers recovery for stale out-of-range deep links', async () => {
    const user = userEvent.setup()
    renderProjects('/projects?page=999')

    expect(await screen.findByText('Page out of range')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Return to first page' }))
    expect(
      await screen.findByRole('list', { name: 'Workspace projects' }),
    ).toBeVisible()
    expect(screen.getByTestId('location')).toHaveTextContent(/^$/)
  })

  it('provides a retry action for failed project requests', async () => {
    renderProjects(
      '/projects',
      new SimulatedNetwork({
        failure: (operation) =>
          operation === 'project.summary-list' ? 'Scripted project failure.' : null,
      }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Projects are unavailable',
    )
    expect(screen.getByRole('button', { name: 'Retry projects' })).toBeEnabled()
  })
})
