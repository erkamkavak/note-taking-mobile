import { useCallback } from 'react'
import type { RefObject } from 'react'
import type { Note, Page, Stroke } from '../types/note'

export type UsePageNavigationOptions = {
  activeNote: Note | null
  strokesRef: RefObject<Stroke[]>
  onUpdate?: (payload: {
    dataUrl: string
    thumbnailUrl: string
    strokes: Stroke[]
    pages?: Note['pages']
    currentPageIndex?: number
  }) => void
  setCurrentPageIndex: (index: number) => void
  resetHistory: (strokes: Stroke[]) => void
  setBackgroundColor: (color: string) => void
  setPageSize: (size: Page['pageSize']) => void
  setViewport: (v: { scale: number; offsetX: number; offsetY: number }) => void
}

const cloneStrokes = (strokes: Stroke[]): Stroke[] =>
  strokes.map((s) => ({ ...s, points: [...s.points] }))

const ensureId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const usePageNavigation = ({
  activeNote,
  strokesRef,
  onUpdate,
  setCurrentPageIndex,
  resetHistory,
  setBackgroundColor,
  setPageSize,
  setViewport,
}: UsePageNavigationOptions) => {
  const selectPage = useCallback(
    (index: number, pagesSnapshot?: Note['pages'], currentIndexSnapshot?: number) => {
      if (!activeNote) return
      const pages = pagesSnapshot ?? activeNote.pages
      const currentIdx = typeof currentIndexSnapshot === 'number' ? currentIndexSnapshot : activeNote.currentPageIndex
      const clamped = Math.min(Math.max(0, index), Math.max(0, pages.length - 1))
      const updatedPages = pages.map((p, idx) =>
        idx === currentIdx ? { ...p, strokes: cloneStrokes(strokesRef.current ?? []) } : p,
      )
      onUpdate?.({
        dataUrl: activeNote.dataUrl,
        thumbnailUrl: activeNote.thumbnailUrl,
        strokes: cloneStrokes(strokesRef.current ?? []),
        pages: updatedPages,
        currentPageIndex: clamped,
      })

      const nextPage = updatedPages[clamped]
      setCurrentPageIndex(clamped)
      resetHistory(cloneStrokes(nextPage.strokes))
      setBackgroundColor(nextPage.backgroundColor)
      setPageSize(nextPage.pageSize)
      setViewport({ scale: 1, offsetX: 0, offsetY: 0 })
    },
    [activeNote, onUpdate, resetHistory, setBackgroundColor, setCurrentPageIndex, setPageSize, setViewport, strokesRef],
  )

  const addPage = useCallback(() => {
    if (!activeNote) return
    const newPage: Page = {
      id: ensureId(),
      strokes: [],
      backgroundColor: '#FAFAFA',
      pageSize: 'vertical',
      thumbnailUrl: undefined,
    }
    const updatedPages = [...activeNote.pages, newPage]
    onUpdate?.({
      dataUrl: activeNote.dataUrl,
      thumbnailUrl: activeNote.thumbnailUrl,
      strokes: cloneStrokes(strokesRef.current ?? []),
      pages: updatedPages,
      currentPageIndex: updatedPages.length - 1,
    })
    // Use snapshot so selection works immediately even before activeNote prop updates
    selectPage(updatedPages.length - 1, updatedPages, activeNote.currentPageIndex)
  }, [activeNote, onUpdate, selectPage, strokesRef])

  const duplicatePage = useCallback(() => {
    if (!activeNote) return
    const idx = activeNote.currentPageIndex
    const source = activeNote.pages[idx]
    const duplicated: Page = {
      id: ensureId(),
      strokes: cloneStrokes(strokesRef.current ?? []),
      backgroundColor: source.backgroundColor,
      pageSize: source.pageSize,
      thumbnailUrl: undefined,
    }
    const updatedPages = [...activeNote.pages]
    updatedPages.splice(idx + 1, 0, duplicated)
    onUpdate?.({
      dataUrl: activeNote.dataUrl,
      thumbnailUrl: activeNote.thumbnailUrl,
      strokes: cloneStrokes(strokesRef.current ?? []),
      pages: updatedPages,
      currentPageIndex: idx + 1,
    })
    selectPage(idx + 1)
  }, [activeNote, onUpdate, selectPage, strokesRef])

  const deletePage = useCallback(() => {
    if (!activeNote) return
    if (activeNote.pages.length <= 1) return
    const idx = activeNote.currentPageIndex
    const updatedPages = activeNote.pages.filter((_, i) => i !== idx)
    const nextIndex = Math.min(idx, updatedPages.length - 1)
    onUpdate?.({
      dataUrl: activeNote.dataUrl,
      thumbnailUrl: activeNote.thumbnailUrl,
      strokes: cloneStrokes(strokesRef.current ?? []),
      pages: updatedPages,
      currentPageIndex: nextIndex,
    })
    // Use snapshot for immediate UX
    selectPage(nextIndex, updatedPages, idx)
  }, [activeNote, onUpdate, selectPage, strokesRef])

  return {
    selectPage,
    addPage,
    duplicatePage,
    deletePage,
  }
}
