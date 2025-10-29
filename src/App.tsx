import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import CanvasWorkspace from './components/CanvasWorkspace'
import NoteGallery from './components/NoteGallery'
import type { Note, Stroke } from './types/note'
import { loadNotes, persistNotes } from './utils/noteStorage'

type View = 'canvas' | 'gallery'

type RouteSnapshot = {
  view: View
  noteId: string | null
}

const sanitizeBasePath = (base: string) => {
  if (!base) return '/'
  if (base === '/') return '/'
  return base.replace(/\/+$/, '')
}

const BASE_PATH = sanitizeBasePath(import.meta.env.BASE_URL ?? '/')

const getRelativePath = () => {
  if (typeof window === 'undefined') return '/'
  const pathname = window.location.pathname || '/'
  if (BASE_PATH !== '/' && pathname.startsWith(BASE_PATH)) {
    const remainder = pathname.slice(BASE_PATH.length) || '/'
    return remainder.startsWith('/') ? remainder : `/${remainder}`
  }
  return pathname
}

const parseRouteFromLocation = (): RouteSnapshot => {
  if (typeof window === 'undefined') {
    return { view: 'gallery', noteId: null }
  }

  const relativePath = getRelativePath().replace(/\/+$/, '') || '/'
  if (relativePath === '/' || relativePath === '') {
    return { view: 'gallery', noteId: null }
  }

  const segments = relativePath.slice(1).split('/')
  if (segments[0] === 'sketch') {
    return {
      view: 'canvas',
      noteId: segments[1] ? decodeURIComponent(segments[1]) : null,
    }
  }

  return { view: 'gallery', noteId: null }
}

const buildPathForView = (view: View, noteId?: string | null) => {
  const relativePath =
    view === 'canvas'
      ? noteId
        ? `/sketch/${encodeURIComponent(noteId)}`
        : '/sketch'
      : '/'

  if (BASE_PATH === '/' || BASE_PATH === '') {
    return relativePath
  }

  if (relativePath === '/') {
    return BASE_PATH
  }

  return `${BASE_PATH}${relativePath}`
}

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
  const initialRoute = useMemo(() => parseRouteFromLocation(), [])
  const shouldForceCanvasStart = initialRoute.view === 'gallery' && notes.length === 0
  const [activeNoteId, setActiveNoteId] = useState<string | null>(() =>
    initialRoute.noteId,
  )
  const [view, setView] = useState<View>(() =>
    shouldForceCanvasStart ? 'canvas' : initialRoute.view,
  )

  const forcedCanvasRef = useRef(shouldForceCanvasStart)

  const syncHistory = useCallback(
    (nextView: View, noteId?: string | null, options?: { replace?: boolean }) => {
      if (typeof window === 'undefined') return
      const targetPath = buildPathForView(nextView, noteId)
      const currentPath = window.location.pathname || '/'
      const shouldReplace = options?.replace ?? false

      if (currentPath === targetPath && !shouldReplace) {
        return
      }

      const method: 'pushState' | 'replaceState' = shouldReplace
        ? 'replaceState'
        : 'pushState'

      if (currentPath !== targetPath || shouldReplace) {
        window.history[method](null, '', targetPath)
      }
    },
    [],
  )

  useEffect(() => {
    if (forcedCanvasRef.current) {
      syncHistory('canvas', null, { replace: true })
      forcedCanvasRef.current = false
    }
  }, [syncHistory])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePopState = () => {
      const { view: nextView, noteId } = parseRouteFromLocation()
      setView(nextView)
      setActiveNoteId(nextView === 'canvas' ? noteId : null)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

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
    pages,
    currentPageIndex,
  }: {
    dataUrl: string
    thumbnailUrl: string
    strokes: Stroke[]
    pages?: Note['pages']
    currentPageIndex?: number
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
                  // if pages provided, write them
                  ...(pages ? { pages } : {}),
                  ...(typeof currentPageIndex === 'number'
                    ? { currentPageIndex }
                    : {}),
                  updatedAt: Date.now(),
                }
              : note,
          )
          .sort((a, b) => b.updatedAt - a.updatedAt),
      )
      syncHistory('canvas', activeNote.id, { replace: true })
    } else {
      let createdNoteId: string | null = null
      setNotes((existing) => {
        const createdAt = Date.now()
        const nextIndex = existing.length + 1
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
        return [newNote, ...existing]
      })
      if (createdNoteId) {
        setActiveNoteId(createdNoteId)
        syncHistory('canvas', createdNoteId, { replace: true })
      }
    }
  }

  const handleSaveNote = (data: {
    dataUrl: string
    thumbnailUrl: string
    strokes: Stroke[]
  }) => {
    handleUpdateNote(data)
    setView('gallery')
    setActiveNoteId(null)
    syncHistory('gallery')
  }

  const handleCreateNew = () => {
    setActiveNoteId(null)
    setView('canvas')
    syncHistory('canvas')
  }

  const handleOpenNote = (note: Note) => {
    setActiveNoteId(note.id)
    setView('canvas')
    syncHistory('canvas', note.id)
  }

  const handleDeleteNote = (noteId: string) => {
    setNotes((existing) => existing.filter((note) => note.id !== noteId))
    if (activeNoteId === noteId) {
      setActiveNoteId(null)
      setView('gallery')
      syncHistory('gallery')
    }
  }

  const handleBackToGallery = () => {
    setView('gallery')
    setActiveNoteId(null)
    syncHistory('gallery')
  }

  return (
    <div className="app-shell">
      {view === 'canvas' ? (
        <CanvasWorkspace
          activeNote={activeNote}
          onSave={handleSaveNote}
          onUpdate={handleUpdateNote}
          onBackToGallery={handleBackToGallery}
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
