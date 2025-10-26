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

  return (
    <article className="note-card">
      <button
        type="button"
        className="note-card-body"
        onClick={() => onOpen(note)}
      >
        <img
          src={note.thumbnailUrl || note.dataUrl}
          alt={note.title}
          className="note-card-thumb"
        />
      </button>
      <div className="note-card-footer">
        <div className="note-card-meta">
          <span className="note-card-title">{note.title}</span>
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
