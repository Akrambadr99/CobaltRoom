import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { render, screen } from '../test/render'
import { AppProviders } from './providers/AppProviders'
import { createAtlasQueryClient } from './query-client'
import { createAppServices } from './services'
import { appRoutes } from './router'

function renderRouter(router: ReturnType<typeof createMemoryRouter>) {
  return render(
    <AppProviders
      queryClient={createAtlasQueryClient()}
      services={createAppServices()}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  )
}

describe('application router', () => {
  it('renders a requested workspace route and supports link navigation', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/projects'],
    })

    renderRouter(router)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Projects' }),
    ).toBeVisible()
    await user.click(screen.getByRole('link', { name: 'Issues' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Issues' }),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe('/issues')
  })

  it('renders an explicit not-found view for unknown routes', async () => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/does-not-exist'],
    })

    renderRouter(router)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Return to dashboard' })).toHaveAttribute(
      'href',
      '/',
    )
  })
})
