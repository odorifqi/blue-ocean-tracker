import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Cylinder, type CylinderInput, type HistoryParams, type ListParams, type StatusChangeInput } from './api'

export const keys = {
  all: ['cylinders'] as const,
  list: (p: ListParams) => ['cylinders', 'list', p] as const,
  summary: ['cylinders', 'summary'] as const,
  analytics: ['cylinders', 'analytics'] as const,
  detail: (id: number) => ['cylinders', 'detail', id] as const,
  // Under 'cylinders', so every write that invalidates the list also refreshes the history.
  history: (id: number, p: HistoryParams) => ['cylinders', 'history', id, p] as const,
  meta: ['meta'] as const,
}

export function useCylinders(params: ListParams) {
  return useQuery({
    queryKey: keys.list(params),
    queryFn: () => api.list(params),
    // Keep showing the current page while the next one loads, so the table doesn't flash.
    placeholderData: keepPreviousData,
  })
}

export const useSummary = () => useQuery({ queryKey: keys.summary, queryFn: api.summary })

export const useAnalytics = () =>
  useQuery({ queryKey: keys.analytics, queryFn: api.analytics, placeholderData: keepPreviousData })

export const useCylinder = (id: number) =>
  useQuery({ queryKey: keys.detail(id), queryFn: () => api.get(id), enabled: Number.isFinite(id) })

export const useHistory = (id: number, params: HistoryParams) =>
  useQuery({
    queryKey: keys.history(id, params),
    queryFn: () => api.history(id, params),
    enabled: Number.isFinite(id),
    placeholderData: keepPreviousData,
  })

// The rules only change with a deploy, so fetch them once per session.
export const useMeta = () => useQuery({ queryKey: keys.meta, queryFn: api.meta, staleTime: Infinity })

function useInvalidateAfter() {
  const qc = useQueryClient()
  return (c: Cylinder) => {
    qc.setQueryData(keys.detail(c.id), c)
    return qc.invalidateQueries({ queryKey: keys.all })
  }
}

export function useCreateCylinder() {
  const done = useInvalidateAfter()
  return useMutation({ mutationFn: (input: CylinderInput) => api.create(input), onSuccess: done })
}

export function useUpdateCylinder(id: number) {
  const done = useInvalidateAfter()
  return useMutation({ mutationFn: (input: CylinderInput) => api.update(id, input), onSuccess: done })
}

export function useChangeStatus(id: number) {
  const done = useInvalidateAfter()
  return useMutation({ mutationFn: (input: StatusChangeInput) => api.changeStatus(id, input), onSuccess: done })
}
