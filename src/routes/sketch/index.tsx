import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useRef } from 'react'
import type { Note } from '@/types/note'
import { useNotesStore } from '@/state/notesStore'

export const Route = createFileRoute('/sketch/')({ component: SketchEmpty })

function SketchEmpty() {
  const router = useRouter()
  const { notes, setNotes, persistNow } = useNotesStore()
  const createdRef = useRef(false)

  const WHITE_PX =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8AABfMBVv6gS3QAAAAASUVORK5CYII='

  const ensureId = useCallback(() => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }, [])

  const generateNoteTitle = useCallback((index: number) => {
    const date = new Date()
    const shortDate = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `Note ${index} – ${shortDate}`
  }, [])

  // Immediately create a new empty note and redirect to /sketch/$noteId
  useEffect(() => {
    if (createdRef.current) return
    createdRef.current = true
    const createdAt = Date.now()
    const nextIndex = (notes?.length ?? 0) + 1
    const id = ensureId()
    const pageId = ensureId()
    const newNote: Note = {
      id,
      dataUrl: WHITE_PX,
      thumbnailUrl: WHITE_PX,
      createdAt,
      updatedAt: createdAt,
      title: generateNoteTitle(nextIndex),
      pages: [
        {
          id: pageId,
          strokes: [],
          backgroundColor: '#FAFAFA',
          pageSize: 'vertical',
          thumbnailUrl: undefined,
        },
      ],
      currentPageIndex: 0,
    }
    // Update state, then navigate to created note; persistence is handled centrally
    setNotes((prev) => {
      const base = prev ?? []
      return [newNote, ...base]
    })
    persistNow()
    router.navigate({ to: '/sketch/$noteId', params: { noteId: id }, replace: true })
  }, [ensureId, generateNoteTitle, notes?.length, persistNow, router, setNotes])

  return null
}
