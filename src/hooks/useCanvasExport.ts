import { useCallback } from 'react'
import type { RefObject } from 'react'
import type { Stroke } from '../types/note'
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
    exportContext.fillStyle = '#FAFAFA'
    exportContext.fillRect(0, 0, width, height)

    const backgroundImage = backgroundImageRef.current
    if (backgroundImage) {
      exportContext.drawImage(backgroundImage, 0, 0, width, height)
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

  const exportAsPDF = useCallback(async () => {
    const exportResult = exportCanvas()
    if (!exportResult) return

    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: 'a4' })
      const imgData = exportResult.dataUrl
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const img = new Image()

      img.onload = () => {
        const ratio = Math.min(pdfWidth / img.width, pdfHeight / img.height, 1)
        const finalWidth = img.width * ratio
        const finalHeight = img.height * ratio
        const x = (pdfWidth - finalWidth) / 2
        const y = (pdfHeight - finalHeight) / 2
        pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight)
        pdf.save(sanitizeFileName(currentNoteTitle, 'pdf'))
      }

      img.src = imgData
    } catch (error) {
      console.error('Failed to export PDF:', error)
      exportAsPNG()
    }
  }, [currentNoteTitle, exportAsPNG, exportCanvas])

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
    exportAsPDF,
    copySelectionAsImage,
    shareSelectionAsImage,
  }
}
