import { useCallback, useEffect, useRef } from 'react'
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from 'react'
import type { Stroke, StrokePoint } from '../types/note'
import type { SelectionState } from '../tools'
import type { PenTool, HighlighterTool, EraserTool, SelectorTool } from '../tools'
import { clamp, distanceBetween } from '../utils/canvasGeometry'
import type { ToolType } from '../tools/types'

type Viewport = {
  scale: number
  offsetX: number
  offsetY: number
}

type PointerCacheEntry = {
  x: number
  y: number
}

type PinchState = {
  initialDistance: number
  initialScale: number
  initialOffsetX: number
  initialOffsetY: number
  initialMidpoint: { x: number; y: number }
}

type PointerHandlersOptions = {
  canvasRef: RefObject<HTMLCanvasElement | null>
  toCanvasPoint: (clientX: number, clientY: number) => StrokePoint | null
  tool: ToolType
  viewport: Viewport
  setViewport: Dispatch<SetStateAction<Viewport>>
  hasPenInput: boolean
  isMobile: boolean
  strokes: Stroke[]
  selectorToolRef: MutableRefObject<SelectorTool | null>
  eraserToolRef: MutableRefObject<EraserTool | null>
  penToolRef: MutableRefObject<PenTool | null>
  highlighterToolRef: MutableRefObject<HighlighterTool | null>
  setSelection: Dispatch<SetStateAction<SelectionState | null>>
  setSelectionPath: Dispatch<SetStateAction<StrokePoint[]>>
  setEraserIndicator: Dispatch<SetStateAction<{ point: StrokePoint; isActive: boolean; pulseKey: number } | null>>
  eraserIndicatorTimeoutRef: MutableRefObject<number | null>
  eraserActiveRef: MutableRefObject<boolean>
  removedStrokeIdsRef: MutableRefObject<Set<string>>
  MIN_SCALE: number
  MAX_SCALE: number
}

export const usePointerHandlers = ({
  canvasRef,
  toCanvasPoint,
  tool,
  viewport,
  setViewport,
  hasPenInput,
  isMobile,
  strokes,
  selectorToolRef,
  eraserToolRef,
  penToolRef,
  highlighterToolRef,
  setSelection,
  setSelectionPath,
  setEraserIndicator,
  eraserIndicatorTimeoutRef,
  eraserActiveRef,
  removedStrokeIdsRef,
  MIN_SCALE,
  MAX_SCALE,
}: PointerHandlersOptions) => {
  const pointerCacheRef = useRef<Map<number, PointerCacheEntry>>(new Map())
  const pinchStateRef = useRef<PinchState | null>(null)

  const releasePointer = useCallback(
    (pointerId: number) => {
      const canvas = canvasRef.current
      if (!canvas) return
      if (canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId)
      }
    },
    [canvasRef],
  )

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      event.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return

      const penPriorityActive = hasPenInput && isMobile
      const isTouchEvent = event.pointerType === 'touch'
      const isPenEvent = event.pointerType === 'pen'

      if (penPriorityActive && !isTouchEvent && !isPenEvent) {
        return
      }

      canvas.setPointerCapture(event.pointerId)

      pointerCacheRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      })

      if (pointerCacheRef.current.size >= 2 && isTouchEvent) {
        const points = Array.from(pointerCacheRef.current.values())
        const distance = distanceBetween(
          { x: points[0]?.x ?? 0, y: points[0]?.y ?? 0 },
          { x: points[1]?.x ?? 0, y: points[1]?.y ?? 0 },
        )
        const midpoint = {
          x: (points[0]?.x ?? 0 + (points[1]?.x ?? 0)) / 2,
          y: (points[0]?.y ?? 0 + (points[1]?.y ?? 0)) / 2,
        }
        pinchStateRef.current = {
          initialDistance: distance,
          initialScale: viewport.scale,
          initialOffsetX: viewport.offsetX,
          initialOffsetY: viewport.offsetY,
          initialMidpoint: midpoint,
        }
        return
      }

      if (penPriorityActive && isTouchEvent) {
        return
      }

      const point = toCanvasPoint(event.clientX, event.clientY)
      if (!point) return

      if (tool === 'selector') {
        selectorToolRef.current?.handlePointerDown(point)
        return
      }

      if (tool === 'eraser') {
        setSelection(null)
        setSelectionPath([])
        removedStrokeIdsRef.current.clear()
        eraserActiveRef.current = true
        if (eraserIndicatorTimeoutRef.current) {
          window.clearTimeout(eraserIndicatorTimeoutRef.current)
          eraserIndicatorTimeoutRef.current = null
        }
        setEraserIndicator({
          point,
          isActive: true,
          pulseKey: Date.now(),
        })
        eraserToolRef.current?.handlePointerDown(point, strokes, viewport.scale)
        return
      }

      if (tool === 'pen') {
        penToolRef.current?.handlePointerDown(point)
        return
      }

      if (tool === 'highlighter') {
        highlighterToolRef.current?.handlePointerDown(point)
        return
      }
    },
    [
      canvasRef,
      eraserActiveRef,
      eraserIndicatorTimeoutRef,
      eraserToolRef,
      hasPenInput,
      highlighterToolRef,
      isMobile,
      penToolRef,
      removedStrokeIdsRef,
      selectorToolRef,
      setEraserIndicator,
      setSelection,
      setSelectionPath,
      strokes,
      toCanvasPoint,
      tool,
      viewport.scale,
    ],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const penPriorityActive = hasPenInput && isMobile
      const isTouchEvent = event.pointerType === 'touch'
      const isPenEvent = event.pointerType === 'pen'

      if (penPriorityActive && !isTouchEvent && !isPenEvent) {
        return
      }

      if (pointerCacheRef.current.has(event.pointerId)) {
        pointerCacheRef.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        })
      }

      if (pointerCacheRef.current.size >= 2 && isTouchEvent) {
        const points = Array.from(pointerCacheRef.current.values())
        if (points.length < 2) return

        const distance = distanceBetween(
          { x: points[0]?.x ?? 0, y: points[0]?.y ?? 0 },
          { x: points[1]?.x ?? 0, y: points[1]?.y ?? 0 },
        )
        const midpoint = {
          x: (points[0]?.x ?? 0 + (points[1]?.x ?? 0)) / 2,
          y: (points[0]?.y ?? 0 + (points[1]?.y ?? 0)) / 2,
        }
        const pinchState = pinchStateRef.current
        if (!pinchState) return

        const scaleDelta = distance / (pinchState.initialDistance || Number.EPSILON)
        const nextScale = clamp(
          pinchState.initialScale * scaleDelta,
          MIN_SCALE,
          MAX_SCALE,
        )

        const deltaMidpointX = midpoint.x - pinchState.initialMidpoint.x
        const deltaMidpointY = midpoint.y - pinchState.initialMidpoint.y

        setViewport(() => {
          if (nextScale <= 1) {
            return { scale: nextScale, offsetX: 0, offsetY: 0 }
          }
          return {
            scale: nextScale,
            offsetX: pinchState.initialOffsetX + deltaMidpointX,
            offsetY: pinchState.initialOffsetY + deltaMidpointY,
          }
        })
        return
      }

      if (penPriorityActive && isTouchEvent) {
        return
      }

      const point = toCanvasPoint(event.clientX, event.clientY)
      if (!point) return

      if (tool === 'selector') {
        selectorToolRef.current?.handlePointerMove(point)
        return
      }

      if (tool === 'eraser') {
        eraserToolRef.current?.handlePointerMove(point, strokes, viewport.scale)
        if (eraserActiveRef.current) {
          setEraserIndicator((prev) =>
            prev
              ? { ...prev, point }
              : {
                  point,
                  isActive: true,
                  pulseKey: Date.now(),
                },
          )
        }
        return
      }

      if (tool === 'pen') {
        penToolRef.current?.handlePointerMove(point)
        return
      }

      if (tool === 'highlighter') {
        highlighterToolRef.current?.handlePointerMove(point)
        return
      }
    },
    [
      canvasRef,
      eraserActiveRef,
      eraserToolRef,
      hasPenInput,
      highlighterToolRef,
      isMobile,
      MAX_SCALE,
      MIN_SCALE,
      penToolRef,
      selectorToolRef,
      setEraserIndicator,
      setViewport,
      strokes,
      toCanvasPoint,
      tool,
      viewport.scale,
    ],
  )

  const handlePointerUp = useCallback(
    (event: PointerEvent) => {
      const penPriorityActive = hasPenInput && isMobile
      const isTouchEvent = event.pointerType === 'touch'
      const isPenEvent = event.pointerType === 'pen'

      if (penPriorityActive && !isTouchEvent && !isPenEvent) {
        return
      }

      releasePointer(event.pointerId)
      pointerCacheRef.current.delete(event.pointerId)
      if (pointerCacheRef.current.size < 2) {
        pinchStateRef.current = null
      }

      if (penPriorityActive && isTouchEvent) {
        return
      }

      if (tool === 'selector') {
        selectorToolRef.current?.handlePointerUp(strokes)
        return
      }

      if (tool === 'eraser') {
        eraserToolRef.current?.handlePointerUp()
        eraserActiveRef.current = false
        setEraserIndicator((prev) =>
          prev
            ? {
                ...prev,
                isActive: false,
              }
            : null,
        )
        if (eraserIndicatorTimeoutRef.current) {
          window.clearTimeout(eraserIndicatorTimeoutRef.current)
        }
        eraserIndicatorTimeoutRef.current = window.setTimeout(() => {
          setEraserIndicator(null)
          eraserIndicatorTimeoutRef.current = null
        }, 180)
        removedStrokeIdsRef.current.clear()
        return
      }

      if (tool === 'pen') {
        penToolRef.current?.handlePointerUp()
        return
      }

      if (tool === 'highlighter') {
        highlighterToolRef.current?.handlePointerUp()
        return
      }
    },
    [
      eraserActiveRef,
      eraserIndicatorTimeoutRef,
      eraserToolRef,
      hasPenInput,
      highlighterToolRef,
      isMobile,
      penToolRef,
      releasePointer,
      removedStrokeIdsRef,
      selectorToolRef,
      setEraserIndicator,
      strokes,
      tool,
    ],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerUp)
    canvas.addEventListener('pointerleave', handlePointerUp)

    canvas.style.touchAction = 'none'

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerUp)
    }
  }, [canvasRef, handlePointerDown, handlePointerMove, handlePointerUp])
}
