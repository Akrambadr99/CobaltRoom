import { createBrowserRouter, type RouteObject } from 'react-router-dom'

import { RouteErrorBoundary } from './errors/RouteErrorBoundary'
import { AppShell } from './layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { BoardPage } from './pages/BoardPage'
import { IssuesPage } from './pages/IssuesPage'
import { IssueDetailPage } from './pages/IssueDetailPage'
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
        element: <IssuesPage />,
      },
      {
        path: 'issues/:issueId',
        element: <IssueDetailPage />,
      },
      {
        path: 'board',
        element: <BoardPage />,
      },
      {
        path: 'analytics',
        element: <AnalyticsPage />,
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
