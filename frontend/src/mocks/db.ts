import seed from './cylinders.json'
import type { Cylinder, HistoryEvent } from '../lib/api'
import { matchGasType, normalizeSerial, type CylinderStatus } from '../lib/domain'

// In-browser stand-in for the SQLite database. Seeded from the brief's JSON
// (ids 1..n in file order, since the file has none) and persisted to
// localStorage so edits survive a reload.

const KEY = 'smtr.mock.db.v1'
const HISTORY_KEY = 'smtr.mock.history.v1'

/** Who the server says made a change. There is no sign-in yet, so this is a fixed demo account. */
export const DEMO_OPERATOR = 'Rina Wulandari'
export const IMPORT_ACTOR = 'System import'

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

// The data file has no history, so each cylinder gets one honest "imported" entry
// at the file's own timestamp. Nothing earlier is invented.
const importEvents = (cylinders: Cylinder[]): HistoryEvent[] =>
  cylinders.map((c, i) => ({
    id: i + 1,
    cylinderId: c.id,
    type: 'imported',
    at: c.lastUpdated,
    fromStatus: null,
    toStatus: c.status,
    customerName: c.customerName,
    changes: [],
    actionBy: IMPORT_ACTOR,
  }))

function read<T>(key: string): T | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {
    /* storage unavailable: fall back to seed */
  }
  return undefined
}

let rows = read<Cylinder[]>(KEY) ?? fromSeed()
// Browsers that saved cylinders before history existed get import entries for what they have.
let events = read<HistoryEvent[]>(HISTORY_KEY) ?? importEvents(rows)

export type NewEvent = Omit<HistoryEvent, 'id' | 'at' | 'actionBy'>

export const db = {
  all: () => rows,
  find: (id: number) => rows.find((r) => r.id === id),
  findBySerial: (serial: string) => rows.find((r) => r.serialNumber === serial),
  nextId: () => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1,
  history: (cylinderId: number) => events.filter((e) => e.cylinderId === cylinderId),
  /** Writes the change and its history entry together, the way one SaveChanges call does on the server. */
  insert(c: Cylinder, event: NewEvent) {
    rows = [...rows, c]
    record(event, c.lastUpdated)
    save()
  },
  update(c: Cylinder, event: NewEvent) {
    rows = rows.map((r) => (r.id === c.id ? c : r))
    record(event, c.lastUpdated)
    save()
  },
  reset() {
    rows = fromSeed()
    events = importEvents(rows)
    save()
  },
}

// History is append-only: entries are frozen and there is no update or delete.
function record(e: NewEvent, at: string) {
  const id = events.reduce((m, x) => Math.max(m, x.id), 0) + 1
  events = [...events, Object.freeze({ ...e, id, at, actionBy: DEMO_OPERATOR })]
}

function save() {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(rows))
    globalThis.localStorage?.setItem(HISTORY_KEY, JSON.stringify(events))
  } catch {
    /* ignore */
  }
}
