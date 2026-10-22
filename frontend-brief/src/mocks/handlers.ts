import { delay, http, HttpResponse } from 'msw'
import type { Cylinder } from '../lib/api'
import {
  CUSTOMER_NAME_MAX,
  STATUSES,
  TRANSITIONS,
  canTransition,
  isStatus,
  matchGasType,
  normalizeSerial,
  validateCylinderInput,
} from '../lib/domain'
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

export const handlers = [
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
    db.insert(created)
    return HttpResponse.json(created, { status: 201, headers: { Location: `/api/cylinders/${created.id}` } })
  }),

  http.put('*/api/cylinders/:id', async ({ params, request }) => {
    const fail = await simulateNetwork()
    if (fail) return fail
    const current = db.find(Number(params.id))
    if (!current) return notFound(Number(params.id))
    const input = readInput(await request.json().catch(() => ({})))
    const errors = inputErrors(input)
    if (Object.keys(errors).length) return validation(errors)
    const serial = normalizeSerial(input.serialNumber)
    const clash = db.findBySerial(serial)
    if (clash && clash.id !== current.id) return duplicate(serial)

    const gasType = matchGasType(input.gasType)!
    if (current.serialNumber === serial && current.gasType === gasType) return HttpResponse.json(current)
    const updated = { ...current, serialNumber: serial, gasType, lastUpdated: new Date().toISOString() }
    db.update(updated)
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
    db.update(updated)
    return HttpResponse.json(updated)
  }),
]
