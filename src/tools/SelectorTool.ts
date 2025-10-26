import type { Stroke, StrokePoint } from '../types/note'

export type SelectionState = {
  polygon: StrokePoint[]
  strokeIds: string[]
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number }
  isDragging: boolean
  dragStart?: StrokePoint
  dragDelta?: StrokePoint
  dragOffset?: StrokePoint
}

const isPointInPolygon = (point: StrokePoint, polygon: StrokePoint[]): boolean => {
  let isInside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]?.x ?? 0
    const yi = polygon[i]?.y ?? 0
    const xj = polygon[j]?.x ?? 0
    const yj = polygon[j]?.y ?? 0

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    if (intersect) isInside = !isInside
  }
  return isInside
}

export class SelectorTool {
  private selectionPath: StrokePoint[] = []
  private selection: SelectionState | null = null
  private onSelectionChange: (selection: SelectionState | null) => void
  private onSelectionPathChange: (path: StrokePoint[]) => void
  private onStrokesMove: (strokeIds: string[], delta: StrokePoint) => void

  constructor(
    onSelectionChange: (selection: SelectionState | null) => void,
    onSelectionPathChange: (path: StrokePoint[]) => void,
    onStrokesMove: (strokeIds: string[], delta: StrokePoint) => void,
  ) {
    this.onSelectionChange = onSelectionChange
    this.onSelectionPathChange = onSelectionPathChange
    this.onStrokesMove = onStrokesMove
  }

  handlePointerDown(point: StrokePoint) {
    if (this.selection) {
      const delta = this.selection.dragDelta ?? { x: 0, y: 0 }
      const { boundingBox } = this.selection
      const adjustedMinX = boundingBox.minX + delta.x
      const adjustedMaxX = boundingBox.maxX + delta.x
      const adjustedMinY = boundingBox.minY + delta.y
      const adjustedMaxY = boundingBox.maxY + delta.y

      if (
        point.x >= adjustedMinX &&
        point.x <= adjustedMaxX &&
        point.y >= adjustedMinY &&
        point.y <= adjustedMaxY
      ) {
        // Start dragging
        const dragOffset = {
          x: point.x - adjustedMinX,
          y: point.y - adjustedMinY,
        }
        this.selection = {
          ...this.selection,
          isDragging: true,
          dragStart: point,
          dragDelta: { x: 0, y: 0 },
          dragOffset,
        }
        this.onSelectionChange(this.selection)
        return
      }
    }

    // Start new selection
    this.selection = null
    this.selectionPath = [point]
    this.onSelectionChange(null)
    this.onSelectionPathChange([point])
  }

  handlePointerMove(point: StrokePoint) {
    if (this.selection?.isDragging && this.selection.dragStart) {
      const offset = this.selection.dragOffset ?? {
        x: this.selection.dragStart.x - this.selection.boundingBox.minX,
        y: this.selection.dragStart.y - this.selection.boundingBox.minY,
      }
      const nextMinX = point.x - offset.x
      const nextMinY = point.y - offset.y
      const deltaX = nextMinX - this.selection.boundingBox.minX
      const deltaY = nextMinY - this.selection.boundingBox.minY
      const nextSelection: SelectionState = {
        ...this.selection,
        dragDelta: { x: deltaX, y: deltaY },
      }
      this.selection = nextSelection
      this.onSelectionChange(nextSelection)
      return
    }

    if (this.selectionPath.length > 0) {
      this.selectionPath = [...this.selectionPath, point]
      this.onSelectionPathChange(this.selectionPath)
    }
  }

  handlePointerUp(strokes: Stroke[]) {
    if (this.selection?.isDragging && this.selection.dragStart) {
      const point = this.selection.dragDelta
      if (point && (point.x !== 0 || point.y !== 0)) {
        this.onStrokesMove(this.selection.strokeIds, point)
      }
      const updatedSelection: SelectionState = {
        ...this.selection,
        polygon: this.selection.polygon.map((p) => ({
          x: p.x + (point?.x ?? 0),
          y: p.y + (point?.y ?? 0),
        })),
        boundingBox: {
          minX: this.selection.boundingBox.minX + (point?.x ?? 0),
          minY: this.selection.boundingBox.minY + (point?.y ?? 0),
          maxX: this.selection.boundingBox.maxX + (point?.x ?? 0),
          maxY: this.selection.boundingBox.maxY + (point?.y ?? 0),
        },
        isDragging: false,
        dragStart: undefined,
        dragDelta: undefined,
        dragOffset: undefined,
      }
      this.selection = updatedSelection
      this.onSelectionChange(updatedSelection)
      return
    }

    if (this.selectionPath.length > 0) {
      this.finalizeSelection(strokes)
    }
  }

  private finalizeSelection(strokes: Stroke[]) {
    if (this.selectionPath.length < 3) {
      this.selectionPath = []
      this.onSelectionPathChange([])
      return
    }

    // Find strokes within selection polygon
    const selectedIds: string[] = []
    strokes.forEach((stroke) => {
      if (stroke.tool === 'eraser') return
      const isSelected = stroke.points.some((point) =>
        isPointInPolygon(point, this.selectionPath),
      )
      if (isSelected) {
        selectedIds.push(stroke.id)
      }
    })

    if (selectedIds.length > 0) {
      // Calculate bounding box
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity

      strokes.forEach((stroke) => {
        if (!selectedIds.includes(stroke.id)) return
        stroke.points.forEach((point) => {
          minX = Math.min(minX, point.x)
          minY = Math.min(minY, point.y)
          maxX = Math.max(maxX, point.x)
          maxY = Math.max(maxY, point.y)
        })
      })

      this.selection = {
        polygon: this.selectionPath,
        strokeIds: selectedIds,
        boundingBox: { minX, minY, maxX, maxY },
        isDragging: false,
      }
      this.onSelectionChange(this.selection)
    }

    this.selectionPath = []
    this.onSelectionPathChange([])
  }

  clearSelection() {
    this.selection = null
    this.selectionPath = []
    this.onSelectionChange(null)
    this.onSelectionPathChange([])
  }

  getSelection(): SelectionState | null {
    return this.selection
  }

  getSelectionPath(): StrokePoint[] {
    return this.selectionPath
  }
}
