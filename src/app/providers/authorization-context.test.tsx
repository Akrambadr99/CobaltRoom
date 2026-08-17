import { useMutation } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AppProviders } from './AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import { AppShell } from '../layout/AppShell'
import { GovernancePage } from '../pages/GovernancePage'
import { PrimaryNavigation } from '../navigation/PrimaryNavigation'
import { createAtlasFixtures, InMemoryDataStore, SimulatedNetwork } from '../../data'
import { render, screen } from '../../test/render'
import { useAppServices } from './app-services-context'

function RejectedGovernanceRequest() {
  const services = useAppServices()
  const request = useMutation({
    mutationFn: () =>
      services.gateway.getGovernanceReport({ workspaceId: services.workspaceId }),
  })
  return (
    <button
      type="button"
      onClick={() => {
        request.mutate()
      }}
    >
      Refresh protected report
    </button>
  )
}

function createMutableSession(simulator = new SimulatedNetwork()) {
  const fixtures = createAtlasFixtures()
  const admin = fixtures.memberships.find(({ role }) => role === 'admin')
  if (!admin) throw new Error('Expected a fixture administrator.')
  const store = new InMemoryDataStore(fixtures)
  const services = createAppServices({
    actorId: admin.userId,
    dataStore: store,
    simulator,
  })
  return { admin, services, store }
}

describe('AuthorizationProvider', () => {
  it('removes protected cached data after a stale privileged request is rejected', async () => {
    const user = userEvent.setup()
    const { admin, services, store } = createMutableSession()
    render(
      <AppProviders queryClient={createAtlasQueryClient()} services={services}>
        <MemoryRouter initialEntries={['/governance']}>
          <PrimaryNavigation />
          <RejectedGovernanceRequest />
          <GovernancePage />
        </MemoryRouter>
      </AppProviders>,
    )
    expect(await screen.findByRole('table')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Governance' })).toBeVisible()

    const current = store.read()
    store.commit(current.version, {
      ...current.data,
      memberships: current.data.memberships.map((membership) =>
        membership.id === admin.id
          ? { ...membership, role: 'viewer' as const }
          : membership,
      ),
    })
    await user.click(screen.getByRole('button', { name: 'Refresh protected report' }))

    expect(
      await screen.findByText('Governance access is restricted'),
    ).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Governance' })).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('blocks the application shell when membership becomes inactive', async () => {
    const { admin, services, store } = createMutableSession()
    const queryClient = createAtlasQueryClient()
    render(
      <AppProviders queryClient={queryClient} services={services}>
        <MemoryRouter>
          <AppShell />
        </MemoryRouter>
      </AppProviders>,
    )
    expect(screen.getByLabelText(/Signed in as/)).toBeVisible()

    const current = store.read()
    store.commit(current.version, {
      ...current.data,
      memberships: current.data.memberships.map((membership) =>
        membership.id === admin.id
          ? { ...membership, status: 'suspended' as const }
          : membership,
      ),
    })
    await queryClient.invalidateQueries({
      queryKey: ['authorization', services.workspaceId],
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Workspace access changed',
    )
    expect(screen.queryByLabelText(/Signed in as/)).not.toBeInTheDocument()
  })

  it('fails closed while authorization is unverifiable and recovers on retry', async () => {
    const user = userEvent.setup()
    let rejectNextAuthorization = true
    const simulator = new SimulatedNetwork({
      failure: (operation) => {
        if (operation !== 'authorization.get' || !rejectNextAuthorization) return null
        rejectNextAuthorization = false
        return 'Authorization service unavailable.'
      },
    })
    const { services } = createMutableSession(simulator)
    const queryClient = createAtlasQueryClient()
    queryClient.setQueryData(['protected', 'workspace-records'], {
      confidential: true,
    })

    render(
      <AppProviders queryClient={queryClient} services={services}>
        <MemoryRouter>
          <AppShell />
        </MemoryRouter>
      </AppProviders>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Permissions could not be verified',
    )
    expect(screen.queryByLabelText(/Signed in as/)).not.toBeInTheDocument()
    expect(queryClient.getQueryData(['protected', 'workspace-records'])).toBeUndefined()

    await user.click(screen.getByRole('button', { name: 'Verify access' }))
    expect(await screen.findByLabelText(/Signed in as/)).toBeVisible()
  })
})
