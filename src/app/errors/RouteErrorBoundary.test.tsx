import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { render, screen } from '../../test/render'
import { RouteErrorBoundary } from './RouteErrorBoundary'

describe('RouteErrorBoundary', () => {
  it('offers a safe recovery route when a route fails', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        loader: () => {
          throw new Error('Fixture route failed')
        },
        element: <p>Unreachable route</p>,
        errorElement: <RouteErrorBoundary />,
        hydrateFallbackElement: <p>Loading route</p>,
      },
    ])

    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong',
    )
    expect(screen.getByRole('link', { name: 'Return to dashboard' })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('reports status details for route responses without exposing a body', async () => {
    const router = createMemoryRouter([
      {
        path: '/',
        loader: () => {
          throw new Response('Private response body', {
            status: 403,
            statusText: 'Forbidden',
          })
        },
        element: <p>Unreachable route</p>,
        errorElement: <RouteErrorBoundary />,
        hydrateFallbackElement: <p>Loading route</p>,
      },
    ])

    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole('heading', { level: 1, name: '403 Forbidden' }),
    ).toBeVisible()
    expect(screen.queryByText('Private response body')).not.toBeInTheDocument()
  })
})
