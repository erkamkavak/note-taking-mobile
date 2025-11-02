import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useState } from 'react'
import type { Note } from '../types/note'
import NoteGallery from '../components/NoteGallery'
import { useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useNotesStore } from '@/state/notesStore'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const router = useRouter()
  const { notes, hydrated, setNotes, persistNow } = useNotesStore()
  const [importOpen, setImportOpen] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importMode, setImportMode] = useState<'static' | 'simplified' | 'summarized'>('static')
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [importError, setImportError] = useState<string | null>(null)

  const handleCreateNew = useCallback(() => {
    router.navigate({ to: '/sketch' })
  }, [router])

  const handleOpen = useCallback(
    (note: Note) => {
      router.navigate({ to: '/sketch/$noteId', params: { noteId: note.id } })
    },
    [router],
  )

  const handleDelete = useCallback(
    (noteId: string) => {
      setNotes((existing) => {
        if (!existing) return existing
        return existing.filter((n) => n.id !== noteId)
      })
      persistNow()
    },
    [persistNow, setNotes],
  )

  const handleImportPdf = useCallback(() => {
    router.navigate({ to: '/import/pdf' })
  }, [router])

  const handleImportWeb = useCallback(() => {
    setImportOpen(true)
  }, [])

  // Use the server function defined in /import/web.tsx

  const handleImportSubmit = useCallback(async () => {
    const url = importUrl.trim()
    if (!url) return
    try {
      setImportStatus('loading')
      setImportError(null)
      const { importWebAndCreateNoteClient } = await import('@/routes/import/web')
      const newNote = await importWebAndCreateNoteClient({ url, mode: importMode })
      setNotes((prev) => (prev ? [newNote, ...prev] : [newNote]))
      persistNow()
      setImportOpen(false)
      setImportStatus('done')
      router.navigate({ to: '/sketch/$noteId', params: { noteId: newNote.id } })
    } catch (e: any) {
      console.error(e)
      setImportStatus('error')
      setImportError(e?.message || 'Failed to import webpage')
    }
  }, [importMode, importUrl, persistNow, router, setNotes])

  if (!hydrated || !notes) {
    return <div />
  }

  return (
    <>
      <NoteGallery
        notes={notes}
        onCreateNew={handleCreateNew}
        onOpen={handleOpen}
        onDelete={handleDelete}
        onImportPdf={handleImportPdf}
        onImportWeb={handleImportWeb}
      />
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle>Import from Web</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="import-url">Web page URL</Label>
              <Input
                id="import-url"
                type="url"
                placeholder="https://example.com/article"
                value={importUrl}
                onChange={(e) => setImportUrl(e.currentTarget.value)}
              />
              <div className="text-sm text-muted-foreground">We will fetch readable content and convert it into a PDF you can annotate.</div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="import-mode">Import mode</Label>
              <select
                id="import-mode"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={importMode}
                onChange={(e) => setImportMode(e.currentTarget.value as any)}
              >
                <option value="static">Static capture</option>
                <option value="simplified" disabled>
                  Simplified article view (coming soon)
                </option>
                <option value="summarized" disabled>
                  Summarized article view (coming soon)
                </option>
              </select>
              <div className="text-sm text-muted-foreground">
                {importMode === 'static' && (
                  <div>Captures the page as images as if scrolled and stitched. Best for visual-heavy pages.</div>
                )}
                {/* {importMode === 'simplified' && (
                  <div>Extracts article text via readable view and lays it out into a clean, paginated PDF.</div>
                )}
                {importMode === 'summarized' && (
                  <div>Extracts article text via readable view, summarizes it and lays it out into a clean, paginated PDF.</div>
                )} */}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
              <Button onClick={handleImportSubmit} disabled={!importUrl.trim() || importStatus === 'loading'}>
                {importStatus === 'loading' ? 'Importing…' : 'Import'}
              </Button>
            </div>
            {importError ? (
              <div className="text-sm" style={{ color: 'crimson' }}>{importError}</div>
            ) : null}
            {importStatus === 'done' ? (
              <div className="text-sm text-muted-foreground">Note created. Redirecting…</div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
