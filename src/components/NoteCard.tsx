import type { Note } from '../types/note'

type NoteCardProps = {
  note: Note
  onOpen: (note: Note) => void
  onDelete: (note: Note) => void
}

const NoteCard = ({ note, onOpen, onDelete }: NoteCardProps) => {
  const formattedDate = new Date(note.updatedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const thumbSrc = note.thumbnailUrl || note.dataUrl
  const hasThumb = Boolean(thumbSrc)

  return (
    <article className="note-card">
      <button
        type="button"
        className="note-card-body"
        onClick={() => onOpen(note)}
        title={note.title}
      >
        {hasThumb ? (
          <img
            src={thumbSrc}
            alt={note.title}
            className="note-card-thumb"
          />
        ) : (
          <div className="note-card-thumb note-card-thumb--empty" aria-hidden="true">
            <span className="note-card-thumb-fallback">No preview</span>
          </div>
        )}
      </button>
      <div className="note-card-footer">
        <div className="note-card-meta">
          <span className="note-card-title" title={note.title}>
            {note.title}
          </span>
          <span className="note-card-date">{formattedDate}</span>
        </div>
        <button
          type="button"
          className="note-delete-button"
          onClick={() => onDelete(note)}
          aria-label={`Delete ${note.title}`}
        >
          ×
        </button>
      </div>
    </article>
  )
}

export default NoteCard
