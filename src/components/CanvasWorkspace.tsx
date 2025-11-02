import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { CSSProperties } from 'react'
import type { Note, Stroke, StrokePoint, StrokeTool, PageSize } from '@/types/note'
import { translateStroke, cloneStrokes } from '@/utils/canvasDrawing'
import { PenTool, HighlighterTool, EraserTool, SelectorTool } from '@/tools'
import type { SelectionState } from '@/tools'
import PageControls from './PageControls'
import Toolbar from './Toolbar'
import Settings from './Settings'
import DebugPanel from './DebugPanel'
import SelectionActions from './SelectionActions'
import EraserIndicator from './EraserIndicator'
import { useCanvasRenderer } from '@/hooks/useCanvasRenderer'
import { usePointerHandlers } from '@/hooks/usePointerHandlers'
import { useCanvasExport } from '@/hooks/useCanvasExport'
import { useViewportZoom } from '@/hooks/useViewportZoom'
import { usePageNavigation } from '@/hooks/usePageNavigation'
import { loadSettings, persistSettings, type Settings as SettingsType } from '@/utils/settingsStorage'

type ToolType = StrokeTool | 'selector'

type CanvasWorkspaceProps = {
  activeNote: Note | null
  onSave: (payload: {
    dataUrl: string
    thumbnailUrl: string
    strokes: Stroke[]
  }) => void
  onUpdate?: (payload: {
    dataUrl: string
    thumbnailUrl: string
    strokes: Stroke[]
    pages?: Note['pages']
    currentPageIndex?: number
  }) => void
  onBackToGallery: () => void
}

type Viewport = {
  scale: number
  offsetX: number
  offsetY: number
}

const PEN_COLORS = ['#1C1C1E', '#007AFF', '#34C759', '#FF8C00', '#FF2D55', '#FFFFFF']
const HIGHLIGHTER_COLORS = ['#FFF6A1', '#CDE6FF', '#FFE5B9', '#FDD7FF']
const SELECTION_COLORS = Array.from(new Set([...PEN_COLORS, ...HIGHLIGHTER_COLORS]))

const getContrastPenColor = (backgroundColor: string): string => {
  // Simple contrast calculation - return white for dark backgrounds, black for light
  const color = backgroundColor.toLowerCase()
  if (color === '#1c1c1e' || color.startsWith('#0') || color.startsWith('#1') || color.startsWith('#2')) {
    return '#FFFFFF'
  }
  return '#1C1C1E'
}

const MIN_SCALE = 0.6
const MAX_SCALE = 3.5
const ERASER_FADE_DURATION = 180
const DEBUG_PANEL_ENABLED = false
const MIN_EDGE_PADDING = 48

const getCanvasDimensions = (pageSize: PageSize) => {
  switch (pageSize) {
    case 'vertical':
      return { width: 'min(860px, 100%)', height: 'calc(100vh - 96px)' }
    case 'horizontal':
      return { width: 'min(1200px, 100%)', height: 'calc(100vh - 200px)' }
    case 'square':
      return { width: 'min(860px, 100%)', height: 'min(860px, calc(100vh - 96px))' }
    default:
      return { width: 'min(860px, 100%)', height: 'calc(100vh - 96px)' }
  }
}

const CanvasWorkspace = ({
  activeNote,
  onSave,
  onUpdate,
  onBackToGallery,
}: CanvasWorkspaceProps) => {
  // Per-page history buffers
  const pageHistoryRef = useRef<Record<string, { history: Stroke[][]; future: Stroke[][] }>>({})
  const getPageBuffers = useCallback((pageId: string) => {
    if (!pageHistoryRef.current[pageId]) {
      pageHistoryRef.current[pageId] = { history: [], future: [] }
    }
    return pageHistoryRef.current[pageId]
  }, [])
  const strokesRef = useRef<Stroke[]>([])
  const loadedNoteIdRef = useRef<string | null>(null)
  const loadedPageIdRef = useRef<string | null>(null)
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

  const initialSettings = useMemo(() => loadSettings(), [])
  const [tool, setTool] = useState<ToolType>(initialSettings.tool)
  const [penColor, setPenColor] = useState(initialSettings.pen.color)
  const [penSize, setPenSize] = useState(initialSettings.pen.size)
  const [highlighterColor, setHighlighterColor] = useState(
    initialSettings.highlighter.color,
  )
  const [highlighterSize, setHighlighterSize] = useState(
    initialSettings.highlighter.size,
  )
  const [highlighterOpacity, setHighlighterOpacity] = useState(
    initialSettings.highlighter.opacity,
  )
  const [eraserSize, setEraserSize] = useState(initialSettings.eraser.size)
  const [backgroundColor, setBackgroundColor] = useState('#FAFAFA')
  const [pageSize, setPageSize] = useState<PageSize>('vertical')
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0)
  const [showSettings, setShowSettings] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])

  // Auto-adjust pen color based on background (only if user hasn't manually changed it)
  useEffect(() => {
    const contrastColor = getContrastPenColor(backgroundColor)
    // Only auto-change if current pen color is the default for the previous background
    const isDefaultColor = penColor === '#1C1C1E' || penColor === '#FFFFFF'
    if (isDefaultColor && penColor !== contrastColor && PEN_COLORS.includes(contrastColor)) {
      setPenColor(contrastColor)
    }
  }, [backgroundColor])

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
  const [historyVersion, setHistoryVersion] = useState(0)

  const {
    canvasRef,
    containerRef,
    backgroundImageRef,
    canvasSizeRef,
    drawStroke,
    forceRender,
  } = useCanvasRenderer({
    strokes,
    currentStroke,
    selection,
    selectionPath,
    eraserPreview,
    fadingStrokes,
    backgroundColor,
    viewportScale: viewport.scale,
  })

  const stagePadding = useMemo(() => {
    // Reduce padding significantly for better PDF rendering experience
    // Use a more conservative padding that doesn't interfere with content viewing
    if (viewport.scale <= 1) return 0
    if (typeof window === 'undefined') return MIN_EDGE_PADDING
    const viewportMinDimension = Math.min(window.innerWidth, window.innerHeight)
    // Reduce padding to 4% of viewport min dimension, with tighter constraints
    const dynamicPadding = Math.min(
      80, // Much lower max padding
      Math.max(16, Math.round(viewportMinDimension * 0.04)), // 4% instead of 12%
    )
    return dynamicPadding
  }, [viewport.scale])

  const canvasDimensions = useMemo(() => {
    const page = activeNote?.pages?.[currentPageIndex]
    const bw = page?.bgWidth
    const bh = page?.bgHeight
    if (bw && bh) {
      // Constrain width to viewport, derive height by precise aspect ratio
      return {
        width: `${bw}px`,
        height: `${bh}px`,
        maxWidth: 'min(1200px, 96vw)',
        maxHeight: 'calc(100vh - 140px)',
        aspectRatio: `${bw} / ${bh}` as unknown as CSSProperties['aspectRatio'],
      }
    }
    return getCanvasDimensions(pageSize)
  }, [activeNote?.pages, currentPageIndex, pageSize])

  // Force canvas re-render when background changes
  useEffect(() => {
    forceRender()
  }, [backgroundColor, forceRender])

  const toCanvasPoint = useCallback(
    (clientX: number, clientY: number): StrokePoint | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const x = (clientX - rect.left) / viewport.scale
      const y = (clientY - rect.top) / viewport.scale
      return { x, y }
    },
    [canvasRef, viewport.scale],
  )

  usePointerHandlers({
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

  const {
    exportCanvas,
    exportAsPNG,
    exportPagesAsPDF,
    copySelectionAsImage,
    shareSelectionAsImage,
  } = useCanvasExport({
    canvasRef,
    canvasSizeRef,
    backgroundImageRef,
    drawStroke,
    strokes,
    currentStroke,
    currentNoteTitle,
    selection,
  })

  const resetHistory = useCallback((initial: Stroke[]) => {
    // reset active page buffers
    const pageId = activeNote?.pages?.[currentPageIndex]?.id
    if (pageId) {
      pageHistoryRef.current[pageId] = { history: [], future: [] }
    }
    removedStrokeIdsRef.current.clear()
    setStrokes(cloneStrokes(initial))
    setCurrentStroke(null)
    setSelection(null)
    setSelectionPath([])
    setHistoryVersion((v) => v + 1)
  }, [activeNote?.pages, currentPageIndex])

  const pushHistorySnapshot = useCallback(() => {
    const pageId = activeNote?.pages?.[currentPageIndex]?.id
    if (!pageId) return
    const buffers = getPageBuffers(pageId)
    buffers.history.push(cloneStrokes(strokesRef.current))
    buffers.future = []
    setHistoryVersion((v) => v + 1)
  }, [activeNote?.pages, currentPageIndex, getPageBuffers])

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
      setStrokes((prev) => [...prev, stroke])
      setCurrentStroke(null)
    },
    [pushHistorySnapshot],
  )

  const exportCanvasRef = useRef(exportCanvas)
  useEffect(() => {
    exportCanvasRef.current = exportCanvas
  }, [exportCanvas])

  const autoSaveTimeoutRef = useRef<number | null>(null)
  const lastPageSyncRef = useRef<{ noteId: string | null; pageIndex: number | null }>({
    noteId: null,
    pageIndex: null,
  })

  const queueAutoSave = useCallback(() => {
    if (!onUpdate) return
    if (!activeNote) return
    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current)
    }

    const delay = isMobile ? 1500 : 800
    autoSaveTimeoutRef.current = window.setTimeout(() => {
      autoSaveTimeoutRef.current = null
      const exportResult = exportCanvasRef.current?.()
      if (!exportResult) return

      const updatedPages: Note['pages'] | undefined = activeNote.pages
        ? activeNote.pages.map((p, idx) =>
            idx === currentPageIndex ? { ...p, strokes: cloneStrokes(strokesRef.current) } : p,
          )
        : undefined

      const payload = {
        dataUrl: exportResult.dataUrl,
        thumbnailUrl: exportResult.thumbnailUrl ?? exportResult.dataUrl,
        strokes: cloneStrokes(strokesRef.current),
        ...(updatedPages
          ? {
              pages: updatedPages,
              currentPageIndex,
            }
          : {}),
      }
      onUpdate(payload)
    }, delay)
  }, [activeNote, currentPageIndex, isMobile, onUpdate])

  useEffect(() => {
    queueAutoSave()
  }, [queueAutoSave, strokes, currentStroke])

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

  useEffect(() => {
    const settings: SettingsType = {
      tool,
      pen: { color: penColor, size: penSize },
      highlighter: { color: highlighterColor, size: highlighterSize, opacity: highlighterOpacity },
      eraser: { size: eraserSize },
    }
    persistSettings(settings)
  }, [tool, penColor, penSize, highlighterColor, highlighterSize, highlighterOpacity, eraserSize])

  const handleToolChange = useCallback((newTool: ToolType) => {
    setTool(newTool)
    // Clear selection when changing tools
    setSelection(null)
    setSelectionPath([])
  }, [])

  const handleSettingsClick = useCallback(() => {
    setShowSettings(true)
  }, [])

  const handleSelectionColorChange = useCallback(
    (color: string) => {
      if (!selection || selection.strokeIds.length === 0) return
      pushHistorySnapshot()
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

    const nextNoteId = activeNote.id
    const nextIndex = Number.isInteger(activeNote.currentPageIndex)
      ? Math.min(Math.max(0, activeNote.currentPageIndex), Math.max(0, (activeNote.pages?.length ?? 1) - 1))
      : 0

    const nextPage = activeNote.pages?.[nextIndex]
    const nextPageId = nextPage?.id ?? null

    const noteChanged = loadedNoteIdRef.current !== nextNoteId
    const pageChanged = loadedPageIdRef.current !== nextPageId

    if (!noteChanged && !pageChanged) return

    lastPageSyncRef.current = { noteId: null, pageIndex: null }

    loadedNoteIdRef.current = nextNoteId
    loadedPageIdRef.current = nextPageId
    setCurrentPageIndex(nextIndex)

    const initialStrokes = nextPage?.strokes ? cloneStrokes(nextPage.strokes) : []
    resetHistory(initialStrokes)
    setBackgroundColor(nextPage?.backgroundColor ?? '#FAFAFA')
    setPageSize(nextPage?.pageSize ?? 'vertical')
    setViewport({ scale: 1, offsetX: 0, offsetY: 0 })

    // Load background image for the current page if present
    const bgUrl = nextPage?.thumbnailUrl
    if (bgUrl) {
      const img = new Image()
      img.onload = () => {
        backgroundImageRef.current = img
        forceRender()
      }
      img.onerror = () => {
        backgroundImageRef.current = null
        forceRender()
      }
      img.src = bgUrl
    } else {
      backgroundImageRef.current = null
      forceRender()
    }
  }, [activeNote, forceRender, resetHistory])

  const handleUndo = useCallback(() => {
    const pageId = activeNote?.pages?.[currentPageIndex]?.id
    if (!pageId) return
    const buffers = getPageBuffers(pageId)
    setStrokes((current) => {
      if (buffers.history.length === 0) return current
      const previous = buffers.history.pop()
      if (!previous) return current
      buffers.future.push(cloneStrokes(current))
      return cloneStrokes(previous)
    })
    setSelection(null)
    setSelectionPath([])
    setCurrentStroke(null)
    setHistoryVersion((v) => v + 1)
  }, [activeNote?.pages, currentPageIndex, getPageBuffers])

  const handleRedo = useCallback(() => {
    const pageId = activeNote?.pages?.[currentPageIndex]?.id
    if (!pageId) return
    const buffers = getPageBuffers(pageId)
    setStrokes((current) => {
      if (buffers.future.length === 0) return current
      const next = buffers.future.pop()
      if (!next) return current
      buffers.history.push(cloneStrokes(current))
      return cloneStrokes(next)
    })
    setSelection(null)
    setSelectionPath([])
    setCurrentStroke(null)
    setHistoryVersion((v) => v + 1)
  }, [activeNote?.pages, currentPageIndex, getPageBuffers])

  const canUndo = useMemo(() => {
    const pageId = activeNote?.pages?.[currentPageIndex]?.id
    if (!pageId) return false
    return (pageHistoryRef.current[pageId]?.history.length ?? 0) > 0
  }, [activeNote?.pages, currentPageIndex, historyVersion])
  const canRedo = useMemo(() => {
    const pageId = activeNote?.pages?.[currentPageIndex]?.id
    if (!pageId) return false
    return (pageHistoryRef.current[pageId]?.future.length ?? 0) > 0
  }, [activeNote?.pages, currentPageIndex, historyVersion])

  const { zoomIn, zoomOut, resetZoom } = useViewportZoom(
    setViewport,
    MIN_SCALE,
    MAX_SCALE,
  )

  const eraserIndicatorPosition = useMemo(() => {
    if (!eraserIndicator) return null
    return {
      x: eraserIndicator.point.x,
      y: eraserIndicator.point.y,
    }
  }, [eraserIndicator])

  const selectionActionPosition = useMemo(() => {
    if (!selection) return null
    const deltaX = selection.dragDelta?.x ?? 0
    const deltaY = selection.dragDelta?.y ?? 0
    const { minX, maxX, minY } = selection.boundingBox
    const centerX = (minX + maxX) / 2
    return {
      x: centerX + deltaX,
      y: minY + deltaY,
    }
  }, [selection])

  const currentPage = activeNote?.pages?.[currentPageIndex]

  // Persist page data when switching pages or after stroke batches
  useEffect(() => {
    if (!onUpdate) return
    if (!activeNote) return
    if (!currentPage) return

    if (activeNote.currentPageIndex !== currentPageIndex) {
      return
    }

    const noteId = activeNote.id
    const alreadySynced =
      lastPageSyncRef.current.noteId === noteId &&
      lastPageSyncRef.current.pageIndex === currentPageIndex

    if (alreadySynced) {
      return
    }

    lastPageSyncRef.current = { noteId, pageIndex: currentPageIndex }

    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current)
      autoSaveTimeoutRef.current = null
    }

    const exportResult = exportCanvasRef.current?.()
    const updatedPages: Note['pages'] = activeNote.pages.map((p, idx) =>
      idx === currentPageIndex ? { ...p, strokes: cloneStrokes(strokesRef.current) } : p,
    )

    onUpdate({
      dataUrl: exportResult?.dataUrl ?? activeNote.dataUrl,
      thumbnailUrl: exportResult?.thumbnailUrl ?? exportResult?.dataUrl ?? activeNote.thumbnailUrl,
      strokes: cloneStrokes(strokesRef.current),
      pages: updatedPages,
      currentPageIndex,
    })
  }, [activeNote, currentPage, currentPageIndex, onUpdate])

  const { selectPage, addPage, duplicatePage, deletePage } = usePageNavigation({
    activeNote,
    strokesRef,
    onUpdate,
    setCurrentPageIndex,
    resetHistory,
    setBackgroundColor,
    setPageSize,
    setViewport,
  })

  const handleSelectPage = useCallback((i: number) => selectPage(i), [selectPage])
  const handleAddPage = useCallback(() => addPage(), [addPage])

  const handleDuplicatePage = useCallback(() => duplicatePage(), [duplicatePage])

  const handleDeletePage = useCallback(() => deletePage(), [deletePage])

  const exportAllPagesAsPDF = useCallback(async () => {
    if (!activeNote || !activeNote.pages?.length) return
    await exportPagesAsPDF(activeNote.pages, activeNote.title)
  }, [activeNote, exportPagesAsPDF])

  // PNG export is for the current page; all-pages PNG ZIP would require an extra dependency.

  const exportCurrentPageAsPNG = useCallback(() => {
    // current canvas represents the active page
    exportAsPNG()
  }, [exportAsPNG])

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
          availableColors={{
            pen: PEN_COLORS,
            highlighter: HIGHLIGHTER_COLORS,
          }}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          zoom={viewport.scale}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={resetZoom}
          onBack={onBackToGallery}
          onSettingsClick={handleSettingsClick}
          hasPenInput={hasPenInput && isMobile}
        />
      </div>
      <div className="toolbar-subpanel">
        {activeNote && (
          <PageControls
            pages={activeNote.pages}
            currentPageIndex={currentPageIndex}
            onSelect={handleSelectPage}
            onAdd={handleAddPage}
            onDuplicate={handleDuplicatePage}
            onDelete={handleDeletePage}
          />
        )}
      </div>
      <div
        className="canvas-stage"
        style={
          {
            '--stage-padding': `${stagePadding}px`,
            overflow: 'visible',
            touchAction: 'none',
          } as CSSProperties
        }
      >
        <div
          className="canvas-container"
          ref={containerRef}
          style={{
            width: canvasDimensions.width,
            height: canvasDimensions.height,
            transform: `matrix(${viewport.scale}, 0, 0, ${viewport.scale}, ${viewport.offsetX}, ${viewport.offsetY})`,
            transformOrigin: '0 0',
            touchAction: 'none',
          }}
          onClick={() => {
            // Clear selection when clicking on empty canvas area
            if (selection) {
              setSelection(null)
              setSelectionPath([])
            }
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              touchAction: 'none',
            }}
            onClick={(e) => {
              e.stopPropagation()
              // Selection will be cleared by the parent div's onClick handler if needed
            }}
          />
          {selection && selection.strokeIds.length > 0 && selectionActionPosition && (
            <SelectionActions
              position={selectionActionPosition}
              scale={viewport.scale}
              activeColor={selectionActiveColor}
              colors={SELECTION_COLORS}
              onPickColor={handleSelectionColorChange}
              onCopy={copySelectionAsImage}
              onShare={shareSelectionAsImage}
              onDelete={() => {
                if (!selection) return
                const ids = new Set(selection.strokeIds)
                pushHistorySnapshot()
                setStrokes((prev) => prev.filter((s) => !ids.has(s.id)))
                setSelection(null)
                setSelectionPath([])
              }}
            />
          )}
          {eraserIndicator && eraserIndicatorPosition && (
            <EraserIndicator
              key={eraserIndicator.pulseKey}
              x={eraserIndicatorPosition.x}
              y={eraserIndicatorPosition.y}
              sizePx={Math.max(18, eraserSize / Math.max(0.001, viewport.scale))}
              active={eraserIndicator.isActive}
            />
          )}
        </div>
      </div>

      {DEBUG_PANEL_ENABLED && debugInfo && (
        <DebugPanel
          debugInfo={debugInfo}
          hasPenInput={hasPenInput}
          isMobile={isMobile}
          recentPointerEvents={recentPointerEvents}
        />
      )}

      {showSettings && (
        <Settings
          backgroundColor={backgroundColor}
          onBackgroundColorChange={setBackgroundColor}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onExportPNG={exportCurrentPageAsPNG}
          onExportPDF={exportAllPagesAsPDF}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

export default CanvasWorkspace
