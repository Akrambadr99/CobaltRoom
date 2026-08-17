import { describe, expect, it } from 'vitest'

import { ProjectsPage } from './ProjectsPage'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import { SimulatedNetwork, type RequestSimulator } from '../../data'
import { render, screen, within } from '../../test/render'

function renderProjects(simulator: RequestSimulator = new SimulatedNetwork()) {
  const services = createAppServices({ simulator })

  return render(
    <AppProviders
      queryClient={createAtlasQueryClient()}
      services={services}
    >
      <ProjectsPage />
    </AppProviders>,
  )
}

describe('ProjectsPage', () => {
  it('loads sorted projects with status and complete issue counts', async () => {
    renderProjects()

    expect(screen.getByRole('status')).toHaveTextContent('Loading projects')
    const projects = await screen.findByRole('list', {
      name: 'Workspace projects',
    })
    const projectCards = within(projects).getAllByRole('listitem')

    expect(projectCards).toHaveLength(2)
    expect(projectCards[0]).toHaveTextContent('Field reliability')
    expect(projectCards[0]).toHaveTextContent('Status: Active')
    expect(projectCards[0]).toHaveTextContent('3 issues')
    expect(projectCards[1]).toHaveTextContent('Launch readiness')
    expect(projectCards[1]).toHaveTextContent('3 issues')
  })

  it('provides a retry action for failed project requests', async () => {
    renderProjects(
      new SimulatedNetwork({ failure: () => 'Scripted project failure.' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Projects are unavailable',
    )
    expect(screen.getByRole('button', { name: 'Retry projects' })).toBeEnabled()
  })
})
