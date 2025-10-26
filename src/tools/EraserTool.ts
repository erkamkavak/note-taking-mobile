import type { Stroke, StrokePoint } from '../types/note'

const distanceBetween = (a: StrokePoint, b: StrokePoint) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

const distancePointToSegment = (
  point: StrokePoint,
  start: StrokePoint,
  end: StrokePoint,
) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) {
    return distanceBetween(point, start)
  }
  const t =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)
  const clamped = Math.max(0, Math.min(1, t))
  const closestPoint = {
    x: start.x + clamped * dx,
    y: start.y + clamped * dy,
  }
  return distanceBetween(point, closestPoint)
}

export type EraserPreview = {
  point: StrokePoint
  strokeIds: string[]
}

export class EraserTool {
  private isErasing = false
  private removedStrokeIds = new Set<string>()
  private eraserPreview: EraserPreview | null = null
  private eraserSize: number
  private onErase: (strokeIds: string[]) => void
  private onPreviewUpdate: (preview: EraserPreview | null) => void

  constructor(
    eraserSize: number,
    onErase: (strokeIds: string[]) => void,
    onPreviewUpdate: (preview: EraserPreview | null) => void,
  ) {
    this.eraserSize = eraserSize
    this.onErase = onErase
    this.onPreviewUpdate = onPreviewUpdate
  }

  updateSize(size: number) {
    this.eraserSize = size
  }

  private getStrokesAtPoint(point: StrokePoint, strokes: Stroke[], viewportScale: number): string[] {
    const radius = (this.eraserSize / 2) / viewportScale
    const hits: string[] = []

    strokes.forEach((stroke) => {
      if (stroke.tool === 'eraser') return
      if (this.removedStrokeIds.has(stroke.id)) return

      const points = stroke.points
      for (let i = 0; i < points.length - 1; i += 1) {
        const p1 = points[i]
        const p2 = points[i + 1]
        if (!p1 || !p2) continue
        const distance = distancePointToSegment(point, p1, p2)
        if (distance <= radius) {
          hits.push(stroke.id)
          break
        }
      }

      if (points.length === 1) {
        const p = points[0]
        if (p) {
          const distance = distanceBetween(point, p)
          if (distance <= radius) {
            hits.push(stroke.id)
          }
        }
      }
    })

    return hits
  }

  handlePointerDown(point: StrokePoint, strokes: Stroke[], viewportScale: number) {
    this.isErasing = true
    this.removedStrokeIds.clear()
    const hits = this.getStrokesAtPoint(point, strokes, viewportScale)
    this.eraserPreview = hits.length > 0 ? { point, strokeIds: hits } : null
    this.onPreviewUpdate(this.eraserPreview)
    if (hits.length > 0) {
      hits.forEach((id) => this.removedStrokeIds.add(id))
      this.onErase([...this.removedStrokeIds])
    }
  }

  handlePointerMove(point: StrokePoint, strokes: Stroke[], viewportScale: number) {
    const hits = this.getStrokesAtPoint(point, strokes, viewportScale)
    this.eraserPreview = hits.length > 0 ? { point, strokeIds: hits } : null
    this.onPreviewUpdate(this.eraserPreview)

    if (this.isErasing && hits.length > 0) {
      hits.forEach((id) => this.removedStrokeIds.add(id))
      this.onErase([...this.removedStrokeIds])
    }
  }

  handlePointerUp() {
    this.isErasing = false
    this.eraserPreview = null
    this.removedStrokeIds.clear()
    this.onPreviewUpdate(null)
  }

  getEraserPreview(): EraserPreview | null {
    return this.eraserPreview
  }

  getRemovedStrokeIds(): Set<string> {
    return this.removedStrokeIds
  }
}
