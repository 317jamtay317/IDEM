import { describe, it, expect, vi, afterEach } from 'vitest'
import { productionFieldLimitsApi } from './productionFieldLimitsApi'

/** Stub the global `fetch` with a single canned response. */
function mockFetch(response: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  const fn = vi.fn(() =>
    Promise.resolve({
      ok: response.ok,
      status: response.status ?? 200,
      json: response.json ?? (() => Promise.resolve(undefined)),
    }),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('productionFieldLimitsApi', () => {
  it('list GETs the Org limits with the bearer token', async () => {
    const data = [{ propertyName: 'HotMix', lowLimit: 0, highLimit: 200, unit: 'Tons' }]
    const fetchMock = mockFetch({ ok: true, json: () => Promise.resolve(data) })

    const result = await productionFieldLimitsApi.list('tok')

    expect(result).toEqual(data)
    expect(fetchMock).toHaveBeenCalledWith('/me/org/production-field-limits', {
      headers: { Authorization: 'Bearer tok' },
    })
  })

  it('list throws when the response is not ok', async () => {
    mockFetch({ ok: false, status: 403 })
    await expect(productionFieldLimitsApi.list('tok')).rejects.toThrow('403')
  })

  it('set PUTs the bounds to the property-scoped route as JSON', async () => {
    const saved = { propertyName: 'HotMix', lowLimit: 1, highLimit: 5, unit: 'Percentage' }
    const fetchMock = mockFetch({ ok: true, json: () => Promise.resolve(saved) })

    const result = await productionFieldLimitsApi.set('tok', 'HotMix', {
      lowLimit: 1,
      highLimit: 5,
      unit: 'Percentage',
    })

    expect(result).toEqual(saved)
    expect(fetchMock).toHaveBeenCalledWith('/me/org/production-field-limits/HotMix', {
      method: 'PUT',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ lowLimit: 1, highLimit: 5, unit: 'Percentage' }),
    })
  })

  it('set throws when the response is not ok', async () => {
    mockFetch({ ok: false, status: 400 })
    await expect(
      productionFieldLimitsApi.set('tok', 'HotMix', { lowLimit: 1, highLimit: 5, unit: 'Tons' }),
    ).rejects.toThrow('400')
  })
})
