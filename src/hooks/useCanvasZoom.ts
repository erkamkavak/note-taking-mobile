import { useCallback, useState } from 'react'

const MIN_SCALE = 0.5
const MAX_SCALE = 3

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

export type Viewport = {
  scale: number
  offsetX: number
  offsetY: number
}

export const useCanvasZoom = (canvasRef: React.RefObject<HTMLCanvasElement>) => {
  const [viewport, setViewport] = useState<Viewport>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  })

  const zoomIn = useCallback(() => {
    setViewport((prev) => {
      const canvas = canvasRef.current
      if (!canvas) return prev

      const rect = canvas.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      const pointX = (centerX - prev.offsetX) / prev.scale
      const pointY = (centerY - prev.offsetY) / prev.scale

      const newScale = clamp(prev.scale * 1.2, MIN_SCALE, MAX_SCALE)

      const newOffsetX = centerX - pointX * newScale
      const newOffsetY = centerY - pointY * newScale

      return {
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      }
    })
  }, [canvasRef])

  const zoomOut = useCallback(() => {
    setViewport((prev) => {
      const canvas = canvasRef.current
      if (!canvas) return prev

      const rect = canvas.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      const pointX = (centerX - prev.offsetX) / prev.scale
      const pointY = (centerY - prev.offsetY) / prev.scale

      const newScale = clamp(prev.scale / 1.2, MIN_SCALE, MAX_SCALE)

      const newOffsetX = centerX - pointX * newScale
      const newOffsetY = centerY - pointY * newScale

      return {
        scale: newScale,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
      }
    })
  }, [canvasRef])

  const resetZoom = useCallback(() => {
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 })
  }, [])

  return {
    viewport,
    setViewport,
    zoomIn,
    zoomOut,
    resetZoom,
  }
}
