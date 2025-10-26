import { useEffect, useMemo, useState } from 'react'
import './App.css'
import CanvasWorkspace from './components/CanvasWorkspace'
import NoteGallery from './components/NoteGallery'
import type { Note } from './types/note'
import { loadNotes, persistNotes } from './utils/noteStorage'

type View = 'canvas' | 'gallery'

const generateNoteTitle = (index: number) => {
  const date = new Date()
  const shortDate = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  return `Note ${index} – ${shortDate}`
}

function App() {
  const [notes, setNotes] = useState<Note[]>(() => loadNotes())
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [view, setView] = useState<View>(() =>
    notes.length > 0 ? 'gallery' : 'canvas',
  )

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeNoteId) ?? null,
    [notes, activeNoteId],
  )

  useEffect(() => {
    persistNotes(notes)
  }, [notes])

  const ensureId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  const handleUpdateNote = ({
    dataUrl,
    thumbnailUrl,
    strokes,
  }: {
    dataUrl: string
    thumbnailUrl: string
    strokes: Note['strokes']
  }) => {
    if (activeNote) {
      setNotes((existing) =>
        existing
          .map((note) =>
            note.id === activeNote.id
              ? {
                  ...note,
                  dataUrl,
                  thumbnailUrl,
                  strokes,
                  updatedAt: Date.now(),
                }
              : note,
          )
          .sort((a, b) => b.updatedAt - a.updatedAt),
      )
    } else {
      setNotes((existing) => {
        const createdAt = Date.now()
        const nextIndex = existing.length + 1
        const newNote: Note = {
          id: ensureId(),
          dataUrl,
          thumbnailUrl,
          createdAt,
          updatedAt: createdAt,
          title: generateNoteTitle(nextIndex),
          strokes,
        }
        setActiveNoteId(newNote.id)
        return [newNote, ...existing]
      })
    }
  }

  const handleSaveNote = (data: {
    dataUrl: string
    thumbnailUrl: string
    strokes: Note['strokes']
  }) => {
    handleUpdateNote(data)
    setView('gallery')
    setActiveNoteId(null)
  }

  const handleCreateNew = () => {
    setActiveNoteId(null)
    setView('canvas')
  }

  const handleOpenNote = (note: Note) => {
    setActiveNoteId(note.id)
    setView('canvas')
  }

  const handleDeleteNote = (noteId: string) => {
    setNotes((existing) => existing.filter((note) => note.id !== noteId))
    if (activeNoteId === noteId) {
      setActiveNoteId(null)
      setView('gallery')
    }
  }

  return (
    <div className="app-shell">
      {view === 'canvas' ? (
        <CanvasWorkspace
          activeNote={activeNote}
          onSave={handleSaveNote}
          onUpdate={handleUpdateNote}
          onBackToGallery={() => setView('gallery')}
        />
      ) : (
        <NoteGallery
          notes={notes}
          onCreateNew={handleCreateNew}
          onOpen={handleOpenNote}
          onDelete={handleDeleteNote}
        />
      )}
    </div>
  )
}

export default App
