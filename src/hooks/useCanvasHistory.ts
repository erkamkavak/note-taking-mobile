import { useCallback, useRef, useState } from 'react'
import type { Stroke } from '../types/note'

const cloneStrokes = (strokes: Stroke[]): Stroke[] =>
  strokes.map((stroke) => ({
    ...stroke,
    points: [...stroke.points],
  }))

export const useCanvasHistory = () => {
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const historyRef = useRef<Stroke[][]>([])
  const futureRef = useRef<Stroke[][]>([])

  const resetHistory = useCallback((initialStrokes: Stroke[]) => {
    setStrokes(cloneStrokes(initialStrokes))
    historyRef.current = []
    futureRef.current = []
  }, [])

  const commitStrokes = useCallback((updater: (draft: Stroke[]) => Stroke[]) => {
    setStrokes((prev) => {
      const prevSnapshot = cloneStrokes(prev)
      const draft = cloneStrokes(prev)
      const next = updater(draft)
      historyRef.current.push(prevSnapshot)
      futureRef.current = []
      return cloneStrokes(next)
    })
  }, [])

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return
    const previous = historyRef.current.pop()
    if (!previous) return
    setStrokes((current) => {
      futureRef.current.push(cloneStrokes(current))
      return cloneStrokes(previous)
    })
  }, [])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return
    const next = futureRef.current.pop()
    if (!next) return
    setStrokes((current) => {
      historyRef.current.push(cloneStrokes(current))
      return cloneStrokes(next)
    })
  }, [])

  const canUndo = historyRef.current.length > 0
  const canRedo = futureRef.current.length > 0

  return {
    strokes,
    setStrokes,
    resetHistory,
    commitStrokes,
    undo,
    redo,
    canUndo,
    canRedo,
  }
}
