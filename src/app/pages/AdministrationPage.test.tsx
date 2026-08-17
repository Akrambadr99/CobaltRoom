import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AdministrationPage } from './AdministrationPage'
import { AppProviders } from '../providers/AppProviders'
import { createAtlasQueryClient } from '../query-client'
import { createAppServices } from '../services'
import {
  createAtlasFixtures,
  InMemoryDataStore,
  SimulatedNetwork,
} from '../../data'
import { render, screen, waitFor, within } from '../../test/render'

function renderAdministration(
  store = new InMemoryDataStore(createAtlasFixtures()),
  actorId?: ReturnType<typeof createAtlasFixtures>['users'][number]['id'],
  initialEntry = '/administration',
) {
  const services = createAppServices({
    dataStore: store,
    simulator: new SimulatedNetwork(),
    ...(actorId ? { actorId } : {}),
  })
  render(
    <AppProviders queryClient={createAtlasQueryClient()} services={services}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AdministrationPage />
      </MemoryRouter>
    </AppProviders>,
  )
  return { services, store }
}

describe('AdministrationPage', () => {
  it('updates roles and confirms destructive suspension with accessible focus', async () => {
    const user = userEvent.setup()
    renderAdministration()
    const table = await screen.findByRole('table', {
      name: 'Workspace membership administration',
    })

    await user.click(within(table).getByRole('button', { name: 'Edit Lena Ortiz' }))
    let dialog = await screen.findByRole('dialog', { name: 'Edit Lena Ortiz' })
    const roleSelect = within(dialog).getByLabelText('Workspace role')
    expect(within(roleSelect).queryByRole('option', { name: 'Owner' })).not.toBeInTheDocument()
    await user.selectOptions(roleSelect, 'admin')
    await user.click(within(dialog).getByRole('button', { name: 'Save access' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('status')).toHaveTextContent(
      'Lena Ortiz is now admin and active.',
    )
    const lenaRow = within(table).getByRole('row', { name: /Lena Ortiz/ })
    await waitFor(() => {
      expect(lenaRow).toHaveTextContent('Admin')
      expect(lenaRow).toHaveTextContent('2')
    })

    await user.click(within(table).getByRole('button', { name: 'Edit Theo Martin' }))
    dialog = await screen.findByRole('dialog', { name: 'Edit Theo Martin' })
    await user.selectOptions(within(dialog).getByLabelText('Access status'), 'suspended')
    await user.click(within(dialog).getByRole('button', { name: 'Review suspension' }))
    const confirmation = await screen.findByRole('dialog', {
      name: 'Suspend Theo Martin?',
    })
    const suspend = within(confirmation).getByRole('button', {
      name: 'Suspend member',
    })
    expect(suspend).toHaveFocus()
    await user.click(suspend)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(within(table).getByRole('row', { name: /Theo Martin/ })).toHaveTextContent(
        'Suspended',
      )
    })
  })

  it('fails closed when an open administration dialog loses authorization', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const store = new InMemoryDataStore(fixtures)
    renderAdministration(store)
    await user.click(
      await screen.findByRole('button', { name: 'Edit Lena Ortiz' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Edit Lena Ortiz' })
    const admin = fixtures.memberships.find(({ role }) => role === 'admin')
    if (!admin) throw new Error('Expected an administrator fixture.')
    const current = store.read()
    store.commit(current.version, {
      ...current.data,
      memberships: current.data.memberships.map((membership) =>
        membership.id === admin.id
          ? { ...membership, role: 'viewer' as const, revision: 2 }
          : membership,
      ),
    })

    await user.selectOptions(within(dialog).getByLabelText('Workspace role'), 'admin')
    await user.click(within(dialog).getByRole('button', { name: 'Save access' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'permission',
    )
    expect(dialog).toBeVisible()
  })

  it('protects the administration surface from viewers', async () => {
    const fixtures = createAtlasFixtures()
    const viewer = fixtures.memberships.find(({ role }) => role === 'viewer')
    if (!viewer) throw new Error('Expected a viewer fixture.')
    renderAdministration(new InMemoryDataStore(fixtures), viewer.userId)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'current role cannot manage workspace members',
    )
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('recovers an out-of-range member directory deep link', async () => {
    renderAdministration(undefined, undefined, '/administration?page=99')

    expect(
      await screen.findByRole('row', { name: /Lena Ortiz/ }),
    ).toBeVisible()
    expect(screen.getByText('Page 1 of 1')).toBeVisible()
  })
})
