import type { StrokePoint } from '../types/note'

export const distanceBetween = (a: StrokePoint, b: StrokePoint): number => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.sqrt(dx * dx + dy * dy)
}

export const distancePointToSegment = (
  point: StrokePoint,
  segmentStart: StrokePoint,
  segmentEnd: StrokePoint,
): number => {
  const dx = segmentEnd.x - segmentStart.x
  const dy = segmentEnd.y - segmentStart.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) {
    return distanceBetween(point, segmentStart)
  }

  let t =
    ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) /
    lengthSquared
  t = Math.max(0, Math.min(1, t))

  const closestX = segmentStart.x + t * dx
  const closestY = segmentStart.y + t * dy

  return distanceBetween(point, { x: closestX, y: closestY })
}

export const isPointInPolygon = (
  point: StrokePoint,
  polygon: StrokePoint[],
): boolean => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]
    const pj = polygon[j]
    if (!pi || !pj) continue

    const intersect =
      pi.y > point.y !== pj.y > point.y &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x

    if (intersect) inside = !inside
  }
  return inside
}

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))
