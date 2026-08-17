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
import { isoDateTime, workspaceInvitationId } from '../../domain'
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
    let confirmation = await screen.findByRole('dialog', {
      name: 'Suspend Theo Martin?',
    })
    let suspend = within(confirmation).getByRole('button', {
      name: 'Suspend member',
    })
    expect(suspend).toHaveFocus()
    await user.click(
      within(confirmation).getByRole('button', { name: 'Keep editing' }),
    )
    dialog = await screen.findByRole('dialog', { name: 'Edit Theo Martin' })
    const reviewSuspension = within(dialog).getByRole('button', {
      name: 'Review suspension',
    })
    expect(reviewSuspension).toHaveFocus()
    await user.click(reviewSuspension)
    confirmation = await screen.findByRole('dialog', {
      name: 'Suspend Theo Martin?',
    })
    suspend = within(confirmation).getByRole('button', {
      name: 'Suspend member',
    })
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

  it('creates and activates an invitation into the authoritative member directory', async () => {
    const user = userEvent.setup()
    renderAdministration()
    const memberTable = await screen.findByRole('table', {
      name: 'Workspace membership administration',
    })
    expect(
      await screen.findByText('No invitations match these filters.'),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Invite member' }))
    let dialog = await screen.findByRole('dialog', {
      name: 'Invite workspace member',
    })
    const email = within(dialog).getByLabelText('Email address')
    expect(email).toHaveFocus()
    await user.type(email, 'new.member@example.test')
    await user.selectOptions(
      within(dialog).getByLabelText('Invitation role'),
      'viewer',
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Create invitation' }),
    )

    const invitationTable = await screen.findByRole('table', {
      name: 'Workspace invitation administration',
    })
    let invitationRow = within(invitationTable).getByRole('row', {
      name: /new.member@example.test/,
    })
    expect(invitationRow).toHaveTextContent('Viewer')
    expect(invitationRow).toHaveTextContent('Pending')
    await user.click(within(invitationRow).getByRole('button', { name: 'Activate' }))
    dialog = await screen.findByRole('dialog', {
      name: 'Activate new.member@example.test',
    })
    await user.type(within(dialog).getByLabelText('Member name'), 'Nora Singh')
    await user.click(
      within(dialog).getByRole('button', { name: 'Activate member' }),
    )

    await waitFor(() => {
      expect(
        within(memberTable).getByRole('row', { name: /Nora Singh/ }),
      ).toHaveTextContent('Viewer')
    })
    invitationRow = within(invitationTable).getByRole('row', {
      name: /new.member@example.test/,
    })
    await waitFor(() => {
      expect(invitationRow).toHaveTextContent('Accepted')
      expect(invitationRow).toHaveTextContent('Complete')
    })
  })

  it('preserves invitation drafts on conflicts and confirms revocation', async () => {
    const user = userEvent.setup()
    renderAdministration()
    await screen.findByRole('heading', { name: 'Workspace invitations' })

    const createInvitation = async (): Promise<void> => {
      await user.click(screen.getByRole('button', { name: 'Invite member' }))
      const dialog = await screen.findByRole('dialog', {
        name: 'Invite workspace member',
      })
      await user.type(
        within(dialog).getByLabelText('Email address'),
        'conflict.member@example.test',
      )
      await user.click(
        within(dialog).getByRole('button', { name: 'Create invitation' }),
      )
    }
    await createInvitation()
    await screen.findByRole('row', { name: /conflict.member@example.test/ })
    await createInvitation()
    const conflictDialog = await screen.findByRole('dialog', {
      name: 'Invite workspace member',
    })
    expect(await within(conflictDialog).findByRole('alert')).toHaveTextContent(
      'pending invitation already exists',
    )
    expect(within(conflictDialog).getByLabelText('Email address')).toHaveValue(
      'conflict.member@example.test',
    )
    await user.click(within(conflictDialog).getByRole('button', { name: 'Cancel' }))

    const invitationRow = await screen.findByRole('row', {
      name: /conflict.member@example.test/,
    })
    await user.click(within(invitationRow).getByRole('button', { name: 'Revoke' }))
    const confirmation = await screen.findByRole('dialog', {
      name: 'Revoke invitation?',
    })
    const revoke = within(confirmation).getByRole('button', {
      name: 'Revoke invitation',
    })
    expect(revoke).toHaveFocus()
    await user.click(revoke)
    await waitFor(() => {
      expect(invitationRow).toHaveTextContent('Revoked')
      expect(invitationRow).toHaveTextContent('Complete')
    })
  })

  it('renews expired invitations and updates URL-backed lifecycle filters', async () => {
    const user = userEvent.setup()
    const fixtures = createAtlasFixtures()
    const workspace = fixtures.workspaces[0]
    const administrator = fixtures.memberships.find(({ role }) => role === 'admin')
    if (!workspace || !administrator) {
      throw new Error('Expected invitation lifecycle fixtures.')
    }
    const store = new InMemoryDataStore({
      ...fixtures,
      workspaceInvitations: [
        {
          id: workspaceInvitationId('invite_expired_member_001'),
          workspaceId: workspace.id,
          email: 'expired.member@example.test',
          role: 'member',
          state: 'pending',
          invitedById: administrator.userId,
          createdAt: isoDateTime('2025-01-01T08:00:00.000Z'),
          lastSentAt: isoDateTime('2025-01-02T08:00:00.000Z'),
          expiresAt: isoDateTime('2025-01-09T08:00:00.000Z'),
          acceptedAt: null,
          revokedAt: null,
          revision: 1,
        },
      ],
    })
    renderAdministration(
      store,
      undefined,
      '/administration?inviteState=expired&invitePage=99',
    )

    const invitationTable = await screen.findByRole('table', {
      name: 'Workspace invitation administration',
    })
    const row = within(invitationTable).getByRole('row', {
      name: /expired.member@example.test/,
    })
    expect(row).toHaveTextContent('Expired')
    await user.click(within(row).getByRole('button', { name: 'Renew' }))
    expect(
      await screen.findByText('No invitations match these filters.'),
    ).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Invitation renewed for expired.member@example.test.',
    )

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Invitation status' }),
      'pending',
    )
    const renewedRow = await screen.findByRole('row', {
      name: /expired.member@example.test/,
    })
    expect(renewedRow).toHaveTextContent('Pending')
    const filters = screen.getByRole('search', {
      name: 'Filter workspace invitations',
    })
    await user.selectOptions(
      within(filters).getByRole('combobox', { name: 'Invitation role' }),
      'member',
    )
    await user.type(
      within(filters).getByRole('searchbox', { name: 'Search invitations' }),
      'expired.member',
    )
    await user.click(within(filters).getByRole('button', { name: 'Search' }))
    expect(
      await screen.findByRole('row', { name: /expired.member@example.test/ }),
    ).toBeVisible()
    expect(store.read().data.workspaceInvitations[0]).toMatchObject({
      revision: 2,
      state: 'pending',
    })
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
    expect(
      screen.queryByRole('heading', { name: 'Workspace invitations' }),
    ).not.toBeInTheDocument()
  })

  it('recovers an out-of-range member directory deep link', async () => {
    renderAdministration(undefined, undefined, '/administration?page=99')

    expect(
      await screen.findByRole('row', { name: /Lena Ortiz/ }),
    ).toBeVisible()
    expect(
      within(screen.getByRole('navigation', { name: 'Member directory pages' }))
        .getByText('Page 1 of 1'),
    ).toBeVisible()
  })
})
