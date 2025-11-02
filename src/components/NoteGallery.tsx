import type { Note } from '../types/note'
import NoteCard from './NoteCard'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type NoteGalleryProps = {
  notes: Note[]
  onCreateNew: () => void
  onOpen: (note: Note) => void
  onDelete: (noteId: string) => void
  onExport: (note: Note) => void
  onImportPdf: () => void
  onImportWeb: () => void
}

const NoteGallery = ({
  notes,
  onCreateNew,
  onOpen,
  onDelete,
  onExport,
  onImportPdf,
  onImportWeb,
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
        <div className="flex gap-2 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Import</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onImportPdf}>Import from PDF</DropdownMenuItem>
              <DropdownMenuItem onSelect={onImportWeb}>Import from Web Page</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={onCreateNew}>New Note</Button>
        </div>
      </header>

      {notes.length === 0 ? (
        <div className="empty-state">
          <p>Your handwritten notes will live here. Create your first note!</p>
          <Button variant="outline" onClick={onCreateNew}>Start Drawing</Button>
        </div>
      ) : (
        <section className="note-grid">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onOpen={onOpen}
              onDelete={(item) => onDelete(item.id)}
              onExport={onExport}
            />
          ))}
        </section>
      )}
    </div>
  )
}

export default NoteGallery
