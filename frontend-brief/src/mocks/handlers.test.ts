import { describe, expect, it } from 'vitest'
import { db } from './db'

// Contract checks for the mock API, against the route table in the brief.
const get = (path: string) => fetch(`http://localhost${path}`)
const send = (method: string, path: string, body: unknown) =>
  fetch(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

describe('mock API contract', () => {
  it('pages, sorts by lastUpdated desc and searches case-insensitively, accents included', async () => {
    const res = await get('/api/cylinders?page=1&pageSize=5')
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ page: 1, pageSize: 5, totalCount: 87 })
    const dates = body.items.map((c: { lastUpdated: string }) => c.lastUpdated)
    expect([...dates].sort().reverse()).toEqual(dates)

    const search = await (await get('/api/cylinders?search=%C3%B6STARA')).json()
    expect(search.totalCount).toBe(2)
  })

  it('rejects bad paging with 400 and returns an empty page past the end', async () => {
    expect((await get('/api/cylinders?page=0')).status).toBe(400)
    expect((await get('/api/cylinders?pageSize=51')).status).toBe(400)
    const past = await (await get('/api/cylinders?page=99')).json()
    expect(past.items).toEqual([])
  })

  it('creates as Empty, rejects duplicates (409) and enforces transitions', async () => {
    const created = await send('POST', '/api/cylinders', { serialNumber: 'cyl-999999', gasType: 'argon' })
    expect(created.status).toBe(201)
    const c = await created.json()
    expect(c).toMatchObject({ serialNumber: 'CYL-999999', gasType: 'Argon', status: 'Empty', customerName: null })

    expect((await send('POST', '/api/cylinders', { serialNumber: 'CYL-999999', gasType: 'Argon' })).status).toBe(409)
    expect((await send('POST', `/api/cylinders/${c.id}/status`, { status: 'Delivered' })).status).toBe(400)
    await send('POST', `/api/cylinders/${c.id}/status`, { status: 'Filled' })
    expect((await send('POST', `/api/cylinders/${c.id}/status`, { status: 'Delivered' })).status).toBe(400)
    const delivered = await send('POST', `/api/cylinders/${c.id}/status`, { status: 'Delivered', customerName: "PT Café O'Brien" })
    expect(delivered.status).toBe(200)
    expect((await delivered.json()).customerName).toBe("PT Café O'Brien")
    expect((await get('/api/cylinders/123456')).status).toBe(404)
  })

  it('edits serial and gas only: 404 when missing, 409 on a duplicate, status untouched', async () => {
    const c = await (await send('POST', '/api/cylinders', { serialNumber: 'CYL-888888', gasType: 'Oxygen' })).json()
    expect((await send('PUT', '/api/cylinders/123456', { serialNumber: 'CYL-888889', gasType: 'Argon' })).status).toBe(404)
    expect((await send('PUT', `/api/cylinders/${c.id}`, { serialNumber: db.all()[0].serialNumber.toLowerCase(), gasType: 'Argon' })).status).toBe(409)

    const res = await send('PUT', `/api/cylinders/${c.id}`, { serialNumber: 'cyl-888889', gasType: 'argon', status: 'Retired' })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ serialNumber: 'CYL-888889', gasType: 'Argon', status: 'Empty' })
  })
})
