import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import type { Note } from '../types/note'
import { loadNotes, persistNotes } from '../utils/noteStorage'
import NoteGallery from '../components/NoteGallery'
import { useRouter } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const router = useRouter()
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setNotes(loadNotes())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (notes) persistNotes(notes)
  }, [notes])

  const handleCreateNew = useCallback(() => {
    router.navigate({ to: '/sketch' })
  }, [router])

  const handleOpen = useCallback(
    (note: Note) => {
      router.navigate({ to: '/sketch/$noteId', params: { noteId: note.id } })
    },
    [router],
  )

  const handleDelete = useCallback((noteId: string) => {
    setNotes((existing) => (existing ? existing.filter((n) => n.id !== noteId) : existing))
  }, [])

  if (!hydrated || !notes) {
    return <div />
  }

  return (
    <NoteGallery
      notes={notes}
      onCreateNew={handleCreateNew}
      onOpen={handleOpen}
      onDelete={handleDelete}
    />
  )
}
