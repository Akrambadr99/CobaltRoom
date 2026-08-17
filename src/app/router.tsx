import { createBrowserRouter, type RouteObject } from 'react-router-dom'

import { RouteErrorBoundary } from './errors/RouteErrorBoundary'
import { AppShell } from './layout/AppShell'
import { RouteLoadingState } from './layout/RouteLoadingState'

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    HydrateFallback: RouteLoadingState,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { DashboardPage } = await import('./pages/DashboardPage')
          return { Component: DashboardPage }
        },
      },
      {
        path: 'activity',
        lazy: async () => {
          const { ActivityPage } = await import('./pages/ActivityPage')
          return { Component: ActivityPage }
        },
      },
      {
        path: 'projects',
        lazy: async () => {
          const { ProjectsPage } = await import('./pages/ProjectsPage')
          return { Component: ProjectsPage }
        },
      },
      {
        path: 'projects/:projectId',
        lazy: async () => {
          const { ProjectDetailPage } = await import('./pages/ProjectDetailPage')
          return { Component: ProjectDetailPage }
        },
      },
      {
        path: 'issues',
        lazy: async () => {
          const { IssuesPage } = await import('./pages/IssuesPage')
          return { Component: IssuesPage }
        },
      },
      {
        path: 'issues/:issueId',
        lazy: async () => {
          const { IssueDetailPage } = await import('./pages/IssueDetailPage')
          return { Component: IssueDetailPage }
        },
      },
      {
        path: 'board',
        lazy: async () => {
          const { BoardPage } = await import('./pages/BoardPage')
          return { Component: BoardPage }
        },
      },
      {
        path: 'administration',
        lazy: async () => {
          const { AdministrationPage } = await import('./pages/AdministrationPage')
          return { Component: AdministrationPage }
        },
      },
      {
        path: 'analytics',
        lazy: async () => {
          const { AnalyticsPage } = await import('./pages/AnalyticsPage')
          return { Component: AnalyticsPage }
        },
      },
      {
        path: 'settings',
        lazy: async () => {
          const { SettingsPage } = await import('./pages/SettingsPage')
          return { Component: SettingsPage }
        },
      },
      {
        path: 'governance',
        lazy: async () => {
          const { GovernancePage } = await import('./pages/GovernancePage')
          return { Component: GovernancePage }
        },
      },
      {
        path: '*',
        lazy: async () => {
          const { NotFoundPage } = await import('./pages/NotFoundPage')
          return { Component: NotFoundPage }
        },
      },
    ],
  },
]

export const browserRouter = createBrowserRouter(appRoutes)
