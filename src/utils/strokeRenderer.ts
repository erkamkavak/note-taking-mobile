import type { Stroke } from '@/types/note'

export const paintStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke): void => {
  if (stroke.points.length === 0) return

  ctx.save()
  ctx.globalAlpha = stroke.opacity ?? (stroke.tool === 'highlighter' ? 0.35 : 1)
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
  ctx.strokeStyle = stroke.color
  ctx.lineWidth = stroke.size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2

  const points = stroke.points
  ctx.beginPath()

  if (points.length === 1) {
    const onlyPoint = points[0]
    ctx.arc(onlyPoint.x, onlyPoint.y, stroke.size / 2, 0, Math.PI * 2)
    ctx.fillStyle = stroke.color
    ctx.fill()
    ctx.restore()
    return
  }

  ctx.moveTo(points[0]?.x ?? 0, points[0]?.y ?? 0)

  if (points.length === 2) {
    ctx.lineTo(points[1]?.x ?? 0, points[1]?.y ?? 0)
  } else {
    for (let i = 1; i < points.length - 1; i += 1) {
      const current = points[i]
      const next = points[i + 1]
      if (!current || !next) continue
      const midX = (current.x + next.x) / 2
      const midY = (current.y + next.y) / 2
      ctx.quadraticCurveTo(current.x, current.y, midX, midY)
    }
    const penultimate = points[points.length - 2]
    const last = points[points.length - 1]
    if (penultimate && last) {
      ctx.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y)
    }
  }

  ctx.stroke()
  ctx.restore()
}
