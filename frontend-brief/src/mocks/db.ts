import seed from './cylinders.json'
import type { Cylinder } from '../lib/api'
import { matchGasType, normalizeSerial, type CylinderStatus } from '../lib/domain'

// In-browser stand-in for the SQLite database. Seeded from the brief's JSON
// (ids 1..n in file order, since the file has none) and persisted to
// localStorage so edits survive a reload.

const KEY = 'smtr.brief.db.v1'

interface SeedRow {
  id?: number
  serialNumber: string
  gasType: string
  status: string
  customerName: string | null
  lastUpdated: string
}

function fromSeed(): Cylinder[] {
  const seen = new Set<string>()
  const rows: Cylinder[] = []
  ;(seed as SeedRow[]).forEach((r, i) => {
    const serial = normalizeSerial(r.serialNumber)
    if (seen.has(serial)) return
    seen.add(serial)
    const status = r.status as CylinderStatus
    rows.push({
      id: r.id ?? i + 1,
      serialNumber: serial,
      gasType: matchGasType(r.gasType) ?? (r.gasType as Cylinder['gasType']),
      status,
      customerName: status === 'Delivered' ? (r.customerName?.trim() ?? null) : null,
      lastUpdated: new Date(r.lastUpdated).toISOString(),
    })
  })
  return rows
}

function read(): Cylinder[] | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (raw) return JSON.parse(raw) as Cylinder[]
  } catch {
    /* storage unavailable: fall back to seed */
  }
  return undefined
}

let rows = read() ?? fromSeed()

export const db = {
  all: () => rows,
  find: (id: number) => rows.find((r) => r.id === id),
  findBySerial: (serial: string) => rows.find((r) => r.serialNumber === serial),
  nextId: () => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1,
  insert(c: Cylinder) {
    rows = [...rows, c]
    save()
  },
  update(c: Cylinder) {
    rows = rows.map((r) => (r.id === c.id ? c : r))
    save()
  },
  reset() {
    rows = fromSeed()
    save()
  },
}

function save() {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(rows))
  } catch {
    /* ignore */
  }
}
