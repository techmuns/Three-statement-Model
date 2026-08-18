/**
 * PDF export — the dashboard view as a paginated A4 PDF.
 *
 * Captures Zone 2 (the same target as the visual snapshot) at 2× and lays it
 * across A4 pages so a long dashboard prints cleanly. Image-based on purpose:
 * it preserves exactly what the analyst sees, charts and all.
 */

import { captureRoot } from './capture'

export async function exportDashboardPdf(fileStem: string): Promise<void> {
  // Loaded on demand so jsPDF stays out of the dashboard's initial bundle.
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
  // JPEG (not PNG) keeps a multi-page dashboard export to a sensible file size.
  const dataUrl = await toJpeg(captureRoot(), { pixelRatio: 2, quality: 0.9, backgroundColor: '#F7F8FC' })

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load captured image for PDF'))
    img.src = dataUrl
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const imgH = (img.height / img.width) * pageW

  let heightLeft = imgH
  let position = 0
  pdf.addImage(dataUrl, 'JPEG', 0, position, pageW, imgH)
  heightLeft -= pageH
  while (heightLeft > 0) {
    position -= pageH
    pdf.addPage()
    pdf.addImage(dataUrl, 'JPEG', 0, position, pageW, imgH)
    heightLeft -= pageH
  }

  pdf.save(`${fileStem}.pdf`)
}
