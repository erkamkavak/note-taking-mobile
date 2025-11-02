import { useCallback } from 'react'
import type { RefObject } from 'react'
import type { Stroke, Page } from '../types/note'
import type { SelectionState } from '../tools'
import { cloneStrokes } from '../utils/canvasDrawing'

const sanitizeFileName = (title: string, extension: string) =>
  `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`

type UseCanvasExportOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>
  canvasSizeRef: RefObject<{ width: number; height: number }>
  backgroundImageRef: RefObject<HTMLImageElement | null>
  drawStroke: (ctx: CanvasRenderingContext2D, stroke: Stroke) => void
  strokes: Stroke[]
  currentStroke: Stroke | null
  currentNoteTitle: string
  selection: SelectionState | null
}

export const useCanvasExport = ({
  canvasRef,
  canvasSizeRef,
  backgroundImageRef,
  drawStroke,
  strokes,
  currentStroke,
  currentNoteTitle,
  selection,
}: UseCanvasExportOptions) => {
  const createThumbnail = useCallback((canvas: HTMLCanvasElement) => {
    const ratio = window.devicePixelRatio || 1
    const originalWidth = canvas.width / ratio
    const originalHeight = canvas.height / ratio
    const maxDimension = 360
    const scale =
      originalWidth > originalHeight
        ? maxDimension / originalWidth
        : maxDimension / originalHeight
    const targetScale = Math.min(1, scale)
    const targetWidth = Math.max(1, Math.round(originalWidth * targetScale))
    const targetHeight = Math.max(1, Math.round(originalHeight * targetScale))

    const thumbnailCanvas = document.createElement('canvas')
    thumbnailCanvas.width = targetWidth
    thumbnailCanvas.height = targetHeight
    const thumbnailContext = thumbnailCanvas.getContext('2d')
    if (!thumbnailContext) return canvas.toDataURL('image/png')

    thumbnailContext.fillStyle = '#FAFAFA'
    thumbnailContext.fillRect(0, 0, targetWidth, targetHeight)
    thumbnailContext.drawImage(canvas, 0, 0, targetWidth, targetHeight)
    return thumbnailCanvas.toDataURL('image/png')
  }, [])

  const exportCanvas = useCallback(() => {
    const sourceCanvas = canvasRef.current
    if (!sourceCanvas) return null

    const ratio = window.devicePixelRatio || 1
    const { width, height } = canvasSizeRef.current

    const exportCanvasEl = document.createElement('canvas')
    exportCanvasEl.width = width * ratio
    exportCanvasEl.height = height * ratio
    const exportContext = exportCanvasEl.getContext('2d')
    if (!exportContext) return null

    exportContext.setTransform(ratio, 0, 0, ratio, 0, 0)
    exportContext.imageSmoothingEnabled = true
    exportContext.imageSmoothingQuality = 'high'
    exportContext.fillStyle = '#FAFAFA'
    exportContext.fillRect(0, 0, width, height)

    const backgroundImage = backgroundImageRef.current
    if (backgroundImage) {
      const imgW = backgroundImage.naturalWidth || backgroundImage.width
      const imgH = backgroundImage.naturalHeight || backgroundImage.height
      if (imgW && imgH) {
        const scale = Math.min(width / imgW, height / imgH)
        const drawW = imgW * scale
        const drawH = imgH * scale
        const dx = (width - drawW) / 2
        const dy = (height - drawH) / 2
        // Explicitly set quality for background image rendering
        exportContext.imageSmoothingEnabled = true
        exportContext.imageSmoothingQuality = 'high'
        exportContext.drawImage(backgroundImage, dx, dy, drawW, drawH)
      } else {
        // Fallback to stretch if natural size is unavailable
        exportContext.imageSmoothingEnabled = true
        exportContext.imageSmoothingQuality = 'high'
        exportContext.drawImage(backgroundImage, 0, 0, width, height)
      }
    }

    cloneStrokes(strokes).forEach((stroke) => drawStroke(exportContext, stroke))
    if (currentStroke) {
      drawStroke(exportContext, currentStroke)
    }

    const dataUrl = exportCanvasEl.toDataURL('image/png')
    const thumbnailUrl = createThumbnail(exportCanvasEl)

    return { dataUrl, thumbnailUrl }
  }, [
    backgroundImageRef,
    canvasRef,
    canvasSizeRef,
    createThumbnail,
    currentStroke,
    drawStroke,
    strokes,
  ])

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }, [])

  const exportAsPNG = useCallback(() => {
    const exportResult = exportCanvas()
    if (!exportResult) return

    const link = document.createElement('a')
    link.href = exportResult.dataUrl
    link.download = sanitizeFileName(currentNoteTitle, 'png')
    link.click()
  }, [currentNoteTitle, exportCanvas])

  // Render a given Page using current canvas size and drawing primitive
  const renderPageToCanvas = useCallback(
    async (page: Page): Promise<HTMLCanvasElement | null> => {
      // Use a fixed, optimized resolution for PDF export instead of devicePixelRatio
      // This significantly reduces file size while maintaining good quality
      const exportDPI = 150 // Higher DPI for better quality
      const fallbackWidth = canvasSizeRef.current?.width ?? 0
      const fallbackHeight = canvasSizeRef.current?.height ?? 0
      const resolvedWidth =
        page.bgWidth ?? (fallbackWidth > 0 ? fallbackWidth : undefined) ?? 1280
      const resolvedHeight =
        page.bgHeight ?? (fallbackHeight > 0 ? fallbackHeight : undefined) ?? 720
      const baseWidth = Math.max(1, resolvedWidth)
      const baseHeight = Math.max(1, resolvedHeight)
      const exportCanvasEl = document.createElement('canvas')
      // Scale to 150 DPI for optimal file size/quality balance
      exportCanvasEl.width = Math.round((baseWidth * exportDPI) / 96)
      exportCanvasEl.height = Math.round((baseHeight * exportDPI) / 96)
      const ctx = exportCanvasEl.getContext('2d')
      if (!ctx) return null

      // Scale context to match the new canvas resolution
      ctx.setTransform(exportDPI / 96, 0, 0, exportDPI / 96, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.fillStyle = page.backgroundColor || '#FAFAFA'
      ctx.fillRect(0, 0, baseWidth, baseHeight)

      let backgroundImage: HTMLImageElement | null = null
      const loadImage = (src: string) =>
        new Promise<HTMLImageElement | null>((resolve) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () => resolve(null)
          img.src = src
        })

      if (page.thumbnailUrl) {
        backgroundImage = await loadImage(page.thumbnailUrl)
      } else if (backgroundImageRef.current?.src) {
        backgroundImage = backgroundImageRef.current
      }

      if (backgroundImage) {
        const imgW = backgroundImage.naturalWidth || backgroundImage.width
        const imgH = backgroundImage.naturalHeight || backgroundImage.height
        if (imgW && imgH) {
          const scale = Math.min(baseWidth / imgW, baseHeight / imgH)
          const drawW = imgW * scale
          const drawH = imgH * scale
          const dx = (baseWidth - drawW) / 2
          const dy = (baseHeight - drawH) / 2
          ctx.drawImage(backgroundImage, dx, dy, drawW, drawH)
        }
      }

      cloneStrokes(page.strokes).forEach((s) => drawStroke(ctx, s))
      return exportCanvasEl
    },
    [backgroundImageRef, canvasSizeRef, drawStroke],
  )

  // Export multiple pages as a single multi-page PDF
  const exportPagesAsPDF = useCallback(
    async (pages: Page[], title?: string) => {
      if (!pages || pages.length === 0) return
      try {
        const { jsPDF } = await import('jspdf')

        // First, determine the optimal orientation based on page dimensions
        const firstPage = pages[0]
        const firstCanvas = await renderPageToCanvas(firstPage)
        if (!firstCanvas) return

        const isLandscape = firstCanvas.width > firstCanvas.height
        const orientation = isLandscape ? 'landscape' : 'portrait'

        // Use A4 format and calculate dimensions
        const pdf = new jsPDF({ orientation, unit: 'px', format: 'a4' })
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = pdf.internal.pageSize.getHeight()

        for (let idx = 0; idx < pages.length; idx += 1) {
          const cnv = await renderPageToCanvas(pages[idx])
          if (!cnv) continue

          // Use JPEG with 0.92 quality for optimal file size
          // Combined with 150 DPI, this provides excellent quality with good compression
          const imgData = cnv.toDataURL('image/jpeg', 0.92)

          const scaleRatio = Math.min(pdfWidth / cnv.width, pdfHeight / cnv.height)
          const finalW = cnv.width * scaleRatio
          const finalH = cnv.height * scaleRatio
          const x = (pdfWidth - finalW) / 2
          const y = (pdfHeight - finalH) / 2

          if (idx > 0) pdf.addPage()
          pdf.addImage(imgData, 'JPEG', x, y, finalW, finalH)
        }
        const filename = sanitizeFileName(title ?? currentNoteTitle, 'pdf')
        pdf.save(filename)
      } catch (e) {
        console.error('PDF export failed', e)
      }
    },
    [currentNoteTitle, renderPageToCanvas],
  )

  const createSelectionCanvas = useCallback(
    (strokeIds: string[]) => {
      if (strokeIds.length === 0) return null
      const selectedStrokes = strokes.filter((stroke) => strokeIds.includes(stroke.id))
      if (selectedStrokes.length === 0) return null

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      selectedStrokes.forEach((stroke) => {
        stroke.points.forEach((point) => {
          minX = Math.min(minX, point.x)
          minY = Math.min(minY, point.y)
          maxX = Math.max(maxX, point.x)
          maxY = Math.max(maxY, point.y)
        })
      })

      if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        return null
      }

      const padding = 12
      const width = Math.max(1, maxX - minX + padding * 2)
      const height = Math.max(1, maxY - minY + padding * 2)
      const ratio = window.devicePixelRatio || 1
      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = width * ratio
      exportCanvas.height = height * ratio
      const ctx = exportCanvas.getContext('2d')
      if (!ctx) return null
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.translate(-minX + padding, -minY + padding)
      selectedStrokes.forEach((stroke) => {
        drawStroke(ctx, stroke)
      })
      return exportCanvas
    },
    [drawStroke, strokes],
  )

  const selectionToBlob = useCallback(
    async (strokeIds: string[]) => {
      const selectionCanvas = createSelectionCanvas(strokeIds)
      if (!selectionCanvas) return null
      return new Promise<Blob | null>((resolve) => {
        selectionCanvas.toBlob((blob) => resolve(blob), 'image/png')
      })
    },
    [createSelectionCanvas],
  )

  const copySelectionAsImage = useCallback(async () => {
    if (!selection) return
    const blob = await selectionToBlob(selection.strokeIds)
    if (!blob) return
    const clipboard = navigator.clipboard
    const ClipboardItemCtor =
      typeof window !== 'undefined'
        ? (window as Window &
            typeof globalThis & { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
        : undefined
    if (clipboard && ClipboardItemCtor && 'write' in clipboard) {
      try {
        const item = new ClipboardItemCtor({ [blob.type]: blob })
        await clipboard.write([item])
        return
      } catch (_) {
        // ignore and fall back to download
      }
    }
    downloadBlob(blob, 'selection.png')
  }, [downloadBlob, selection, selectionToBlob])

  const shareSelectionAsImage = useCallback(async () => {
    if (!selection) return
    const blob = await selectionToBlob(selection.strokeIds)
    if (!blob) return
    if (navigator.share) {
      try {
        const file = new File([blob], 'selection.png', { type: 'image/png' })
        const canShareFiles = typeof navigator.canShare === 'function'
          ? navigator.canShare({ files: [file] })
          : true
        if (canShareFiles) {
          await navigator.share({
            files: [file],
            title: 'Canvas Selection',
            text: 'Shared from Note Canvas',
          })
          return
        }
      } catch (_) {
        // fall through to download
      }
    }
    downloadBlob(blob, 'selection.png')
  }, [downloadBlob, selection, selectionToBlob])

  return {
    exportCanvas,
    exportAsPNG,
    copySelectionAsImage,
    shareSelectionAsImage,
    renderPageToCanvas,
    exportPagesAsPDF,
  }
}
