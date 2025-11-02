import type { Note, Page } from '@/types/note'
import { cloneStrokes } from '@/utils/canvasDrawing'
import { paintStroke } from '@/utils/strokeRenderer'

const sanitizeFileName = (title: string, extension: string) =>
  `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (!src) {
      resolve(null)
      return
    }
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

const renderPage = async (page: Page, fallbackBackground?: string): Promise<HTMLCanvasElement> => {
  // Use fixed DPI instead of devicePixelRatio for consistent, smaller file sizes
  const exportDPI = 150 // Higher DPI for better quality (was 96)
  const width = Math.max(1, page.bgWidth ?? 1280)
  const height = Math.max(1, page.bgHeight ?? 720)

  const canvas = document.createElement('canvas')
  // Fixed resolution instead of devicePixelRatio-scaled
  canvas.width = Math.round((width * exportDPI) / 96)
  canvas.height = Math.round((height * exportDPI) / 96)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get 2d context for export')

  ctx.setTransform(exportDPI / 96, 0, 0, exportDPI / 96, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = page.backgroundColor || '#FAFAFA'
  ctx.fillRect(0, 0, width, height)

  const bgCandidate = page.thumbnailUrl || fallbackBackground
  const backgroundImage = bgCandidate ? await loadImage(bgCandidate) : null

  if (backgroundImage) {
    const imgW = backgroundImage.naturalWidth || backgroundImage.width
    const imgH = backgroundImage.naturalHeight || backgroundImage.height
    if (imgW && imgH) {
      const scale = Math.min(width / imgW, height / imgH)
      const drawW = imgW * scale
      const drawH = imgH * scale
      const dx = (width - drawW) / 2
      const dy = (height - drawH) / 2
      ctx.drawImage(backgroundImage, dx, dy, drawW, drawH)
    }
  }

  cloneStrokes(page.strokes).forEach((stroke) => {
    paintStroke(ctx, stroke)
  })

  return canvas
}

export const exportNoteAsPdf = async (note: Note): Promise<void> => {
  if (!note.pages || note.pages.length === 0) return
  try {
    const { jsPDF } = await import('jspdf')
    
    // Determine orientation from first page
    const firstPage = note.pages[0]
    const firstCanvas = await renderPage(firstPage, note.thumbnailUrl || note.dataUrl)
    const isLandscape = firstCanvas.width > firstCanvas.height
    const orientation = isLandscape ? 'landscape' : 'portrait'
    
    // Use A4 format for standardized output
    const pdf = new jsPDF({ orientation, unit: 'px', format: 'a4' })
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()

    for (let index = 0; index < note.pages.length; index += 1) {
      const page = note.pages[index]
      const canvas = await renderPage(page, note.thumbnailUrl || note.dataUrl)

      // Use JPEG with compression for much smaller file size
      // Quality 0.92 provides excellent quality with good size reduction
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      
      // Scale to fit A4 page while maintaining aspect ratio
      const scaleRatio = Math.min(pdfWidth / canvas.width, pdfHeight / canvas.height)
      const scaledWidth = canvas.width * scaleRatio
      const scaledHeight = canvas.height * scaleRatio
      const x = (pdfWidth - scaledWidth) / 2
      const y = (pdfHeight - scaledHeight) / 2

      if (index > 0) pdf.addPage()
      pdf.addImage(imgData, 'JPEG', x, y, scaledWidth, scaledHeight)
    }

    if (pdf) {
      const filename = sanitizeFileName(note.title || 'note', 'pdf')
      pdf.save(filename)
    }
  } catch (error) {
    console.error('Failed to export note as PDF', error)
    throw error
  }
}
