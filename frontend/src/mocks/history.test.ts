import { describe, expect, it } from 'vitest'
import type { HistoryPage } from '../lib/api'
import { DEMO_OPERATOR, IMPORT_ACTOR } from './db'

const get = (path: string) => fetch(`http://localhost${path}`)
const send = (method: string, path: string, body: unknown) =>
  fetch(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const history = async (id: number, query = '') => (await (await get(`/api/cylinders/${id}/history${query}`)).json()) as HistoryPage

describe('cylinder history', () => {
  it('records every write with a server-set actor, and ignores an actor sent by the client', async () => {
    const c = await (await send('POST', '/api/cylinders', { serialNumber: 'CYL-777777', gasType: 'Argon', actionBy: 'Someone else' })).json()
    await send('PUT', `/api/cylinders/${c.id}`, { serialNumber: 'CYL-777778', gasType: 'Argon' })
    await send('PUT', `/api/cylinders/${c.id}`, { serialNumber: 'CYL-777778', gasType: 'Argon' }) // no change, no entry
    await send('POST', `/api/cylinders/${c.id}/status`, { status: 'Filled', actionBy: 'Someone else' })
    await send('POST', `/api/cylinders/${c.id}/status`, { status: 'Delivered', customerName: "PT Café O'Brien" })

    const h = await history(c.id)
    expect(h.items.map((e) => e.type)).toEqual(['status', 'status', 'edited', 'added'])
    expect(h.items.every((e) => e.actionBy === DEMO_OPERATOR)).toBe(true)
    expect(h.items[0]).toMatchObject({ fromStatus: 'Filled', toStatus: 'Delivered', customerName: "PT Café O'Brien" })
    expect(h.items[2].changes).toEqual([{ field: 'serialNumber', from: 'CYL-777777', to: 'CYL-777778' }])
    expect(h.summary).toMatchObject({ deliveries: 1, customers: 1 })

    // A return names the customer it came back from; it isn't another delivery or customer.
    await send('POST', `/api/cylinders/${c.id}/status`, { status: 'Empty' })
    const back = await history(c.id)
    expect(back.items[0]).toMatchObject({ fromStatus: 'Delivered', toStatus: 'Empty', customerName: "PT Café O'Brien" })
    expect(back.summary).toMatchObject({ deliveries: 1, customers: 1 })

    const edits = await history(c.id, '?type=edit')
    expect(edits.totalCount).toBe(1)
    expect((await get(`/api/cylinders/${c.id}/history?type=nope`)).status).toBe(400)
    expect((await get('/api/cylinders/9999/history')).status).toBe(404)
  })

  it('gives each imported cylinder exactly one honest entry and invents nothing earlier', async () => {
    const h = await history(1)
    expect(h.totalCount).toBe(1)
    expect(h.items[0]).toMatchObject({ type: 'imported', actionBy: IMPORT_ACTOR, toStatus: 'Delivered' })
    expect(h.summary.deliveries).toBe(0)
  })
})
