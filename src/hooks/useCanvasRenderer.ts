import { useCallback, useEffect, useRef } from 'react'
import type { Stroke, StrokePoint } from '../types/note'
import type { SelectionState } from '../tools'
import { translateStroke } from '../utils/canvasDrawing'
import { paintStroke } from '@/utils/strokeRenderer'

type EraserPreviewState = {
  point: StrokePoint
  strokeIds: string[]
} | null

type UseCanvasRendererProps = {
  strokes: Stroke[]
  currentStroke: Stroke | null
  selection: SelectionState | null
  selectionPath: StrokePoint[]
  eraserPreview: EraserPreviewState
  fadingStrokes: Record<string, boolean>
  backgroundColor?: string
  viewportScale?: number
}

export const useCanvasRenderer = ({
  strokes,
  currentStroke,
  selection,
  selectionPath,
  eraserPreview,
  fadingStrokes,
  backgroundColor = '#FAFAFA',
  viewportScale = 1,
}: UseCanvasRendererProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const backgroundImageRef = useRef<HTMLImageElement | null>(null)
  const canvasSizeRef = useRef({ width: 0, height: 0 })

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const width = container.clientWidth
    const height = container.clientHeight
    const ratio = window.devicePixelRatio || 1
    // Use a higher resolution multiplier for better rendering quality
    const qualityMultiplier = Math.max(1, Math.min(ratio * 2, 4))
    
    canvas.width = width * qualityMultiplier
    canvas.height = height * qualityMultiplier
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const context = canvas.getContext('2d')
    if (!context) return
    contextRef.current = context
    canvasSizeRef.current = { width, height }
  }, [])

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    paintStroke(ctx, stroke)
  }, [])

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const context = contextRef.current
    if (!canvas || !context) return

    const ratio = window.devicePixelRatio || 1
    const qualityMultiplier = Math.max(1, Math.min(ratio * 2, 4))
    const { width, height } = canvasSizeRef.current

    context.save()
    context.setTransform(qualityMultiplier, 0, 0, qualityMultiplier, 0, 0)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.clearRect(0, 0, width, height)
    context.fillStyle = backgroundColor
    context.fillRect(0, 0, width, height)

    const backgroundImage = backgroundImageRef.current
    if (backgroundImage) {
      context.globalAlpha = 1
      context.globalCompositeOperation = 'source-over'
      const imgW = (backgroundImage as HTMLImageElement).naturalWidth || backgroundImage.width
      const imgH = (backgroundImage as HTMLImageElement).naturalHeight || backgroundImage.height
      if (imgW > 0 && imgH > 0) {
        const scale = Math.min(width / imgW, height / imgH)
        const drawW = imgW * scale
        const drawH = imgH * scale
        const dx = (width - drawW) / 2
        const dy = (height - drawH) / 2
        // Use drawImage with proper quality settings for better rendering
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        context.drawImage(backgroundImage, dx, dy, drawW, drawH)
      } else {
        // Fallback to stretch if natural size is unavailable
        context.imageSmoothingEnabled = true
        context.imageSmoothingQuality = 'high'
        context.drawImage(backgroundImage, 0, 0, width, height)
      }
    }

    const selectedIds = selection?.strokeIds ?? []
    const dragDelta = selection?.dragDelta
    const eraserStrokeIds = new Set(eraserPreview?.strokeIds ?? [])

    strokes.forEach((stroke) => {
      const isPreviewFade = eraserStrokeIds.has(stroke.id)
      const isFading = Boolean(fadingStrokes[stroke.id])
      context.save()
      if (isFading) {
        context.globalAlpha *= 0.15
      } else if (isPreviewFade) {
        context.globalAlpha *= 0.35
      }
      if (dragDelta && selectedIds.includes(stroke.id)) {
        drawStroke(context, translateStroke(stroke, dragDelta))
      } else {
        drawStroke(context, stroke)
      }
      context.restore()
    })

    if (currentStroke) {
      drawStroke(context, currentStroke)
    }

    if (selectionPath.length > 1) {
      context.save()
      context.fillStyle = 'rgba(0, 0, 0, 0.04)'
      context.strokeStyle = '#000000'
      const s = Math.max(0.001, viewportScale)
      context.lineWidth = 1.2 / s
      context.setLineDash([8 / s, 5 / s])
      context.beginPath()
      const startPoint = selectionPath[0]
      context.moveTo(startPoint?.x ?? 0, startPoint?.y ?? 0)
      for (let i = 1; i < selectionPath.length; i += 1) {
        const point = selectionPath[i]
        context.lineTo(point.x, point.y)
      }
      if (startPoint) {
        context.lineTo(startPoint.x, startPoint.y)
      }
      context.closePath()
      context.fill()
      context.stroke()
      context.restore()
    } else if (selection) {
      const delta = selection.dragDelta ?? { x: 0, y: 0 }
      const polygon = selection.polygon.map((point) => ({
        x: point.x + delta.x,
        y: point.y + delta.y,
      }))
      context.save()
      context.fillStyle = 'rgba(0, 0, 0, 0.04)'
      context.strokeStyle = '#000000'
      const s = Math.max(0.001, viewportScale)
      context.lineWidth = 1.2 / s
      context.setLineDash([8 / s, 5 / s])
      context.beginPath()
      context.moveTo(polygon[0]?.x ?? 0, polygon[0]?.y ?? 0)
      for (let i = 1; i < polygon.length; i += 1) {
        const point = polygon[i]
        context.lineTo(point.x, point.y)
      }
      context.closePath()
      context.fill()
      context.stroke()
      context.restore()
    }

    context.restore()
  }, [
    currentStroke,
    drawStroke,
    eraserPreview,
    fadingStrokes,
    selection,
    selectionPath,
    strokes,
    backgroundColor,
    viewportScale,
  ])

  const renderCanvasRef = useRef(renderCanvas)
  useEffect(() => {
    renderCanvasRef.current = renderCanvas
  }, [renderCanvas])

  useEffect(() => {
    resizeCanvas()
    renderCanvasRef.current?.()
  }, [resizeCanvas])

  // Recompute canvas resolution when zoom level changes for sharper rendering
  useEffect(() => {
    resizeCanvas()
    requestAnimationFrame(() => {
      renderCanvasRef.current?.()
    })
  }, [resizeCanvas, viewportScale])

  useEffect(() => {
    let rafId: number | null = null
    const scheduleRender = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        renderCanvasRef.current?.()
        rafId = null
      })
    }
    scheduleRender()
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [
    strokes,
    currentStroke,
    selection,
    selectionPath,
    eraserPreview,
    fadingStrokes,
  ])

  useEffect(() => {
    const handleResize = () => {
      resizeCanvas()
      requestAnimationFrame(() => {
        renderCanvasRef.current?.()
      })
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [resizeCanvas])

  return {
    canvasRef,
    containerRef,
    backgroundImageRef,
    canvasSizeRef,
    drawStroke,
    forceRender: () => renderCanvasRef.current?.(),
  }
}
