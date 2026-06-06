import { describe, it, expect, vi, afterEach } from 'vitest'
import { reportTemplatesApi } from './reportTemplatesApi'

/** Stub the global `fetch` with a single canned response (JSON and/or Blob). */
function mockFetch(response: {
  ok: boolean
  status?: number
  json?: () => Promise<unknown>
  blob?: () => Promise<Blob>
}) {
  const fn = vi.fn(() =>
    Promise.resolve({
      ok: response.ok,
      status: response.status ?? 200,
      json: response.json ?? (() => Promise.resolve(undefined)),
      blob: response.blob ?? (() => Promise.resolve(new Blob())),
    }),
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

const sample = {
  id: 't1',
  name: 'Annual Emissions',
  rdl: '<Report/>',
  createdAtUtc: '2026-06-05T12:00:00Z',
  updatedAtUtc: '2026-06-05T12:00:00Z',
}

describe('reportTemplatesApi', () => {
  it('list GETs the saved templates with the bearer token', async () => {
    const fetchMock = mockFetch({ ok: true, json: () => Promise.resolve([sample]) })

    const result = await reportTemplatesApi.list('tok')

    expect(result).toEqual([sample])
    expect(fetchMock).toHaveBeenCalledWith('/api/report-templates', {
      headers: { Authorization: 'Bearer tok' },
    })
  })

  it('list throws when the response is not ok', async () => {
    mockFetch({ ok: false, status: 403 })
    await expect(reportTemplatesApi.list('tok')).rejects.toThrow('403')
  })

  it('get GETs a single template by id', async () => {
    const fetchMock = mockFetch({ ok: true, json: () => Promise.resolve(sample) })

    const result = await reportTemplatesApi.get('tok', 't1')

    expect(result).toEqual(sample)
    expect(fetchMock).toHaveBeenCalledWith('/api/report-templates/t1', {
      headers: { Authorization: 'Bearer tok' },
    })
  })

  it('create POSTs the name and rdl as JSON', async () => {
    const fetchMock = mockFetch({ ok: true, json: () => Promise.resolve(sample) })

    const result = await reportTemplatesApi.create('tok', { name: 'Annual Emissions', rdl: '<Report/>' })

    expect(result).toEqual(sample)
    expect(fetchMock).toHaveBeenCalledWith('/api/report-templates', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Annual Emissions', rdl: '<Report/>' }),
    })
  })

  it('update PUTs the name and rdl to the id route as JSON', async () => {
    const fetchMock = mockFetch({ ok: true, json: () => Promise.resolve(sample) })

    const result = await reportTemplatesApi.update('tok', 't1', { name: 'Renamed', rdl: '<Report/>' })

    expect(result).toEqual(sample)
    expect(fetchMock).toHaveBeenCalledWith('/api/report-templates/t1', {
      method: 'PUT',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed', rdl: '<Report/>' }),
    })
  })

  it('create throws when the response is not ok', async () => {
    mockFetch({ ok: false, status: 400 })
    await expect(
      reportTemplatesApi.create('tok', { name: '', rdl: '<Report/>' }),
    ).rejects.toThrow('400')
  })

  it('remove DELETEs the template by id with the bearer token', async () => {
    const fetchMock = mockFetch({ ok: true })

    await reportTemplatesApi.remove('tok', 't1')

    expect(fetchMock).toHaveBeenCalledWith('/api/report-templates/t1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer tok' },
    })
  })

  it('remove throws when the response is not ok', async () => {
    mockFetch({ ok: false, status: 404 })
    await expect(reportTemplatesApi.remove('tok', 't1')).rejects.toThrow('404')
  })

  it('renderPdf POSTs the rdl to the preview route and returns the PDF blob', async () => {
    const pdf = new Blob(['%PDF-'], { type: 'application/pdf' })
    const fetchMock = mockFetch({ ok: true, blob: () => Promise.resolve(pdf) })

    const result = await reportTemplatesApi.renderPdf('tok', '<Report/>')

    expect(result).toBe(pdf)
    expect(fetchMock).toHaveBeenCalledWith('/api/report-templates/preview', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ rdl: '<Report/>' }),
    })
  })

  it('renderPdf throws when the response is not ok', async () => {
    mockFetch({ ok: false, status: 400 })
    await expect(reportTemplatesApi.renderPdf('tok', '<bad>')).rejects.toThrow('400')
  })
})
