import type { CylinderStatus, GasType } from './domain'

export interface Cylinder {
  id: number
  serialNumber: string
  gasType: GasType
  status: CylinderStatus
  customerName: string | null
  lastUpdated: string
}

export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}

export interface Summary {
  total: number
  byStatus: Record<CylinderStatus, number>
  idle: number
}

export interface Analytics {
  generatedAt: string
  idleDays: number
  total: number
  /** Everything except Retired. */
  inService: number
  /** Delivered and not moved for `idleDays` or more. */
  idle: number
  byStatus: Record<CylinderStatus, number>
  byGas: { gasType: GasType; total: number; byStatus: Record<CylinderStatus, number> }[]
  /** In-service cylinders by days since their last status change. `maxDays` is inclusive; null means open-ended. */
  aging: { label: string; minDays: number; maxDays: number | null; count: number }[]
  /** Customers currently holding at least one cylinder. */
  customerCount: number
  topCustomers: { customerName: string; cylinders: number; idle: number; oldestDays: number }[]
}

export type HistoryEventType = 'added' | 'imported' | 'status' | 'edited'
export type HistoryFilter = 'all' | 'status' | 'edit'

export interface HistoryChange {
  field: 'serialNumber' | 'gasType'
  from: string
  to: string
}

/** One append-only entry in a cylinder's history. The server sets `at` and `actionBy`; clients never send them. */
export interface HistoryEvent {
  id: number
  cylinderId: number
  type: HistoryEventType
  at: string
  fromStatus: CylinderStatus | null
  toStatus: CylinderStatus | null
  /** Set on moves to Delivered, and on imported rows that were delivered. */
  customerName: string | null
  changes: HistoryChange[]
  actionBy: string
}

export interface HistorySummary {
  trackedSince: string
  deliveries: number
  customers: number
  lastEdited: string | null
}

export interface HistoryPage extends Paged<HistoryEvent> {
  summary: HistorySummary
}

export interface HistoryParams {
  type?: HistoryFilter
  page?: number
  pageSize?: number
}

export interface StatusRule {
  status: CylinderStatus
  isStart: boolean
  requiresCustomer: boolean
  isFinal: boolean
}

export interface Meta {
  gasTypes: string[]
  statuses: CylinderStatus[]
  transitions: Record<CylinderStatus, CylinderStatus[]>
  statusRules: StatusRule[]
  customerNameMaxLength: number
}

export interface ListParams {
  search?: string
  status?: CylinderStatus | ''
  page?: number
  pageSize?: number
}

export interface CylinderInput {
  serialNumber: string
  gasType: string
}

export interface StatusChangeInput {
  status: CylinderStatus
  customerName?: string | null
}

/** RFC 7807 problem details, as returned by ASP.NET Core and by the mock API. */
export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly detail?: string
  readonly errors: Record<string, string[]>

  constructor(status: number, body: { title?: string; detail?: string; errors?: Record<string, string[]> } = {}) {
    super(body.detail ?? body.title ?? `Request failed (${status})`)
    this.status = status
    this.title = body.title ?? defaultTitle(status)
    this.detail = body.detail
    // ASP.NET uses PascalCase keys in some cases; normalise to camelCase field names.
    this.errors = Object.fromEntries(
      Object.entries(body.errors ?? {}).map(([k, v]) => [k.charAt(0).toLowerCase() + k.slice(1), v]),
    )
  }

  get isNetwork() {
    return this.status === 0
  }

  fieldError(field: string) {
    return this.errors[field]?.[0]
  }
}

function defaultTitle(status: number) {
  if (status === 0) return 'Can’t reach the server'
  if (status === 404) return 'Not found'
  if (status === 409) return 'Conflict'
  if (status >= 500) return 'Server error'
  return 'Request failed'
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, { detail: 'Check your connection and try again.' })
  }
  const text = await res.text()
  const body = text ? safeJson(text) : undefined
  if (!res.ok) throw new ApiError(res.status, (body as object) ?? {})
  return body as T
}

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return { detail: text }
  }
}

export const api = {
  list(params: ListParams) {
    const q = new URLSearchParams()
    if (params.search) q.set('search', params.search)
    if (params.status) q.set('status', params.status)
    q.set('page', String(params.page ?? 1))
    q.set('pageSize', String(params.pageSize ?? 10))
    return request<Paged<Cylinder>>(`/api/cylinders?${q}`)
  },
  summary: () => request<Summary>('/api/cylinders/summary'),
  analytics: () => request<Analytics>('/api/cylinders/analytics'),
  meta: () => request<Meta>('/api/meta'),
  history(id: number, params: HistoryParams = {}) {
    const q = new URLSearchParams()
    if (params.type && params.type !== 'all') q.set('type', params.type)
    q.set('page', String(params.page ?? 1))
    q.set('pageSize', String(params.pageSize ?? 10))
    return request<HistoryPage>(`/api/cylinders/${id}/history?${q}`)
  },
  get: (id: number) => request<Cylinder>(`/api/cylinders/${id}`),
  create: (input: CylinderInput) => request<Cylinder>('/api/cylinders', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: number, input: CylinderInput) =>
    request<Cylinder>(`/api/cylinders/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  changeStatus: (id: number, input: StatusChangeInput) =>
    request<Cylinder>(`/api/cylinders/${id}/status`, { method: 'POST', body: JSON.stringify(input) }),
}
