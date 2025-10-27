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
  gestureType: 'zoom' | 'pan' | null
  initialPinchDistance?: number
  panStartOffset?: { x: number; y: number }
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
  // Minimum distance between fingers to register a pinch gesture (prevents accidental zoom)
  const MIN_FINGER_DISTANCE = 100

  const pointerCacheRef = useRef<Map<number, PointerCacheEntry>>(new Map())
  const pinchStateRef = useRef<PinchState | null>(null)
  const middlePanRef = useRef<
    | {
        pointerId: number
        startX: number
        startY: number
        initialOffsetX: number
        initialOffsetY: number
      }
    | null
  >(null)

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

      if (event.pointerType === 'mouse' && event.button === 1) {
        canvas.setPointerCapture(event.pointerId)
        middlePanRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          initialOffsetX: viewport.offsetX,
          initialOffsetY: viewport.offsetY,
        }
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

        // Ignore pinch gestures if fingers are too close (prevents accidental zoom)
        if (distance < MIN_FINGER_DISTANCE) {
          return
        }

        const midpoint = {
          x: (points[0]?.x ?? 0 + (points[1]?.x ?? 0)) / 2,
          y: (points[0]?.y ?? 0 + (points[1]?.y ?? 0)) / 2,
        }

        if (rafRequestRef.current !== null) {
          cancelAnimationFrame(rafRequestRef.current)
          rafRequestRef.current = null
        }

        pinchStateRef.current = {
          initialDistance: distance,
          initialScale: viewport.scale,
          initialOffsetX: viewport.offsetX,
          initialOffsetY: viewport.offsetY,
          initialMidpoint: midpoint,
          gestureType: null,
          initialPinchDistance: distance,
          panStartOffset: { x: viewport.offsetX, y: viewport.offsetY },
        }

        lastUpdateTimeRef.current = Date.now()
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
      viewport.offsetX,
      viewport.offsetY,
      viewport.scale,
    ],
  )

  const rafRequestRef = useRef<number | null>(null)
  const lastUpdateTimeRef = useRef<number>(0)
  const lastPointerUpdateRef = useRef<Map<number, PointerCacheEntry>>(new Map())

  const updateViewportRaf = useCallback((updateFn: () => void) => {
    if (rafRequestRef.current !== null) {
      return
    }

    rafRequestRef.current = requestAnimationFrame(() => {
      updateFn()
      rafRequestRef.current = null
    })
  }, [])

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

      if (middlePanRef.current && middlePanRef.current.pointerId === event.pointerId) {
        const { startX, startY, initialOffsetX, initialOffsetY } = middlePanRef.current
        const deltaX = event.clientX - startX
        const deltaY = event.clientY - startY
        updateViewportRaf(() => {
          setViewport((prev) => ({
            ...prev,
            offsetX: initialOffsetX + deltaX,
            offsetY: initialOffsetY + deltaY,
          }))
        })
        return
      }

      const currentEntry = pointerCacheRef.current.get(event.pointerId)
      const newEntry = {
        x: event.clientX,
        y: event.clientY,
      }

      pointerCacheRef.current.set(event.pointerId, newEntry)
      lastPointerUpdateRef.current.set(event.pointerId, newEntry)

      const now = Date.now()
      if (isTouchEvent) {
        const timeSinceLastUpdate = now - lastUpdateTimeRef.current
        const hasSignificantMovement =
          !currentEntry ||
          Math.abs(currentEntry.x - newEntry.x) > 1 ||
          Math.abs(currentEntry.y - newEntry.y) > 1

        if (!hasSignificantMovement && timeSinceLastUpdate < 8) {
          return
        }
      }

      lastUpdateTimeRef.current = now

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
        if (!pinchState || !pinchState.initialPinchDistance || !pinchState.panStartOffset) return

        const pinchDelta = distance - pinchState.initialPinchDistance
        const deltaMidpointX = midpoint.x - pinchState.initialMidpoint.x
        const deltaMidpointY = midpoint.y - pinchState.initialMidpoint.y
        const distanceDelta = Math.sqrt(deltaMidpointX * deltaMidpointX + deltaMidpointY * deltaMidpointY)

        const ZOOM_THRESHOLD = 12
        const PAN_THRESHOLD = 8
        const DEADZONE = 5

        if (!pinchState.gestureType) {
          // Prevent zoom if fingers are currently too close together
          if (Math.abs(pinchDelta) > ZOOM_THRESHOLD && distance >= MIN_FINGER_DISTANCE) {
            pinchState.gestureType = 'zoom'
          } else if (distanceDelta > PAN_THRESHOLD) {
            pinchState.gestureType = 'pan'
          } else {
            return
          }
        }

        updateViewportRaf(() => {
          setViewport((prev) => {
            if (pinchState.gestureType === 'zoom') {
              const scaleDelta = distance / (pinchState.initialDistance || Number.EPSILON)
              let nextScale = clamp(
                pinchState.initialScale * scaleDelta,
                MIN_SCALE,
                MAX_SCALE,
              )

              const nearBoundary = nextScale <= 1.05 && prev.scale <= 1.05

              if (nearBoundary) {
                const scale = Math.max(1, nextScale)
                return {
                  scale,
                  offsetX: 0,
                  offsetY: 0,
                }
              }

              // Keep the pinch midpoint anchored under the fingers
              const canvas = canvasRef.current
              if (!canvas) return prev

              const rect = canvas.getBoundingClientRect()
              const clientMidX = midpoint.x - rect.left
              const clientMidY = midpoint.y - rect.top

              // Canvas-space point under the midpoint BEFORE scaling
              const midCanvasX = (clientMidX - pinchState.initialOffsetX) / pinchState.initialScale
              const midCanvasY = (clientMidY - pinchState.initialOffsetY) / pinchState.initialScale

              // New offsets so that same canvas point remains at same client midpoint AFTER scaling
              const newOffsetX = clientMidX - midCanvasX * nextScale
              const newOffsetY = clientMidY - midCanvasY * nextScale

              return {
                scale: nextScale,
                offsetX: newOffsetX,
                offsetY: newOffsetY,
              }
            } else if (pinchState.gestureType === 'pan') {
              const nextOffsetX = pinchState.panStartOffset!.x + deltaMidpointX
              const nextOffsetY = pinchState.panStartOffset!.y + deltaMidpointY

              if (Math.abs(deltaMidpointX) < DEADZONE && Math.abs(deltaMidpointY) < DEADZONE) {
                return prev
              }

              if (prev.scale <= 1.05) {
                const magnitude = Math.sqrt(deltaMidpointX * deltaMidpointX + deltaMidpointY * deltaMidpointY)
                if (magnitude < 20) {
                  return prev
                }
              }

              return {
                scale: prev.scale,
                offsetX: nextOffsetX,
                offsetY: nextOffsetY,
              }
            }

            return prev
          })
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
      updateViewportRaf,
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

      if (middlePanRef.current && middlePanRef.current.pointerId === event.pointerId) {
        releasePointer(event.pointerId)
        middlePanRef.current = null
        return
      }

      releasePointer(event.pointerId)
      pointerCacheRef.current.delete(event.pointerId)

      if (pointerCacheRef.current.size < 2) {
        if (rafRequestRef.current !== null) {
          cancelAnimationFrame(rafRequestRef.current)
          rafRequestRef.current = null
        }
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

      if (rafRequestRef.current !== null) {
        cancelAnimationFrame(rafRequestRef.current)
        rafRequestRef.current = null
      }
    }
  }, [canvasRef, handlePointerDown, handlePointerMove, handlePointerUp])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ZOOM_SENSITIVITY = 0.0025

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()

      const point = toCanvasPoint(event.clientX, event.clientY)
      if (!point) return

      const rect = canvas.getBoundingClientRect()

      const zoomFactor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY)

      setViewport((prev) => {
        const nextScale = clamp(prev.scale * zoomFactor, MIN_SCALE, MAX_SCALE)
        if (nextScale === prev.scale) {
          return prev
        }

        if (nextScale <= 1.05 && prev.scale <= 1.05) {
          return { scale: 1, offsetX: 0, offsetY: 0 }
        }

        const baseLeft = rect.left - prev.offsetX
        const baseTop = rect.top - prev.offsetY

        const nextOffsetX = event.clientX - baseLeft - nextScale * point.x
        const nextOffsetY = event.clientY - baseTop - nextScale * point.y

        return {
          scale: nextScale,
          offsetX: nextOffsetX,
          offsetY: nextOffsetY,
        }
      })
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [canvasRef, MAX_SCALE, MIN_SCALE, setViewport, toCanvasPoint])
}
