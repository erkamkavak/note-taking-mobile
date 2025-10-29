import { NOTE_STORAGE_KEY, type Note, type Stroke } from '../types/note'

const reviveStrokes = (strokes: Stroke[] | undefined): Stroke[] =>
  (strokes ?? []).map((stroke) => ({
    ...stroke,
    points: stroke.points ?? [],
    opacity: stroke.opacity ?? (stroke.tool === 'highlighter' ? 0.35 : 1),
  }))

export const loadNotes = (): Note[] => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const raw = window.localStorage.getItem(NOTE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Note[]
    return parsed
      .map((note, index) => {
        const createdAt = note.createdAt ?? Date.now()
        const updatedAt = note.updatedAt ?? createdAt
        const hasPages = Array.isArray((note as any).pages)
        let pages = hasPages
          ? (note as any).pages
          : [
              {
                id: `${index + 1}`,
                strokes: [],
                backgroundColor: '#FAFAFA',
                pageSize: 'vertical',
                thumbnailUrl: undefined,
              },
            ]
        pages = pages.map((p: any, i: number) => ({
          id: p.id ?? `${i + 1}`,
          strokes: reviveStrokes(p.strokes),
          backgroundColor: p.backgroundColor ?? '#FAFAFA',
          pageSize: p.pageSize ?? 'vertical',
          thumbnailUrl: p.thumbnailUrl,
        }))

        const currentPageIndex = Number.isInteger((note as any).currentPageIndex)
          ? (note as any).currentPageIndex
          : 0

        const noteWithDefaults: Note = {
          id: note.id,
          dataUrl: note.dataUrl,
          thumbnailUrl: note.thumbnailUrl ?? note.dataUrl,
          title:
            note.title ??
            `Saved Note ${index + 1} – ${new Date(updatedAt).toLocaleDateString()}`,
          createdAt,
          updatedAt,
          pages,
          currentPageIndex: Math.min(Math.max(0, currentPageIndex), Math.max(0, pages.length - 1)),
        }
        return noteWithDefaults
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch (error) {
    console.error('Failed to load notes', error)
    return []
  }
}

export const persistNotes = (notes: Note[]): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(notes))
  } catch (error) {
    console.error('Failed to save notes', error)
  }
}
