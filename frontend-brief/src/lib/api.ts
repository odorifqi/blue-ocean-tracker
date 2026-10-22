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

// Set by main.tsx in mock mode. Browsers stop an idle service worker and start it again on the
// next request; MSW's worker then forgets this tab and lets requests through to the host, which
// answers with index.html. Re-registering the tab makes the mock answer again.
let reconnectMock: (() => Promise<void>) | undefined
let reconnecting: Promise<void> | undefined

export function setMockReconnect(fn: () => Promise<void>) {
  reconnectMock = fn
}

async function request<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
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
  const json = text ? parseJson(text) : undefined
  if (!res.ok) throw new ApiError(res.status, (json as object | undefined) ?? (text ? { detail: text } : {}))
  // A 2xx that isn't JSON is a host's fallback page (Vercel answers unknown paths with
  // index.html), not data. Treat it as a failed request instead of handing HTML to a page.
  if (text && json === undefined) {
    if (reconnectMock && !isRetry) {
      // The request never reached the mock, so sending it again is safe, even for a POST.
      reconnecting ??= reconnectMock().finally(() => (reconnecting = undefined))
      await reconnecting.catch(() => {})
      return request<T>(path, init, true)
    }
    throw unexpectedResponse(res.status)
  }
  return json as T
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** A successful status with a body that isn't what the contract promises. */
function unexpectedResponse(status: number) {
  return new ApiError(status, {
    title: 'Unexpected response',
    detail: 'The server answered, but not with the data this page needs.',
  })
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
  get: (id: number) => request<Cylinder>(`/api/cylinders/${id}`),
  create: (input: CylinderInput) => request<Cylinder>('/api/cylinders', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: number, input: CylinderInput) =>
    request<Cylinder>(`/api/cylinders/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  changeStatus: (id: number, input: StatusChangeInput) =>
    request<Cylinder>(`/api/cylinders/${id}/status`, { method: 'POST', body: JSON.stringify(input) }),
}
