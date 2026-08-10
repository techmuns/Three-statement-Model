/**
 * Visual export.
 *
 * Two entry points, both capturing Zone 2 (the scrollable main, tagged
 * `#dashboard-main`) at 2× for a sharp image:
 *  - `registerVisualCapture()` answers the host's `dashboard.capture.visual`
 *    request with a native Blob (per Munshot auth-standards).
 *  - `downloadDashboardPng()` backs the header Export button for local/manual
 *    use, saving a PNG straight from the browser.
 */

import { toBlob } from 'html-to-image'
import { sdk } from './sdk'

export function captureRoot(): HTMLElement {
  const el =
    document.querySelector('#dashboard-main') ||
    document.querySelector('[data-dashboard-capture-root="true"]') ||
    document.querySelector('main')
  if (!el) throw new Error('Main content container not found for visual snapshot')
  return el as HTMLElement
}

async function captureBlob(): Promise<Blob> {
  const blob = await toBlob(captureRoot(), { pixelRatio: 2, backgroundColor: '#ffffff' })
  if (!blob) throw new Error('Visual snapshot capture returned an empty Blob')
  return blob
}

/** Register the host-driven capture channel. Call once at app start. */
export function registerVisualCapture(): void {
  sdk.onRequest('dashboard.capture.visual', async () => ({
    visualSnapshot: await captureBlob(),
    capturedAt: new Date().toISOString(),
  }))
}

/** Save the current dashboard view as a PNG (header Export button). */
export async function downloadDashboardPng(fileStem: string): Promise<void> {
  const blob = await captureBlob()
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileStem}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
