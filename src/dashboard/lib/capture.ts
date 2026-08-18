/**
 * Visual export: capture Zone 2 (the scrollable main, tagged `#dashboard-main`)
 * at 2× and save it as a PNG. Backs the header Export → PNG action.
 */

import { toBlob } from 'html-to-image'

export function captureRoot(): HTMLElement {
  const el =
    document.querySelector('#dashboard-main') ||
    document.querySelector('[data-dashboard-capture-root="true"]') ||
    document.querySelector('main')
  if (!el) throw new Error('Main content container not found for visual snapshot')
  return el as HTMLElement
}

async function captureBlob(): Promise<Blob> {
  const blob = await toBlob(captureRoot(), { pixelRatio: 2, backgroundColor: '#F7F8FC' })
  if (!blob) throw new Error('Visual snapshot capture returned an empty Blob')
  return blob
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
