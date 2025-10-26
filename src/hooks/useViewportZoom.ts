import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { clamp } from '../utils/canvasGeometry'

export type Viewport = {
  scale: number
  offsetX: number
  offsetY: number
}

export const useViewportZoom = (
  setViewport: Dispatch<SetStateAction<Viewport>>,
  minScale: number,
  maxScale: number,
) => {
  const zoomIn = useCallback(() => {
    setViewport((prev) => {
      const scale = clamp(prev.scale * 1.2, minScale, maxScale)
      return scale === prev.scale
        ? prev
        : {
            ...prev,
            scale,
            offsetX: scale <= 1 ? 0 : prev.offsetX,
            offsetY: scale <= 1 ? 0 : prev.offsetY,
          }
    })
  }, [maxScale, minScale, setViewport])

  const zoomOut = useCallback(() => {
    setViewport((prev) => {
      const scale = clamp(prev.scale / 1.2, minScale, maxScale)
      if (scale === prev.scale) return prev
      return {
        ...prev,
        scale,
        offsetX: scale <= 1 ? 0 : prev.offsetX,
        offsetY: scale <= 1 ? 0 : prev.offsetY,
      }
    })
  }, [maxScale, minScale, setViewport])

  const resetZoom = useCallback(() => {
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 })
  }, [setViewport])

  return { zoomIn, zoomOut, resetZoom }
}
