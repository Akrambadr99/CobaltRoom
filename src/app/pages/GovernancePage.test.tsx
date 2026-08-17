import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { GovernancePage } from './GovernancePage'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import { createAtlasFixtures, FixedClock } from '../../data'
import { isoDateTime, type UserId } from '../../domain'
import { render, screen } from '../../test/render'

function renderGovernance(actorId?: UserId) {
  const services = createAppServices({
    ...(actorId ? { actorId } : {}),
    clock: new FixedClock(isoDateTime('2026-02-10T12:00:00.000Z')),
  })
  render(
    <AppProviders queryClient={createAtlasQueryClient()} services={services}>
      <MemoryRouter initialEntries={['/governance']}>
        <GovernancePage />
      </MemoryRouter>
    </AppProviders>,
  )
}

describe('GovernancePage', () => {
  it('renders and filters authoritative audit outcomes', async () => {
    const user = userEvent.setup()
    renderGovernance()
    expect(screen.getByRole('status')).toHaveTextContent('Loading governance report')
    expect(await screen.findByRole('heading', { name: 'Audit log' })).toBeVisible()
    expect(
      screen.getByRole('table', { name: 'Authoritative workspace audit events' }),
    ).toHaveTextContent('fixture-bootstrap-001')

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Outcome' }),
      'rejected',
    )
    expect(await screen.findByText('1 matching events')).toBeVisible()
    expect(screen.getByRole('table')).toHaveTextContent('fixture-access-check-001')
    expect(screen.getByRole('table')).not.toHaveTextContent('fixture-bootstrap-001')
  })

  it('fails closed when the active role lacks audit access', async () => {
    const fixtures = createAtlasFixtures()
    const viewerId = fixtures.memberships.find(({ role }) => role === 'viewer')?.userId
    if (!viewerId) throw new Error('Expected a fixture viewer.')

    renderGovernance(viewerId)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Governance access is restricted',
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
