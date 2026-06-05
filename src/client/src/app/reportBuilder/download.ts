/**
 * A tiny helper that triggers a client-side file download — used by the Report
 * Builder's Save to hand the user the serialized RDL until backend persistence
 * exists (Phase 13). Isolated from any screen so the DOM dance (Blob → object URL
 * → anchor click → revoke) can be tested on its own.
 */

/**
 * Downloads `text` as a file named `filename`, by pointing a temporary anchor at a
 * Blob object URL and clicking it. The object URL is revoked immediately
 * afterwards, so it does not leak.
 *
 * @param filename The name to save the file as (e.g. `report.rdl`).
 * @param text The file contents.
 * @param mimeType The file's MIME type; defaults to `text/plain`.
 */
export function downloadText(filename: string, text: string, mimeType = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
