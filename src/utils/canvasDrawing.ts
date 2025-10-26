import type { Stroke, StrokePoint } from '../types/note'

export const drawStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
): void => {
  if (stroke.points.length === 0) return

  ctx.save()
  ctx.globalAlpha = stroke.opacity ?? (stroke.tool === 'highlighter' ? 0.35 : 1)

  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
  } else {
    ctx.globalCompositeOperation = 'source-over'
  }

  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  const firstPoint = stroke.points[0]
  if (!firstPoint) {
    ctx.restore()
    return
  }

  ctx.moveTo(firstPoint.x, firstPoint.y)

  for (let i = 1; i < stroke.points.length; i += 1) {
    const point = stroke.points[i]
    if (!point) continue
    ctx.lineTo(point.x, point.y)
  }

  ctx.stroke()
  ctx.restore()
}

export const translateStroke = (
  stroke: Stroke,
  delta: StrokePoint,
): Stroke => ({
  ...stroke,
  points: stroke.points.map((p) => ({
    x: p.x + delta.x,
    y: p.y + delta.y,
  })),
})

export const cloneStrokes = (strokes: Stroke[]): Stroke[] =>
  strokes.map((stroke) => ({
    ...stroke,
    points: [...stroke.points],
  }))
