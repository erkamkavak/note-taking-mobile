import type { PageSize } from '@/types/note'

export type RenderedPdfPage = {
  full: string
  preview: string
  size: PageSize
  dims: { w: number; h: number }
}

const PREVIEW_MAX_DIMENSION = 960
const MAX_RENDER_DIMENSION = 2560
// Optimized scale for better quality/size balance
const BASE_SCALE = 2.5

const toDataUrlWithFallback = (canvas: HTMLCanvasElement, quality = 0.92): string => {
  try {
    // Try WebP first for best compression
    const webp = canvas.toDataURL('image/webp', quality)
    if (webp.startsWith('data:image/webp')) {
      return webp
    }
  } catch (error) {
    console.warn('WebP export failed, falling back to JPEG', error)
  }

  try {
    // Fallback to JPEG with good quality
    const jpeg = canvas.toDataURL('image/jpeg', quality)
    if (jpeg.startsWith('data:image/jpeg')) {
      return jpeg
    }
  } catch (error) {
    console.warn('JPEG export failed, falling back to PNG', error)
  }

  try {
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('PNG export failed, returning empty data URL', error)
    return ''
  }
}

const createPreviewDataUrl = (
  source: HTMLCanvasElement,
  quality = 0.9,
): string => {
  const previewCanvas = document.createElement('canvas')
  const ratio = source.width / source.height
  let targetWidth = source.width
  let targetHeight = source.height

  if (targetWidth > targetHeight) {
    if (targetWidth > PREVIEW_MAX_DIMENSION) {
      targetWidth = PREVIEW_MAX_DIMENSION
      targetHeight = Math.max(1, Math.round(targetWidth / ratio))
    }
  } else if (targetHeight > PREVIEW_MAX_DIMENSION) {
    targetHeight = PREVIEW_MAX_DIMENSION
    targetWidth = Math.max(1, Math.round(targetHeight * ratio))
  }

  previewCanvas.width = targetWidth
  previewCanvas.height = targetHeight
  const ctx = previewCanvas.getContext('2d')
  if (!ctx) return toDataUrlWithFallback(source, quality)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight)
  return toDataUrlWithFallback(previewCanvas, quality)
}

const determinePageSize = (width: number, height: number): PageSize => {
  const ratio = width / height
  if (ratio > 1.15) return 'horizontal'
  if (ratio < 0.85) return 'vertical'
  return 'square'
}

const renderSinglePage = async (page: any): Promise<RenderedPdfPage> => {
  const deviceRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  // Use a more conservative scale to reduce file size while maintaining quality
  let scale = Math.min(BASE_SCALE * deviceRatio, 3)
  let viewport = page.getViewport({ scale })
  const maxDimension = Math.max(viewport.width, viewport.height)
  if (maxDimension > MAX_RENDER_DIMENSION) {
    const reduction = maxDimension / MAX_RENDER_DIMENSION
    scale = scale / reduction
    viewport = page.getViewport({ scale })
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) {
    throw new Error('Could not get canvas context for PDF rendering')
  }
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  await page.render({ canvasContext: context, viewport, intent: 'display' }).promise

  // Use slightly higher quality (0.92) for better rendering
  const full = toDataUrlWithFallback(canvas, 0.92)
  const preview = createPreviewDataUrl(canvas)
  const dims = { w: canvas.width, h: canvas.height }
  const size = determinePageSize(canvas.width, canvas.height)

  // Release rendering resources
  canvas.width = 0
  canvas.height = 0

  return { full, preview, size, dims }
}

export const renderPdfDocumentPages = async (doc: any): Promise<RenderedPdfPage[]> => {
  const pages: RenderedPdfPage[] = []
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i)
    const rendered = await renderSinglePage(page)
    pages.push(rendered)
    page.cleanup?.()
  }
  return pages
}
