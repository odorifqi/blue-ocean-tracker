import type { Analytics, Cylinder } from './api'
import { GAS_TYPES, IDLE_DAYS, STATUSES, daysSince, type CylinderStatus } from './domain'

// Same buckets as the .NET API (CylinderEndpoints.AgeBuckets).
export const AGE_BUCKETS = [
  { label: '0–7 days', minDays: 0, maxDays: 7 },
  { label: '8–30 days', minDays: 8, maxDays: 30 },
  { label: '31–60 days', minDays: 31, maxDays: 60 },
  { label: '61–90 days', minDays: 61, maxDays: 90 },
  { label: 'Over 90 days', minDays: 91, maxDays: null },
] as const

export const TOP_CUSTOMERS = 8

const countByStatus = (rows: { status: CylinderStatus }[]) => {
  const out = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<CylinderStatus, number>
  rows.forEach((r) => out[r.status]++)
  return out
}

/** Builds the analytics payload from raw rows. Used by the mock API; the .NET API computes the same shape. */
export function buildAnalytics(rows: Cylinder[], now = Date.now()): Analytics {
  const days = (c: Cylinder) => Math.max(0, daysSince(c.lastUpdated, now))
  const inService = rows.filter((r) => r.status !== 'Retired')
  const delivered = rows.filter((r) => r.status === 'Delivered' && r.customerName?.trim())

  const customers = new Map<string, Analytics['topCustomers'][number]>()
  for (const c of delivered) {
    const name = c.customerName!.trim()
    const entry = customers.get(name) ?? { customerName: name, cylinders: 0, idle: 0, oldestDays: 0 }
    entry.cylinders++
    if (days(c) >= IDLE_DAYS) entry.idle++
    entry.oldestDays = Math.max(entry.oldestDays, days(c))
    customers.set(name, entry)
  }
  const ranked = [...customers.values()].sort(
    (a, b) => b.cylinders - a.cylinders || b.oldestDays - a.oldestDays || a.customerName.localeCompare(b.customerName, undefined, { sensitivity: 'base' }),
  )

  return {
    generatedAt: new Date(now).toISOString(),
    idleDays: IDLE_DAYS,
    total: rows.length,
    inService: inService.length,
    idle: rows.filter((r) => r.status === 'Delivered' && days(r) >= IDLE_DAYS).length,
    byStatus: countByStatus(rows),
    byGas: GAS_TYPES.map((g) => {
      const ofGas = rows.filter((r) => r.gasType === g)
      return { gasType: g, total: ofGas.length, byStatus: countByStatus(ofGas) }
    }),
    aging: AGE_BUCKETS.map((b) => ({
      ...b,
      count: inService.filter((r) => days(r) >= b.minDays && (b.maxDays === null || days(r) <= b.maxDays)).length,
    })),
    customerCount: customers.size,
    topCustomers: ranked.slice(0, TOP_CUSTOMERS),
  }
}

/** Share of in-service cylinders that are earning: filled and ready, or at a customer. */
export const utilisation = (byStatus: Record<CylinderStatus, number>) => {
  const inService = byStatus.Empty + byStatus.Filled + byStatus.Delivered + byStatus.InMaintenance
  return inService ? (byStatus.Filled + byStatus.Delivered) / inService : 0
}

export const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0)
