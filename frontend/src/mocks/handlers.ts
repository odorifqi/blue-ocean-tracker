import { delay, http, HttpResponse } from 'msw'
import type { Cylinder, HistoryChange, HistoryEvent, HistoryPage, Summary } from '../lib/api'
import {
  CUSTOMER_NAME_MAX,
  GAS_TYPES,
  STATUSES,
  STATUS_RULES,
  TRANSITIONS,
  canEdit,
  canTransition,
  isIdle,
  isStatus,
  matchGasType,
  normalizeSerial,
  validateCylinderInput,
} from '../lib/domain'
import { buildAnalytics } from '../lib/analytics'
import { db } from './db'
import { mockSettings } from './settings'

// Mirrors the API contract in the brief (and the .NET draft in /backend):
// same routes, status codes and RFC 7807 error bodies.

const MAX_PAGE_SIZE = 50

const problem = (status: number, title: string, detail?: string, errors?: Record<string, string[]>) =>
  HttpResponse.json({ status, title, detail, errors }, { status, headers: { 'Content-Type': 'application/problem+json' } })

const validation = (errors: Record<string, string[]>, title = 'One or more validation errors occurred.') =>
  problem(400, title, undefined, errors)

const notFound = (id: number) => problem(404, 'Cylinder not found', `No cylinder with id ${id}.`)

async function simulateNetwork() {
  const { latency, failure } = mockSettings.get()
  await delay(latency)
  if (failure === 'offline') return HttpResponse.error()
  if (failure === 'always' || failure === 'next') {
    if (failure === 'next') mockSettings.set({ failure: 'none' })
    return problem(500, 'Server error', 'Simulated failure from the demo panel.')
  }
  return undefined
}

const byRecent = (a: Cylinder, b: Cylinder) =>
  b.lastUpdated.localeCompare(a.lastUpdated) || a.id - b.id

function readInput(body: unknown) {
  const b = (body ?? {}) as Record<string, unknown>
  return {
    serialNumber: typeof b.serialNumber === 'string' ? b.serialNumber : '',
    gasType: typeof b.gasType === 'string' ? b.gasType : '',
  }
}

function inputErrors(input: { serialNumber: string; gasType: string }) {
  return Object.fromEntries(
    Object.entries(validateCylinderInput(input)).map(([k, v]) => [k, [v as string]]),
  )
}

const duplicate = (serial: string) =>
  problem(409, 'Duplicate serial number', `A cylinder with serial number ${serial} already exists.`, {
    serialNumber: [`${serial} is already registered.`],
  })

const retired = (serial: string) =>
  problem(409, 'Cylinder is retired', `${serial} is retired, so its details can no longer be edited.`)

const HISTORY_FILTERS = {
  all: () => true,
  status: (e: HistoryEvent) => e.type === 'status',
  edit: (e: HistoryEvent) => e.type === 'edited',
}

/** Counts across the whole history, whatever filter or page is shown. `events` is newest first. */
function summarise(events: HistoryEvent[]): HistoryPage['summary'] {
  const customers = new Set(events.flatMap((e) => (e.customerName ? [e.customerName.trim().toUpperCase()] : [])))
  return {
    trackedSince: events.at(-1)?.at ?? null,
    deliveries: events.filter((e) => e.type === 'status' && e.toStatus === 'Delivered').length,
    customers: customers.size,
    lastEdited: events.find((e) => e.type === 'edited')?.at ?? null,
  }
}

export const handlers = [
  http.get('*/api/cylinders/summary', async () => {
    const fail = await simulateNetwork()
    if (fail) return fail
    const rows = db.all()
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Summary['byStatus']
    rows.forEach((r) => byStatus[r.status]++)
    return HttpResponse.json<Summary>({ total: rows.length, byStatus, idle: rows.filter((r) => isIdle(r)).length })
  }),

  http.get('*/api/cylinders/analytics', async () => {
    const fail = await simulateNetwork()
    if (fail) return fail
    return HttpResponse.json(buildAnalytics(db.all()))
  }),

  http.get('*/api/cylinders', async ({ request }) => {
    const fail = await simulateNetwork()
    if (fail) return fail
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 10)
    const search = url.searchParams.get('search')?.trim() ?? ''
    const status = url.searchParams.get('status')?.trim() ?? ''

    const errors: Record<string, string[]> = {}
    if (!Number.isInteger(page) || page < 1) errors.page = ['Page must be 1 or greater.']
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE)
      errors.pageSize = [`Page size must be between 1 and ${MAX_PAGE_SIZE}.`]
    const statusMatch = STATUSES.find((s) => s.toLowerCase() === status.toLowerCase())
    if (status && !statusMatch) errors.status = [`Unknown status '${status}'.`]
    if (Object.keys(errors).length) return validation(errors)

    const term = search.toUpperCase()
    const filtered = db
      .all()
      .filter((c) => !statusMatch || c.status === statusMatch)
      .filter((c) => !term || `${c.serialNumber} ${c.customerName ?? ''}`.toUpperCase().includes(term))
      .sort(byRecent)

    return HttpResponse.json({
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      totalCount: filtered.length,
    })
  }),

  http.get('*/api/cylinders/:id/history', async ({ params, request }) => {
    const fail = await simulateNetwork()
    if (fail) return fail
    const id = Number(params.id)
    if (!db.find(id)) return notFound(id)
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 10)
    const type = url.searchParams.get('type')?.trim().toLowerCase() || 'all'

    const errors: Record<string, string[]> = {}
    if (!Number.isInteger(page) || page < 1) errors.page = ['Page must be 1 or greater.']
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE)
      errors.pageSize = [`Page size must be between 1 and ${MAX_PAGE_SIZE}.`]
    if (!(type in HISTORY_FILTERS)) errors.type = ['Type must be one of: all, status, edit.']
    if (Object.keys(errors).length) return validation(errors)

    const all = db.history(id).toSorted((a, b) => b.at.localeCompare(a.at) || b.id - a.id)
    const filtered = all.filter(HISTORY_FILTERS[type as keyof typeof HISTORY_FILTERS])
    return HttpResponse.json<HistoryPage>({
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      page,
      pageSize,
      totalCount: filtered.length,
      summary: summarise(all),
    })
  }),

  http.get('*/api/meta', async () => {
    const fail = await simulateNetwork()
    if (fail) return fail
    return HttpResponse.json({
      gasTypes: GAS_TYPES,
      statuses: STATUSES,
      transitions: TRANSITIONS,
      statusRules: STATUS_RULES,
      customerNameMaxLength: CUSTOMER_NAME_MAX,
    })
  }),

  http.get('*/api/cylinders/:id', async ({ params }) => {
    const fail = await simulateNetwork()
    if (fail) return fail
    const c = db.find(Number(params.id))
    return c ? HttpResponse.json(c) : notFound(Number(params.id))
  }),

  http.post('*/api/cylinders', async ({ request }) => {
    const fail = await simulateNetwork()
    if (fail) return fail
    const input = readInput(await request.json().catch(() => ({})))
    const errors = inputErrors(input)
    if (Object.keys(errors).length) return validation(errors)
    const serial = normalizeSerial(input.serialNumber)
    if (db.findBySerial(serial)) return duplicate(serial)

    const created: Cylinder = {
      id: db.nextId(),
      serialNumber: serial,
      gasType: matchGasType(input.gasType)!,
      status: 'Empty',
      customerName: null,
      lastUpdated: new Date().toISOString(),
    }
    db.insert(created, { cylinderId: created.id, type: 'added', fromStatus: null, toStatus: 'Empty', customerName: null, changes: [] })
    return HttpResponse.json(created, { status: 201, headers: { Location: `/api/cylinders/${created.id}` } })
  }),

  http.put('*/api/cylinders/:id', async ({ params, request }) => {
    const fail = await simulateNetwork()
    if (fail) return fail
    const current = db.find(Number(params.id))
    if (!current) return notFound(Number(params.id))
    if (!canEdit(current.status)) return retired(current.serialNumber)
    const input = readInput(await request.json().catch(() => ({})))
    const errors = inputErrors(input)
    if (Object.keys(errors).length) return validation(errors)
    const serial = normalizeSerial(input.serialNumber)
    const clash = db.findBySerial(serial)
    if (clash && clash.id !== current.id) return duplicate(serial)

    const gasType = matchGasType(input.gasType)!
    if (current.serialNumber === serial && current.gasType === gasType) return HttpResponse.json(current)
    const changes: HistoryChange[] = []
    if (current.serialNumber !== serial) changes.push({ field: 'serialNumber', from: current.serialNumber, to: serial })
    if (current.gasType !== gasType) changes.push({ field: 'gasType', from: current.gasType, to: gasType })
    const updated = { ...current, serialNumber: serial, gasType, lastUpdated: new Date().toISOString() }
    db.update(updated, { cylinderId: current.id, type: 'edited', fromStatus: null, toStatus: null, customerName: null, changes })
    return HttpResponse.json(updated)
  }),

  http.post('*/api/cylinders/:id/status', async ({ params, request }) => {
    const fail = await simulateNetwork()
    if (fail) return fail
    const current = db.find(Number(params.id))
    if (!current) return notFound(Number(params.id))
    const body = ((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>
    const next = STATUSES.find((s) => s.toLowerCase() === String(body.status ?? '').trim().toLowerCase())
    if (!isStatus(next))
      return validation({ status: [`Status must be one of: ${STATUSES.join(', ')}.`] })

    if (!canTransition(current.status, next)) {
      const allowed = TRANSITIONS[current.status]
      const hint = allowed.length ? `Allowed: ${allowed.join(', ')}.` : 'Retired cylinders cannot change status.'
      return validation(
        { status: [`Cannot move from ${current.status} to ${next}. ${hint}`] },
        'Invalid status transition',
      )
    }

    let customerName: string | null = null
    if (next === 'Delivered') {
      customerName = typeof body.customerName === 'string' ? body.customerName.trim() : ''
      if (!customerName)
        return validation({ customerName: ['Customer name is required when delivering a cylinder.'] })
      if (customerName.length > CUSTOMER_NAME_MAX)
        return validation({ customerName: [`Customer name must be at most ${CUSTOMER_NAME_MAX} characters.`] })
    }

    const updated: Cylinder = { ...current, status: next, customerName, lastUpdated: new Date().toISOString() }
    // The entry names the customer on both ends of a delivery: who received it, and who it came back from.
    const eventCustomer = customerName ?? (current.status === 'Delivered' ? current.customerName : null)
    db.update(updated, { cylinderId: current.id, type: 'status', fromStatus: current.status, toStatus: next, customerName: eventCustomer, changes: [] })
    return HttpResponse.json(updated)
  }),
]
