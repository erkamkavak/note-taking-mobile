import { useCallback, useMemo, useState } from 'react'
import type { Note } from '../types/note'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MoreHorizontal } from 'lucide-react'

type NoteCardProps = {
  note: Note
  onOpen: (note: Note) => void
  onDelete: (note: Note) => void
  onExport: (note: Note) => void
}

const NoteCard = ({ note, onOpen, onDelete, onExport }: NoteCardProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const formattedDate = useMemo(() => new Date(note.updatedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }), [note.updatedAt])
  const thumbSrc = note.thumbnailUrl || note.dataUrl
  const hasThumb = Boolean(thumbSrc)

  const handleDelete = useCallback(() => {
    setShowDeleteDialog(true)
  }, [])

  const confirmDelete = useCallback(() => {
    setShowDeleteDialog(false)
    onDelete(note)
  }, [note, onDelete])

  const cancelDelete = useCallback(() => {
    setShowDeleteDialog(false)
  }, [])

  const handleExport = useCallback(() => {
    onExport(note)
  }, [note, onExport])

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`More options for ${note.title}`}
              className="note-card-actions-trigger"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                onOpen(note)
              }}
            >
              Open
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                handleExport()
              }}
            >
              Export as PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onSelect={(event) => {
                event.preventDefault()
                handleDelete()
              }}
            >
              Delete…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Custom Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Note</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{note.title}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}

export default NoteCard
