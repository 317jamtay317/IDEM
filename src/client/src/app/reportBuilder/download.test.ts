import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { downloadText } from './download'

describe('downloadText', () => {
  const realCreate = URL.createObjectURL
  const realRevoke = URL.revokeObjectURL
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>
  let clickSpy: MockInstance

  beforeEach(() => {
    // jsdom does not implement object URLs, so install mocks for them.
    createObjectURL = vi.fn(() => 'blob:mock-url')
    revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    URL.createObjectURL = realCreate
    URL.revokeObjectURL = realRevoke
    clickSpy.mockRestore()
  })

  it('builds a blob URL, clicks a download anchor, and revokes the URL', () => {
    downloadText('report.rdl', '<Report/>', 'application/xml')

    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/xml')
    expect(clickSpy).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })

  it('names the downloaded file and points the anchor at the blob URL', () => {
    // Capture the anchor while it is in the DOM (it is removed after the click).
    let anchor: HTMLAnchorElement | null = null
    clickSpy.mockImplementation(() => {
      anchor = document.querySelector<HTMLAnchorElement>('a[download]')
    })

    downloadText('annual-emissions.rdl', '<Report/>')

    expect(anchor).not.toBeNull()
    expect(anchor!.download).toBe('annual-emissions.rdl')
    expect(anchor!.href).toContain('blob:mock-url')
  })

  it('defaults the mime type to text/plain', () => {
    downloadText('notes.txt', 'hello')

    expect((createObjectURL.mock.calls[0][0] as Blob).type).toBe('text/plain')
  })

  it('carries the given text in the blob', async () => {
    downloadText('notes.txt', 'hello world')

    expect(await (createObjectURL.mock.calls[0][0] as Blob).text()).toBe('hello world')
  })
})
