import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo } from 'react'
import CanvasWorkspace from '@/components/CanvasWorkspace'
import type { Note, Stroke } from '@/types/note'
import { useNotesStore } from '@/state/notesStore'

export const Route = createFileRoute('/sketch/$noteId')({ component: SketchById })

function SketchById() {
  const router = useRouter()
  const { noteId } = Route.useParams()
  const { notes, hydrated, setNotes, persistNow } = useNotesStore()

  const activeNote = useMemo(
    () => (notes ? notes.find((n) => n.id === noteId) ?? null : null),
    [notes, noteId],
  )

  useEffect(() => {
    if (hydrated && notes && !activeNote) {
      router.navigate({ to: '/sketch' })
    }
  }, [activeNote, hydrated, notes, router])

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

  const handleUpdateNote = useCallback(
    ({
      dataUrl,
      thumbnailUrl,
      strokes,
      pages,
      currentPageIndex,
    }: {
      dataUrl: string
      thumbnailUrl: string
      strokes: Stroke[]
      pages?: Note['pages']
      currentPageIndex?: number
    }) => {
      if (!notes) return
      const existing = notes.find((n) => n.id === noteId)
      if (existing) {
        setNotes((prev) => {
          const base = prev ?? []
          return base
            .map((n) =>
              n.id === existing.id
                ? {
                    ...n,
                    dataUrl,
                    thumbnailUrl,
                    ...(pages ? { pages } : {}),
                    ...(typeof currentPageIndex === 'number' ? { currentPageIndex } : {}),
                    updatedAt: Date.now(),
                  }
                : n,
            )
            .sort((a, b) => b.updatedAt - a.updatedAt)
        })
      } else {
        let createdNoteId: string | null = null
        setNotes((prev) => {
          const base = prev ?? []
          const createdAt = Date.now()
          const nextIndex = base.length + 1
          const pageId = ensureId()
          const initialPages = (pages && pages.length > 0
            ? pages
            : [
                {
                  id: pageId,
                  strokes: strokes ?? [],
                  backgroundColor: '#FAFAFA',
                  pageSize: 'vertical' as const,
                  thumbnailUrl: undefined,
                },
              ]) as Note['pages']
          const newNote: Note = {
            id: ensureId(),
            dataUrl,
            thumbnailUrl,
            createdAt,
            updatedAt: createdAt,
            title: generateNoteTitle(nextIndex),
            pages: initialPages,
            currentPageIndex: typeof currentPageIndex === 'number' ? currentPageIndex : 0,
          }
          createdNoteId = newNote.id
          return [newNote, ...base]
        })
        if (createdNoteId) {
          router.navigate({ to: '/sketch/$noteId', params: { noteId: createdNoteId } })
        }
      }
    },
    [ensureId, generateNoteTitle, noteId, notes, router, setNotes],
  )

  const handleSaveNote = useCallback(
    (data: { dataUrl: string; thumbnailUrl: string; strokes: Stroke[] }) => {
      handleUpdateNote(data)
      persistNow()
      router.navigate({ to: '/' })
    },
    [handleUpdateNote, persistNow, router],
  )

  const handleBackToGallery = useCallback(() => {
    persistNow()
    router.navigate({ to: '/' })
  }, [persistNow, router])

  if (!hydrated || !notes) return null
  if (!activeNote) return null

  return (
    <CanvasWorkspace
      activeNote={activeNote}
      onSave={handleSaveNote}
      onUpdate={handleUpdateNote}
      onBackToGallery={handleBackToGallery}
    />
  )
}
