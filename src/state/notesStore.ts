import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { Note } from '@/types/note'
import { loadNotes, persistNotes } from '@/utils/noteStorage'

type NotesSnapshot = {
  notes: Note[] | null
  hydrated: boolean
}

let snapshot: NotesSnapshot = { notes: null, hydrated: false }
let loadPromise: Promise<void> | null = null
let persistTimeout: ReturnType<typeof setTimeout> | null = null
let lastPersistSignature = ''

const subscribers = new Set<() => void>()

const computeSignature = (notes: Note[] | null): string => {
  if (!notes || notes.length === 0) return ''
  return JSON.stringify(notes.map((n) => ({ id: n.id, u: n.updatedAt, p: n.pages?.length ?? 0 })))
}

const notify = () => {
  subscribers.forEach((listener) => listener())
}

const ensureLoaded = async () => {
  if (snapshot.hydrated) return
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const loaded = await loadNotes()
        snapshot = { notes: loaded, hydrated: true }
        lastPersistSignature = computeSignature(snapshot.notes)
        notify()
      } catch (err) {
        console.error('Failed to load notes', err)
        snapshot = { notes: [], hydrated: true }
        notify()
      }
    })()
  }
  await loadPromise
}

const flushPersist = async () => {
  const current = snapshot.notes
  if (!current) {
    lastPersistSignature = ''
    return
  }
  const nonNullNotes: Note[] = current
  const sig = computeSignature(nonNullNotes)
  if (sig === lastPersistSignature) return
  try {
    await persistNotes(nonNullNotes)
    lastPersistSignature = sig
  } catch (error) {
    console.error('Failed to persist notes:', error)
  }
}

const schedulePersist = (immediate = false) => {
  if (immediate) {
    if (persistTimeout) {
      clearTimeout(persistTimeout)
      persistTimeout = null
    }
    void flushPersist()
    return
  }

  const sig = computeSignature(snapshot.notes)
  if (sig === lastPersistSignature) return

  if (persistTimeout) {
    clearTimeout(persistTimeout)
  }

  persistTimeout = setTimeout(() => {
    persistTimeout = null
    void flushPersist()
  }, 400)
}

const subscribe = (listener: () => void) => {
  subscribers.add(listener)
  if (!snapshot.hydrated && !loadPromise) {
    void ensureLoaded()
  }
  return () => subscribers.delete(listener)
}

const getSnapshot = (): NotesSnapshot => snapshot

export type NotesStore = {
  notes: Note[] | null
  hydrated: boolean
  setNotes: React.Dispatch<React.SetStateAction<Note[] | null>>
  persistNow: () => void
}

export const useNotesStore = (): NotesStore => {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => {
    if (!state.hydrated) {
      ensureLoaded().catch((err) => {
        console.error(err)
      })
    }
  }, [state.hydrated])

  const setNotes = useCallback<React.Dispatch<React.SetStateAction<Note[] | null>>>(
    (updater) => {
      const next =
        typeof updater === 'function'
          ? (updater as (prev: Note[] | null) => Note[] | null)(snapshot.notes)
          : updater
      snapshot = { ...snapshot, notes: next }
      schedulePersist()
      notify()
    },
    [],
  )

  const persistNow = useCallback(() => {
    schedulePersist(true)
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        schedulePersist(true)
      }
    }
    const handleBeforeUnload = () => {
      schedulePersist(true)
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  return {
    notes: state.notes,
    hydrated: state.hydrated,
    setNotes,
    persistNow,
  }
}
