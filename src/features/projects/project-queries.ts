import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type {
  CreateProjectInput,
  MutableProjectFields,
  ProjectEditMetadata,
} from '../../data'
import type { Project, ProjectId } from '../../domain'
import { atlasQueryKeys } from '../../app/query/keys'
import type { ProjectWorkspaceState } from './project-workspace-state'

export function useProjectSummaries(state: ProjectWorkspaceState) {
  const { gateway, workspaceId } = useAppServices()
  const query = {
    workspaceId,
    ...(state.search ? { search: state.search } : {}),
    ...(state.status ? { statuses: [state.status] } : {}),
    page: { number: state.page, size: 12 },
  }

  return useQuery({
    queryKey: atlasQueryKeys.projectSummaries(query),
    queryFn: ({ signal }) => gateway.listProjectSummaries(query, { signal }),
  })
}

export function useProjectCreationMetadata(enabled: boolean) {
  const { gateway, workspaceId } = useAppServices()
  return useQuery({
    queryKey: [...atlasQueryKeys.projects(workspaceId), 'creation-metadata'],
    queryFn: ({ signal }) =>
      gateway.getProjectCreationMetadata(workspaceId, { signal }),
    enabled,
  })
}

export function useCreateProject() {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProjectInput) => gateway.createProject(input),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.projects(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.analytics(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.boardMetadata(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.issueCreationMetadata(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.governanceReports(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.authorization(workspaceId),
        }),
      ])
    },
  })
}

export function useProjectDetail(projectId: ProjectId, page: number) {
  const { gateway, workspaceId } = useAppServices()
  const metadata = useQuery({
    queryKey: atlasQueryKeys.project(workspaceId, projectId),
    queryFn: ({ signal }) => gateway.getProjectEditMetadata(projectId, { signal }),
  })
  const issues = useQuery({
    queryKey: atlasQueryKeys.issues(workspaceId, {
      filters: { workspaceId, projectIds: [projectId] },
      sort: { field: 'updatedAt', direction: 'descending' },
      page: { number: page, size: 20 },
    }),
    queryFn: ({ signal }) =>
      gateway.listIssues(
        {
          filters: { workspaceId, projectIds: [projectId] },
          sort: { field: 'updatedAt', direction: 'descending' },
          page: { number: page, size: 20 },
        },
        { signal },
      ),
  })
  return { issues, metadata }
}

export function useProjectActivity(projectId: ProjectId, page: number) {
  const { gateway, workspaceId } = useAppServices()
  return useQuery({
    queryKey: [...atlasQueryKeys.projectActivity(workspaceId, projectId), page],
    queryFn: ({ signal }) =>
      gateway.getProjectActivity(
        projectId,
        { number: page, size: 20 },
        { signal },
      ),
  })
}

interface UpdateProjectVariables {
  readonly project: Project
  readonly changes: Partial<MutableProjectFields>
}

export function useUpdateProject(projectId: ProjectId) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const key = atlasQueryKeys.project(workspaceId, projectId)
  return useMutation<
    Project,
    Error,
    UpdateProjectVariables,
    { readonly previous: ProjectEditMetadata | undefined }
  >({
    scope: { id: `project:${projectId}` },
    mutationFn: ({ project, changes }) =>
      gateway.updateProject({
        id: project.id,
        expectedRevision: project.revision,
        changes,
      }),
    onMutate: async ({ project, changes }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ProjectEditMetadata>(key)
      queryClient.setQueryData<ProjectEditMetadata>(key, (current) =>
        current
          ? {
              ...current,
              project: {
                ...project,
                ...changes,
                revision: project.revision + 1,
              },
            }
          : current,
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: (project) => {
      queryClient.setQueryData<ProjectEditMetadata>(key, (current) =>
        current ? { ...current, project } : current,
      )
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: atlasQueryKeys.projects(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: atlasQueryKeys.analytics(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: atlasQueryKeys.governanceReports(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: atlasQueryKeys.projectActivity(workspaceId, projectId) }),
        queryClient.invalidateQueries({ queryKey: atlasQueryKeys.authorization(workspaceId) }),
      ])
    },
  })
}

export function useArchiveProject(projectId: ProjectId) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const key = atlasQueryKeys.project(workspaceId, projectId)
  return useMutation({
    scope: { id: `project:${projectId}` },
    mutationFn: (project: Project) =>
      gateway.archiveProject({ id: project.id, expectedRevision: project.revision }),
    onSuccess: (project) => {
      queryClient.setQueryData<ProjectEditMetadata>(key, (current) =>
        current ? { ...current, project } : current,
      )
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: key }),
        queryClient.invalidateQueries({ queryKey: atlasQueryKeys.projects(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: atlasQueryKeys.workspaceIssues(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: atlasQueryKeys.analytics(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: atlasQueryKeys.governanceReports(workspaceId) }),
        queryClient.invalidateQueries({ queryKey: atlasQueryKeys.projectActivity(workspaceId, projectId) }),
      ])
    },
  })
}
