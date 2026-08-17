import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { render, screen } from '../../test/render'
import { PrimaryNavigation } from './PrimaryNavigation'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import { createAtlasFixtures } from '../../data'
import type { UserId } from '../../domain'

function renderNavigation(initialEntry = '/', actorId?: UserId) {
  const services = createAppServices(actorId ? { actorId } : {})
  return render(
    <AppProviders queryClient={createAtlasQueryClient()} services={services}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PrimaryNavigation />
      </MemoryRouter>
    </AppProviders>,
  )
}

describe('PrimaryNavigation', () => {
  it('identifies the current route', () => {
    renderNavigation('/projects')

    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('moves focus with directional, Home, and End keys', async () => {
    const user = userEvent.setup()

    renderNavigation()

    const dashboard = screen.getByRole('link', { name: 'Dashboard' })
    const projects = screen.getByRole('link', { name: 'Projects' })
    const settings = screen.getByRole('link', { name: 'Settings' })

    dashboard.focus()
    await user.keyboard('{ArrowDown}')
    expect(projects).toHaveFocus()

    await user.keyboard('{End}')
    expect(settings).toHaveFocus()

    await user.keyboard('{Home}')
    expect(dashboard).toHaveFocus()

    await user.keyboard('{ArrowUp}')
    expect(settings).toHaveFocus()
  })

  it('leaves focus unchanged for unrelated keys', async () => {
    const user = userEvent.setup()

    renderNavigation()

    const dashboard = screen.getByRole('link', { name: 'Dashboard' })
    dashboard.focus()

    await user.keyboard('x')

    expect(dashboard).toHaveFocus()
  })

  it('only reveals governance navigation to authorized roles', () => {
    const fixtures = createAtlasFixtures()
    const viewerId = fixtures.memberships.find(({ role }) => role === 'viewer')?.userId
    if (!viewerId) throw new Error('Expected a fixture viewer.')

    const { unmount } = renderNavigation('/', viewerId)
    expect(screen.queryByRole('link', { name: 'Governance' })).not.toBeInTheDocument()
    unmount()

    renderNavigation()
    expect(screen.getByRole('link', { name: 'Governance' })).toBeVisible()
  })
})
