import { describe, expect, it } from 'vitest'
import type { Cylinder } from './api'
import { buildAnalytics, utilisation } from './analytics'

const NOW = Date.parse('2026-10-22T08:00:00Z')
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString()
let id = 0
const cyl = (p: Partial<Cylinder>): Cylinder => ({
  id: ++id, serialNumber: `CYL-${String(id).padStart(6, '0')}`, gasType: 'Oxygen', status: 'Empty', customerName: null, lastUpdated: daysAgo(1), ...p,
})

describe('buildAnalytics', () => {
  const rows = [
    cyl({ status: 'Filled', gasType: 'Argon' }),
    cyl({ status: 'Delivered', customerName: ' PT Östara ', lastUpdated: daysAgo(45) }),
    cyl({ status: 'Delivered', customerName: 'PT Östara', lastUpdated: daysAgo(3) }),
    cyl({ status: 'Delivered', customerName: "Toko D'Amico", lastUpdated: daysAgo(30) }),
    cyl({ status: 'InMaintenance', lastUpdated: daysAgo(70) }),
    cyl({ status: 'Retired', lastUpdated: daysAgo(400) }),
  ]
  const a = buildAnalytics(rows, NOW)

  it('counts the fleet by status and gas, and keeps every gas type even when it has none', () => {
    expect(a.total).toBe(6)
    expect(a.inService).toBe(5)
    expect(a.byStatus).toEqual({ Empty: 0, Filled: 1, Delivered: 3, InMaintenance: 1, Retired: 1 })
    expect(a.byGas).toHaveLength(6)
    expect(a.byGas.find((g) => g.gasType === 'Argon')).toMatchObject({ total: 1, byStatus: { Filled: 1 } })
    expect(a.byGas.find((g) => g.gasType === 'Hydrogen')?.total).toBe(0)
  })

  it('ages only cylinders in service, and counts 30+ day deliveries as idle', () => {
    expect(a.aging.map((b) => b.count)).toEqual([2, 1, 1, 1, 0]) // 1d, 3d | 30d | 45d | 70d | retired skipped
    expect(a.idle).toBe(2)
  })

  it('groups customers by trimmed name and ranks by cylinders held', () => {
    expect(a.customerCount).toBe(2)
    expect(a.topCustomers[0]).toEqual({ customerName: 'PT Östara', cylinders: 2, idle: 1, oldestDays: 45 })
    expect(a.topCustomers[1]).toEqual({ customerName: "Toko D'Amico", cylinders: 1, idle: 1, oldestDays: 30 })
  })

  it('utilisation is filled + delivered over cylinders in service', () => {
    expect(utilisation(a.byStatus)).toBeCloseTo(4 / 5)
  })
})
