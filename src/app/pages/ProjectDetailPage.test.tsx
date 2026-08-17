import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { ProjectDetailPage } from './ProjectDetailPage'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import { createAtlasFixtures, SimulatedNetwork } from '../../data'
import { render, screen } from '../../test/render'

function renderProjectDetail(path: string) {
  return render(
    <AppProviders
      queryClient={createAtlasQueryClient()}
      services={createAppServices({ simulator: new SimulatedNetwork() })}
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
