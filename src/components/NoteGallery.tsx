import type { Note } from '../types/note'
import NoteCard from './NoteCard'

type NoteGalleryProps = {
  notes: Note[]
  onCreateNew: () => void
  onOpen: (note: Note) => void
  onDelete: (noteId: string) => void
}

const NoteGallery = ({
  notes,
  onCreateNew,
  onOpen,
  onDelete,
}: NoteGalleryProps) => {
  return (
    <div className="gallery-screen">
      <header className="gallery-header">
        <div>
          <h1>Sketch Notes</h1>
          <p className="gallery-subtitle">
            Capture ideas with a paper-like handwriting experience.
          </p>
        </div>
        <button type="button" className="primary-button" onClick={onCreateNew}>
          New Note
        </button>
      </header>

      {notes.length === 0 ? (
        <div className="empty-state">
          <p>Your handwritten notes will live here. Create your first note!</p>
          <button type="button" className="ghost-button" onClick={onCreateNew}>
            Start Drawing
          </button>
        </div>
      ) : (
        <section className="note-grid">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onOpen={onOpen}
              onDelete={(item) => onDelete(item.id)}
            />
          ))}
        </section>
      )}
    </div>
  )
}

export default NoteGallery
