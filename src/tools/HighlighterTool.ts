import type { Stroke, StrokePoint } from '../types/note'
import type { ToolSettings } from './types'

const makeStrokeId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const distanceBetween = (a: StrokePoint, b: StrokePoint) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

const midpointBetween = (a: StrokePoint, b: StrokePoint): StrokePoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
})

export class HighlighterTool {
  private currentStroke: Stroke | null = null
  private settings: ToolSettings
  private onStrokeStart: () => void
  private onStrokeUpdate: (stroke: Stroke) => void
  private onStrokeEnd: (stroke: Stroke) => void

  constructor(
    settings: ToolSettings,
    onStrokeStart: () => void,
    onStrokeUpdate: (stroke: Stroke) => void,
    onStrokeEnd: (stroke: Stroke) => void,
  ) {
    this.settings = settings
    this.onStrokeStart = onStrokeStart
    this.onStrokeUpdate = onStrokeUpdate
    this.onStrokeEnd = onStrokeEnd
  }

  updateSettings(settings: ToolSettings) {
    this.settings = settings
  }

  handlePointerDown(point: StrokePoint) {
    const stroke: Stroke = {
      id: makeStrokeId(),
      tool: 'highlighter',
      points: [point],
      color: this.settings.color,
      size: this.settings.size,
      opacity: this.settings.opacity ?? 0.35,
    }
    this.currentStroke = stroke
    this.onStrokeStart()
    this.onStrokeUpdate({
      ...stroke,
      points: [...stroke.points],
    })
  }

  handlePointerMove(point: StrokePoint) {
    if (!this.currentStroke) return

    const lastPoint = this.currentStroke.points[this.currentStroke.points.length - 1]
    if (!lastPoint) return

    const distance = distanceBetween(lastPoint, point)
    if (distance < 2) return

    // Add interpolated points for smoother lines
    if (distance > 5) {
      const midpoint = midpointBetween(lastPoint, point)
      this.currentStroke.points.push(midpoint)
    }

    this.currentStroke.points.push(point)
    this.onStrokeUpdate({
      ...this.currentStroke,
      points: [...this.currentStroke.points],
    })
  }

  handlePointerUp() {
    if (this.currentStroke && this.currentStroke.points.length > 0) {
      this.onStrokeEnd(this.currentStroke)
    }
    this.currentStroke = null
  }

  getCurrentStroke(): Stroke | null {
    return this.currentStroke
  }
}
