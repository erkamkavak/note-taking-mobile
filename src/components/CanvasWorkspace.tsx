import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { Note, Stroke, StrokePoint, StrokeTool } from '../types/note'
import { translateStroke, cloneStrokes } from '../utils/canvasDrawing'
import { clamp, distanceBetween } from '../utils/canvasGeometry'
import { PenTool, HighlighterTool, EraserTool, SelectorTool } from '../tools'
import type { SelectionState } from '../tools'
import Toolbar from './Toolbar'
import { useCanvasRenderer } from '../hooks/useCanvasRenderer'

type ToolType = StrokeTool | 'selector'

type CanvasWorkspaceProps = {
  activeNote: Note | null
  onSave: (payload: {
    dataUrl: string
    thumbnailUrl: string
    strokes: Note['strokes']
  }) => void
  onUpdate?: (payload: {
    dataUrl: string
    thumbnailUrl: string
    strokes: Note['strokes']
  }) => void
  onBackToGallery: () => void
}

type Viewport = {
  scale: number
  offsetX: number
  offsetY: number
}

const PEN_COLORS = ['#1C1C1E', '#007AFF', '#34C759', '#FF8C00', '#FF2D55']
const HIGHLIGHTER_COLORS = ['#FFF6A1', '#CDE6FF', '#FFE5B9', '#FDD7FF']
const SELECTION_COLORS = Array.from(new Set([...PEN_COLORS, ...HIGHLIGHTER_COLORS]))

const DEFAULTS = {
  tool: 'pen' as ToolType,
  pen: { color: '#1C1C1E', size: 4 },
  highlighter: { color: '#FFF6A1', size: 18, opacity: 0.32 },
  eraser: { size: 26 },
}

const MIN_SCALE = 0.6
const MAX_SCALE = 3.5
const ERASER_FADE_DURATION = 180
const DEBUG_PANEL_ENABLED = false

const midpointBetween = (a: StrokePoint, b: StrokePoint): StrokePoint => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
})

const CanvasWorkspace = ({
  activeNote,
  onSave,
  onUpdate,
  onBackToGallery,
}: CanvasWorkspaceProps) => {
  const historyRef = useRef<Stroke[][]>([])
  const futureRef = useRef<Stroke[][]>([])
  const strokesRef = useRef<Stroke[]>([])
  const loadedNoteIdRef = useRef<string | null>(null)
  const pointerCacheRef = useRef<Map<number, StrokePoint>>(new Map())
  const pinchStateRef = useRef<{
    initialDistance: number
    initialScale: number
    focus: StrokePoint
  } | null>(null)
  const removedStrokeIdsRef = useRef<Set<string>>(new Set())
  const fadeTimeoutsRef = useRef<Record<string, number>>({})
  const eraserIndicatorTimeoutRef = useRef<number | null>(null)
  const eraserActiveRef = useRef(false)

  // Detect mobile device and pen availability
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    )
  }, [])

  // Detect if stylus/pen is available
  const hasPenInput = useMemo(() => {
    if (typeof window === 'undefined') return false
    // Check for stylus support using Pointer Events
    // Use 'any-pointer: fine' to detect if ANY fine pointer exists (not just primary)
    const hasStylus = window.matchMedia('(any-pointer: fine)').matches
    const hasTouch = navigator.maxTouchPoints > 0
    return hasStylus && hasTouch
  }, [])

  // Debug information
  const debugInfo = useMemo(() => {
    if (!DEBUG_PANEL_ENABLED || typeof window === 'undefined') return null
    
    return {
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      pointerFine: window.matchMedia('(pointer: fine)').matches,
      pointerCoarse: window.matchMedia('(pointer: coarse)').matches,
      pointerNone: window.matchMedia('(pointer: none)').matches,
      hasAnyPointer: window.matchMedia('(any-pointer: fine)').matches,
      hasCoarsePointer: window.matchMedia('(any-pointer: coarse)').matches,
      platform: navigator.platform,
      vendor: navigator.vendor,
    }
  }, [])

  // Track recent pointer events for debugging
  const [recentPointerEvents, setRecentPointerEvents] = useState<Array<{type: string, pointerType: string, time: number}>>([])
  
  useEffect(() => {
    if (!DEBUG_PANEL_ENABLED) return

    const logPointerEvent = (eventType: string, pointerType: string) => {
      setRecentPointerEvents(prev => {
        const newEvent = { type: eventType, pointerType, time: Date.now() }
        const updated = [newEvent, ...prev].slice(0, 10)
        return updated
      })
    }

    const handlePointerDownDebug = (e: PointerEvent) => {
      logPointerEvent('down', e.pointerType)
    }
    const handlePointerMoveDebug = (e: PointerEvent) => {
      // Throttle move events
      if (Math.random() < 0.1) logPointerEvent('move', e.pointerType)
    }
    const handlePointerUpDebug = (e: PointerEvent) => {
      logPointerEvent('up', e.pointerType)
    }

    window.addEventListener('pointerdown', handlePointerDownDebug)
    window.addEventListener('pointermove', handlePointerMoveDebug)
    window.addEventListener('pointerup', handlePointerUpDebug)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDownDebug)
      window.removeEventListener('pointermove', handlePointerMoveDebug)
      window.removeEventListener('pointerup', handlePointerUpDebug)
    }
  }, [])

  // Tool instances
  const penToolRef = useRef<PenTool | null>(null)
  const highlighterToolRef = useRef<HighlighterTool | null>(null)
  const eraserToolRef = useRef<EraserTool | null>(null)
  const selectorToolRef = useRef<SelectorTool | null>(null)

  const [tool, setTool] = useState<ToolType>(DEFAULTS.tool)
  const [penColor, setPenColor] = useState(DEFAULTS.pen.color)
  const [penSize, setPenSize] = useState(DEFAULTS.pen.size)
  const [highlighterColor, setHighlighterColor] = useState(
    DEFAULTS.highlighter.color,
  )
  const [highlighterSize, setHighlighterSize] = useState(
    DEFAULTS.highlighter.size,
  )
  const [highlighterOpacity, setHighlighterOpacity] = useState(
    DEFAULTS.highlighter.opacity,
  )
  const [eraserSize, setEraserSize] = useState(DEFAULTS.eraser.size)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [viewport, setViewport] = useState<Viewport>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  })
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [selectionPath, setSelectionPath] = useState<StrokePoint[]>([])
  const [eraserPreview, setEraserPreview] = useState<{
    point: StrokePoint
    strokeIds: string[]
  } | null>(null)
  const [fadingStrokes, setFadingStrokes] = useState<Record<string, boolean>>({})
  const [eraserIndicator, setEraserIndicator] = useState<{
    point: StrokePoint
    isActive: boolean
    pulseKey: number
  } | null>(null)

  const {
    canvasRef,
    containerRef,
    backgroundImageRef,
    canvasSizeRef,
    drawStroke,
    forceRender,
  } = useCanvasRenderer({
    viewport,
    strokes,
    currentStroke,
    selection,
    selectionPath,
    eraserPreview,
    fadingStrokes,
  })

  useEffect(() => {
    strokesRef.current = strokes
  }, [strokes])

  useEffect(() => {
    return () => {
      Object.values(fadeTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
      if (eraserIndicatorTimeoutRef.current) {
        window.clearTimeout(eraserIndicatorTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const currentIds = new Set(strokes.map((stroke) => stroke.id))
    setFadingStrokes((prev) => {
      const next = { ...prev }
      let changed = false
      Object.keys(next).forEach((id) => {
        if (!currentIds.has(id)) {
          changed = true
          delete next[id]
          if (fadeTimeoutsRef.current[id]) {
            window.clearTimeout(fadeTimeoutsRef.current[id])
            delete fadeTimeoutsRef.current[id]
          }
        }
      })
      return changed ? next : prev
    })
  }, [strokes])

  const currentNoteTitle = useMemo(() => {
    if (activeNote) return activeNote.title
    const now = new Date()
    return `New Note – ${now.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })}`
  }, [activeNote])

  const resetHistory = useCallback((initial: Stroke[]) => {
    historyRef.current = []
    futureRef.current = []
    removedStrokeIdsRef.current.clear()
    setStrokes(cloneStrokes(initial))
    setCurrentStroke(null)
    setSelection(null)
    setSelectionPath([])
  }, [])

  const pushHistorySnapshot = useCallback(() => {
    historyRef.current.push(cloneStrokes(strokesRef.current))
  }, [])

  const scheduleStrokeRemoval = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    setFadingStrokes((prev) => {
      let mutated = false
      const next = { ...prev }
      ids.forEach((id) => {
        if (next[id]) return
        mutated = true
        next[id] = true
        if (!fadeTimeoutsRef.current[id]) {
          fadeTimeoutsRef.current[id] = window.setTimeout(() => {
            setStrokes((current) => current.filter((stroke) => stroke.id !== id))
            setFadingStrokes((current) => {
              if (!current[id]) return current
              const copy = { ...current }
              delete copy[id]
              return copy
            })
            delete fadeTimeoutsRef.current[id]
          }, ERASER_FADE_DURATION)
        }
      })
      return mutated ? next : prev
    })
  }, [])

  const handleEraserErase = useCallback(
    (removedIds: string[]) => {
      if (removedIds.length === 0) return
      const erasingSession = removedStrokeIdsRef.current
      const newIds = removedIds.filter((id) => !erasingSession.has(id))
      if (newIds.length === 0) return
      if (erasingSession.size === 0) {
        pushHistorySnapshot()
        futureRef.current = []
      }
      newIds.forEach((id) => erasingSession.add(id))
      scheduleStrokeRemoval(newIds)
    },
    [pushHistorySnapshot, scheduleStrokeRemoval],
  )

  const handleStrokeUpdate = useCallback((stroke: Stroke) => {
    setCurrentStroke(stroke)
  }, [])

  const commitStroke = useCallback(
    (stroke: Stroke) => {
      pushHistorySnapshot()
      futureRef.current = []
      setStrokes((prev) => [...prev, stroke])
      setCurrentStroke(null)
    },
    [pushHistorySnapshot],
  )

  // Initialize tool instances
  useEffect(() => {
    if (!penToolRef.current) {
      penToolRef.current = new PenTool(
        { color: penColor, size: penSize },
        () => {},
        (stroke) => handleStrokeUpdate(stroke),
        (stroke) => commitStroke(stroke),
      )
    }
    if (!highlighterToolRef.current) {
      highlighterToolRef.current = new HighlighterTool(
        {
          color: highlighterColor,
          size: highlighterSize,
          opacity: highlighterOpacity,
        },
        () => {},
        (stroke) => handleStrokeUpdate(stroke),
        (stroke) => commitStroke(stroke),
      )
    }
    if (!eraserToolRef.current) {
      eraserToolRef.current = new EraserTool(
        eraserSize,
        (removedIds) => handleEraserErase(removedIds),
        (preview) => setEraserPreview(preview)
      )
    }
    if (!selectorToolRef.current) {
      selectorToolRef.current = new SelectorTool(
        (sel) => setSelection(sel),
        (path) => setSelectionPath(path),
        (strokeIds, delta) => {
          pushHistorySnapshot()
          futureRef.current = []
          setStrokes((prev) =>
            prev.map((stroke) =>
              strokeIds.includes(stroke.id)
                ? translateStroke(stroke, delta)
                : stroke
            )
          )
        }
      )
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update tool settings when they change
  useEffect(() => {
    penToolRef.current?.updateSettings({ color: penColor, size: penSize })
  }, [penColor, penSize])

  useEffect(() => {
    highlighterToolRef.current?.updateSettings({
      color: highlighterColor,
      size: highlighterSize,
      opacity: highlighterOpacity,
    })
  }, [highlighterColor, highlighterSize, highlighterOpacity])

  useEffect(() => {
    eraserToolRef.current?.updateSize(eraserSize)
  }, [eraserSize])

  useEffect(() => {
    if (!activeNote) {
      loadedNoteIdRef.current = null
      backgroundImageRef.current = null
      resetHistory([])
      setViewport({ scale: 1, offsetX: 0, offsetY: 0 })
      return
    }

    if (loadedNoteIdRef.current === activeNote.id) {
      return
    }

    loadedNoteIdRef.current = activeNote.id

    const noteStrokes = activeNote.strokes ? cloneStrokes(activeNote.strokes) : []
    resetHistory(noteStrokes)
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 })

    if (!activeNote.strokes || activeNote.strokes.length === 0) {
      if (activeNote.dataUrl) {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          backgroundImageRef.current = img
          forceRender()
        }
        img.src = activeNote.dataUrl
      }
    } else {
      backgroundImageRef.current = null
    }
  }, [activeNote, forceRender, resetHistory])

  const handleUndo = useCallback(() => {
    setStrokes((current) => {
      if (historyRef.current.length === 0) return current
      const previous = historyRef.current.pop()
      if (!previous) return current
      futureRef.current.push(cloneStrokes(current))
      const cloned = cloneStrokes(previous)
      return cloned
    })
    setSelection(null)
    setSelectionPath([])
    setCurrentStroke(null)
  }, [])

  const handleRedo = useCallback(() => {
    setStrokes((current) => {
      if (futureRef.current.length === 0) return current
      const next = futureRef.current.pop()
      if (!next) return current
      historyRef.current.push(cloneStrokes(current))
      return cloneStrokes(next)
    })
    setSelection(null)
    setSelectionPath([])
    setCurrentStroke(null)
  }, [])

  const canUndo = historyRef.current.length > 0
  const canRedo = futureRef.current.length > 0

  const toCanvasPoint = useCallback(
    (clientX: number, clientY: number): StrokePoint | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      // Account for the container scale in coordinate conversion
      const x = (clientX - rect.left - viewport.offsetX) / viewport.scale
      const y = (clientY - rect.top - viewport.offsetY) / viewport.scale
      return { x, y }
    },
    [viewport.offsetX, viewport.offsetY, viewport.scale],
  )

  const releasePointer = useCallback((pointerId: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (canvas.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId)
    }
  }, [])

  const handlePointerDown = useCallback(
    (event: PointerEvent) => {
      event.preventDefault()
      if (!canvasRef.current) return

      const penPriorityActive = hasPenInput && isMobile
      const isTouchEvent = event.pointerType === 'touch'
      const isPenEvent = event.pointerType === 'pen'

      // Still block mouse/other pointers when pen mode is active
      if (penPriorityActive && !isTouchEvent && !isPenEvent) {
        return
      }
      
      canvasRef.current.setPointerCapture(event.pointerId)

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
        const midpoint = midpointBetween(
          { x: points[0]?.x ?? 0, y: points[0]?.y ?? 0 },
          { x: points[1]?.x ?? 0, y: points[1]?.y ?? 0 },
        )
        const focusPoint = toCanvasPoint(midpoint.x, midpoint.y)
        if (focusPoint) {
          pinchStateRef.current = {
            initialDistance: distance,
            initialScale: viewport.scale,
            focus: focusPoint,
          }
        }
        return
      }

      // When pen input is available we only want touches for pinch gestures
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
      strokes,
      toCanvasPoint,
      tool,
      viewport.scale,
      hasPenInput,
      isMobile,
    ],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!canvasRef.current) return

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
        const midpoint = midpointBetween(
          { x: points[0]?.x ?? 0, y: points[0]?.y ?? 0 },
          { x: points[1]?.x ?? 0, y: points[1]?.y ?? 0 },
        )
        const focusPoint = toCanvasPoint(midpoint.x, midpoint.y)

        const pinchState = pinchStateRef.current
        if (!pinchState || !focusPoint) return

        const scaleDelta =
          distance / (pinchState.initialDistance || Number.EPSILON)
        const nextScale = clamp(
          pinchState.initialScale * scaleDelta,
          MIN_SCALE,
          MAX_SCALE,
        )

        setViewport({
          scale: nextScale,
          offsetX: 0,
          offsetY: 0,
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
      strokes,
      toCanvasPoint,
      tool,
      viewport.scale,
      hasPenInput,
      isMobile,
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
      strokes,
      releasePointer,
      tool,
      hasPenInput,
      isMobile,
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
  }, [handlePointerDown, handlePointerMove, handlePointerUp])

  const createThumbnail = useCallback((canvas: HTMLCanvasElement) => {
    const ratio = window.devicePixelRatio || 1
    const originalWidth = canvas.width / ratio
    const originalHeight = canvas.height / ratio
    const maxDimension = 360
    const scale =
      originalWidth > originalHeight
        ? maxDimension / originalWidth
        : maxDimension / originalHeight
    const targetScale = Math.min(1, scale)
    const targetWidth = Math.max(1, Math.round(originalWidth * targetScale))
    const targetHeight = Math.max(1, Math.round(originalHeight * targetScale))

    const thumbnailCanvas = document.createElement('canvas')
    thumbnailCanvas.width = targetWidth
    thumbnailCanvas.height = targetHeight
    const thumbnailContext = thumbnailCanvas.getContext('2d')
    if (!thumbnailContext) return canvas.toDataURL('image/png')

    thumbnailContext.fillStyle = '#FAFAFA'
    thumbnailContext.fillRect(0, 0, targetWidth, targetHeight)
    thumbnailContext.drawImage(canvas, 0, 0, targetWidth, targetHeight)
    return thumbnailCanvas.toDataURL('image/png')
  }, [])

  const exportCanvas = useCallback(() => {
    const sourceCanvas = canvasRef.current
    if (!sourceCanvas) return null

    const ratio = window.devicePixelRatio || 1
    const { width, height } = canvasSizeRef.current

    const exportCanvasEl = document.createElement('canvas')
    exportCanvasEl.width = width * ratio
    exportCanvasEl.height = height * ratio
    const exportContext = exportCanvasEl.getContext('2d')
    if (!exportContext) return null

    exportContext.setTransform(ratio, 0, 0, ratio, 0, 0)
    exportContext.fillStyle = '#FAFAFA'
    exportContext.fillRect(0, 0, width, height)

    const backgroundImage = backgroundImageRef.current
    if (backgroundImage) {
      exportContext.drawImage(backgroundImage, 0, 0, width, height)
    }

    cloneStrokes(strokes).forEach((stroke) => drawStroke(exportContext, stroke))
    if (currentStroke) {
      drawStroke(exportContext, currentStroke)
    }

    const dataUrl = exportCanvasEl.toDataURL('image/png')
    const thumbnailUrl = createThumbnail(exportCanvasEl)

    return { dataUrl, thumbnailUrl }
  }, [createThumbnail, currentStroke, drawStroke, strokes])

  // Auto-save on changes
  // Optimized for mobile: uses ref to prevent frequent re-renders, longer delay to reduce load
  useEffect(() => {
    if (strokes.length === 0 && !activeNote) return
    if (!onUpdate) return

    const timeoutId = setTimeout(() => {
      const exportResult = exportCanvasRef.current()
      if (!exportResult) return

      onUpdate({
        dataUrl: exportResult.dataUrl,
        thumbnailUrl: exportResult.thumbnailUrl,
        strokes: cloneStrokes(strokesRef.current),
      })
    }, isMobile ? 5000 : 2000) // Longer delay on mobile to reduce load

    return () => clearTimeout(timeoutId)
  }, [strokes.length, activeNote?.id, onUpdate, isMobile])

  const exportCanvasRef = useRef(exportCanvas)
  useEffect(() => {
    exportCanvasRef.current = exportCanvas
  }, [exportCanvas])

  const saveOnUnmountRef = useRef<() => void>(() => {})

  useEffect(() => {
    saveOnUnmountRef.current = () => {
      const exportResult = exportCanvasRef.current()
      if (!exportResult) return
      onSave({
        dataUrl: exportResult.dataUrl,
        thumbnailUrl: exportResult.thumbnailUrl,
        strokes: cloneStrokes(strokesRef.current),
      })
    }
  }, [onSave])

  useEffect(() => {
    return () => {
      saveOnUnmountRef.current()
    }
  }, [])

  const handleToolChange = useCallback((nextTool: ToolType) => {
    setTool(nextTool)
    if (nextTool !== 'selector') {
      setSelection(null)
      setSelectionPath([])
    }
    if (nextTool !== 'eraser') {
      eraserActiveRef.current = false
      if (eraserIndicatorTimeoutRef.current) {
        window.clearTimeout(eraserIndicatorTimeoutRef.current)
        eraserIndicatorTimeoutRef.current = null
      }
      setEraserIndicator(null)
    }
  }, [])

  const handleSelectionColorChange = useCallback(
    (color: string) => {
      if (!selection || selection.strokeIds.length === 0) return
      pushHistorySnapshot()
      futureRef.current = []
      const ids = selection.strokeIds
      setStrokes((prev) =>
        prev.map((stroke) =>
          ids.includes(stroke.id)
            ? {
                ...stroke,
                color,
              }
            : stroke,
        ),
      )
    },
    [pushHistorySnapshot, selection],
  )

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }, [])

  const exportAsPNG = useCallback(() => {
    const exportResult = exportCanvas()
    if (!exportResult) return
    
    const link = document.createElement('a')
    link.href = exportResult.dataUrl
    link.download = `${currentNoteTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`
    link.click()
  }, [exportCanvas, currentNoteTitle])

  const exportAsPDF = useCallback(async () => {
    const exportResult = exportCanvas()
    if (!exportResult) return

    try {
      // Dynamically import jsPDF to avoid bundling issues
      const { jsPDF } = await import('jspdf')
      
      // Create a new PDF with A4 dimensions
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: 'a4'
      })

      // Get the image data
      const imgData = exportResult.dataUrl
      
      // Calculate dimensions to fit the page
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      const img = new Image()
      
      img.onload = () => {
        const imgWidth = img.width
        const imgHeight = img.height
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight, 1)
        const finalWidth = imgWidth * ratio
        const finalHeight = imgHeight * ratio
        const x = (pdfWidth - finalWidth) / 2
        const y = (pdfHeight - finalHeight) / 2
        
        pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight)
        pdf.save(`${currentNoteTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`)
      }
      
      img.src = imgData
    } catch (error) {
      console.error('Failed to export PDF:', error)
      // Fallback to PNG if PDF generation fails
      exportAsPNG()
    }
  }, [exportCanvas, currentNoteTitle, exportAsPNG])

  const createSelectionCanvas = useCallback(
    (strokeIds: string[]) => {
      if (strokeIds.length === 0) return null
      const selectedStrokes = strokes.filter((stroke) => strokeIds.includes(stroke.id))
      if (selectedStrokes.length === 0) return null

      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      selectedStrokes.forEach((stroke) => {
        stroke.points.forEach((point) => {
          minX = Math.min(minX, point.x)
          minY = Math.min(minY, point.y)
          maxX = Math.max(maxX, point.x)
          maxY = Math.max(maxY, point.y)
        })
      })

      if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        return null
      }

      const padding = 12
      const width = Math.max(1, maxX - minX + padding * 2)
      const height = Math.max(1, maxY - minY + padding * 2)
      const ratio = window.devicePixelRatio || 1
      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = width * ratio
      exportCanvas.height = height * ratio
      const ctx = exportCanvas.getContext('2d')
      if (!ctx) return null
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.translate(-minX + padding, -minY + padding)
      selectedStrokes.forEach((stroke) => {
        drawStroke(ctx, stroke)
      })
      return exportCanvas
    },
    [drawStroke, strokes],
  )

  const selectionToBlob = useCallback(
    async (strokeIds: string[]) => {
      const canvas = createSelectionCanvas(strokeIds)
      if (!canvas) return null
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png')
      })
    },
    [createSelectionCanvas],
  )

  const copySelectionAsImage = useCallback(async () => {
    if (!selection) return
    const blob = await selectionToBlob(selection.strokeIds)
    if (!blob) return
    const clipboard = navigator.clipboard
    const ClipboardItemCtor =
      typeof window !== 'undefined'
        ? (window as Window &
            typeof globalThis & { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
        : undefined
    if (clipboard && ClipboardItemCtor && 'write' in clipboard) {
      try {
        const item = new ClipboardItemCtor({ [blob.type]: blob })
        await clipboard.write([item])
        return
      } catch (_) {
        // fall back to download
      }
    }
    downloadBlob(blob, 'selection.png')
  }, [downloadBlob, selection, selectionToBlob])

  const shareSelectionAsImage = useCallback(async () => {
    if (!selection) return
    const blob = await selectionToBlob(selection.strokeIds)
    if (!blob) return
    if (navigator.share) {
      try {
        const file = new File([blob], 'selection.png', { type: 'image/png' })
        const canShareFiles = typeof navigator.canShare === 'function'
          ? navigator.canShare({ files: [file] })
          : true
        if (canShareFiles) {
          await navigator.share({
            files: [file],
            title: 'Canvas Selection',
            text: 'Shared from Note Canvas',
          })
          return
        }
      } catch (_) {
        // fall through to download
      }
    }
    downloadBlob(blob, 'selection.png')
  }, [downloadBlob, selection, selectionToBlob])

  const zoomIn = useCallback(() => {
    setViewport((prev) => {
      const newScale = clamp(prev.scale * 1.2, MIN_SCALE, MAX_SCALE)
      return {
        scale: newScale,
        offsetX: 0,
        offsetY: 0,
      }
    })
  }, [])

  const zoomOut = useCallback(() => {
    setViewport((prev) => {
      const newScale = clamp(prev.scale / 1.2, MIN_SCALE, MAX_SCALE)
      return {
        scale: newScale,
        offsetX: 0,
        offsetY: 0,
      }
    })
  }, [])

  const resetZoom = useCallback(() => {
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 })
  }, [])

  const toolbarPenColors = useMemo(
    () => ({
      pen: PEN_COLORS,
      highlighter: HIGHLIGHTER_COLORS,
    }),
    [],
  )

  const eraserIndicatorPosition = useMemo(() => {
    if (!eraserIndicator) return null
    return {
      x: eraserIndicator.point.x + viewport.offsetX,
      y: eraserIndicator.point.y + viewport.offsetY,
    }
  }, [eraserIndicator, viewport.offsetX, viewport.offsetY])

  const selectionActionPosition = useMemo(() => {
    if (!selection) return null
    const { minX, maxX, minY } = selection.boundingBox
    const centerX = (minX + maxX) / 2
    return {
      x: centerX + viewport.offsetX,
      y: minY + viewport.offsetY,
    }
  }, [selection, viewport])

  const selectionActiveColor = useMemo(() => {
    if (!selection) return null
    const ids = new Set(selection.strokeIds)
    const selected = strokes.filter((stroke) => ids.has(stroke.id))
    if (selected.length === 0) return null
    const firstColor = selected[0]?.color
    const isUniform = selected.every((stroke) => stroke.color === firstColor)
    return isUniform ? firstColor : null
  }, [selection, strokes])

  return (
    <div className="canvas-screen">
      <div className="toolbar-wrapper">
        <Toolbar
          currentNoteTitle={currentNoteTitle}
          tool={tool}
          onToolChange={handleToolChange}
          penColor={penColor}
          onPenColorChange={setPenColor}
          penSize={penSize}
          onPenSizeChange={setPenSize}
          highlighterColor={highlighterColor}
          onHighlighterColorChange={setHighlighterColor}
          highlighterSize={highlighterSize}
          onHighlighterSizeChange={setHighlighterSize}
          highlighterOpacity={highlighterOpacity}
          onHighlighterOpacityChange={setHighlighterOpacity}
          eraserSize={eraserSize}
          onEraserSizeChange={setEraserSize}
          availableColors={toolbarPenColors}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          zoom={viewport.scale}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={resetZoom}
          onBack={onBackToGallery}
          onExportPNG={exportAsPNG}
          onExportPDF={exportAsPDF}
          hasPenInput={hasPenInput && isMobile}
        />
      </div>
      <div 
        className="canvas-container" 
        ref={containerRef}
        style={{
          transform: `scale(${viewport.scale})`,
          transformOrigin: 'center',
          transition: 'transform 0.2s ease-out',
          touchAction: hasPenInput && isMobile ? 'none' : 'none' // Always prevent default on mobile
        }}
      >
        <canvas 
          ref={canvasRef} 
          style={{
            touchAction: hasPenInput && isMobile ? 'none' : 'none'
          }}
        />
        {selection &&
          selection.strokeIds.length > 0 &&
          selectionActionPosition && (
            <div
              className="selection-actions"
              style={{
                left: `${selectionActionPosition.x}px`,
                top: `${selectionActionPosition.y}px`,
              }}
            >
              <div className="selection-actions__label">Selection</div>
              <div className="selection-actions__colors">
                {SELECTION_COLORS.map((color) => (
                  <button
                    type="button"
                    key={`selection-color-${color}`}
                    className={`selection-color${
                      selectionActiveColor === color ? ' active' : ''
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => handleSelectionColorChange(color)}
                    aria-label={`Change selection color to ${color}`}
                  />
                ))}
              </div>
              <div className="selection-actions__buttons">
                <button type="button" onClick={copySelectionAsImage}>
                  Copy PNG
                </button>
                <button type="button" onClick={shareSelectionAsImage}>
                  Share
                </button>
              </div>
            </div>
          )}
        {eraserIndicator && eraserIndicatorPosition && (
          <div
            key={eraserIndicator.pulseKey}
            className={`eraser-indicator${eraserIndicator.isActive ? ' is-active' : ''}`}
            style={{
              width: `${eraserSize * viewport.scale}px`,
              height: `${eraserSize * viewport.scale}px`,
              left: `${eraserIndicatorPosition.x - (eraserSize * viewport.scale) / 2}px`,
              top: `${eraserIndicatorPosition.y - (eraserSize * viewport.scale) / 2}px`,
            }}
          />
        )}
      </div>

      {/* Debug Panel */}
      {DEBUG_PANEL_ENABLED && debugInfo && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          color: '#00ff00',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '11px',
          fontFamily: 'monospace',
          maxWidth: '320px',
          maxHeight: '400px',
          overflow: 'auto',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{fontWeight: 'bold', marginBottom: '8px', color: '#00ffff'}}>
            🔍 INPUT DEBUG PANEL
          </div>
          <div style={{marginBottom: '8px'}}>
            <div><strong>hasPenInput:</strong> <span style={{color: hasPenInput ? '#00ff00' : '#ff0000'}}>{hasPenInput.toString()}</span></div>
            <div><strong>isMobile:</strong> <span style={{color: isMobile ? '#00ff00' : '#ff0000'}}>{isMobile.toString()}</span></div>
            <div><strong>maxTouchPoints:</strong> {debugInfo.maxTouchPoints}</div>
          </div>
          <div style={{marginBottom: '8px', paddingTop: '8px', borderTop: '1px solid #333'}}>
            <div><strong>pointer: fine</strong> = <span style={{color: debugInfo.pointerFine ? '#00ff00' : '#ff0000'}}>{debugInfo.pointerFine.toString()}</span></div>
            <div><strong>pointer: coarse</strong> = <span style={{color: debugInfo.pointerCoarse ? '#00ff00' : '#ff0000'}}>{debugInfo.pointerCoarse.toString()}</span></div>
            <div><strong>pointer: none</strong> = <span style={{color: debugInfo.pointerNone ? '#00ff00' : '#ff0000'}}>{debugInfo.pointerNone.toString()}</span></div>
            <div><strong>any-pointer: fine</strong> = <span style={{color: debugInfo.hasAnyPointer ? '#00ff00' : '#ff0000'}}>{debugInfo.hasAnyPointer.toString()}</span></div>
            <div><strong>any-pointer: coarse</strong> = <span style={{color: debugInfo.hasCoarsePointer ? '#00ff00' : '#ff0000'}}>{debugInfo.hasCoarsePointer.toString()}</span></div>
          </div>
          <div style={{marginBottom: '8px', paddingTop: '8px', borderTop: '1px solid #333', fontSize: '10px'}}>
            <div><strong>Platform:</strong> {debugInfo.platform}</div>
            <div><strong>Vendor:</strong> {debugInfo.vendor}</div>
          </div>
          <div style={{paddingTop: '8px', borderTop: '1px solid #333'}}>
            <div style={{fontWeight: 'bold', marginBottom: '4px', color: '#ffff00'}}>Recent Pointer Events:</div>
            {recentPointerEvents.length === 0 ? (
              <div style={{color: '#666'}}>No events yet</div>
            ) : (
              recentPointerEvents.map((event, idx) => (
                <div key={idx} style={{marginBottom: '2px'}}>
                  <span style={{color: '#888'}}>{new Date(event.time).toLocaleTimeString()}</span>
                  {' - '}
                  <span style={{color: '#fff'}}>{event.type}</span>
                  {' ['}
                  <span style={{color: event.pointerType === 'pen' ? '#00ff00' : event.pointerType === 'touch' ? '#ff9900' : '#00ffff'}}>
                    {event.pointerType}
                  </span>
                  {']'}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default CanvasWorkspace
