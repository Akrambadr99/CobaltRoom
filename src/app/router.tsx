import { createBrowserRouter, type RouteObject } from 'react-router-dom'

import { RouteErrorBoundary } from './errors/RouteErrorBoundary'
import { AppShell } from './layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectsPage } from './pages/ProjectsPage'

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: 'projects',
        element: <ProjectsPage />,
      },
      {
        path: 'projects/:projectId',
        element: <ProjectDetailPage />,
      },
      {
        path: 'issues',
        element: (
          <PlaceholderPage
            title="Issues"
            description="Review assigned, active, and upcoming work in one place."
          />
        ),
      },
      {
        path: 'board',
        element: (
          <PlaceholderPage
            title="Board"
            description="Follow work through each stage of the delivery workflow."
          />
        ),
      },
      {
        path: 'analytics',
        element: (
          <PlaceholderPage
            title="Analytics"
            description="Understand delivery health through transparent workspace metrics."
          />
        ),
      },
      {
        path: 'settings',
        element: (
          <PlaceholderPage
            title="Settings"
            description="Manage workspace preferences and operating conventions."
          />
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const browserRouter = createBrowserRouter(appRoutes)
