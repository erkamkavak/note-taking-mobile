import type { Stroke, StrokePoint } from '../types/note'

export type ToolType = 'pen' | 'highlighter' | 'eraser' | 'selector'

export type ToolSettings = {
  color: string
  size: number
  opacity?: number
}

export type ToolContext = {
  strokes: Stroke[]
  currentStroke: Stroke | null
  viewport: {
    scale: number
    offsetX: number
    offsetY: number
  }
  toCanvasPoint: (clientX: number, clientY: number) => StrokePoint | null
}

export type ToolEventHandlers = {
  onPointerDown: (event: PointerEvent, context: ToolContext) => void
  onPointerMove: (event: PointerEvent, context: ToolContext) => void
  onPointerUp: (event: PointerEvent, context: ToolContext) => void
}

export interface Tool {
  type: ToolType
  settings: ToolSettings
  handlers: ToolEventHandlers
}
