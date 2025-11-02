import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useNotesStore } from '@/state/notesStore'
import type { Note, Page } from '@/types/note'
import { renderPdfDocumentPages, type RenderedPdfPage } from '@/utils/pdfRendering'

export const Route = createFileRoute('/import/pdf')({ component: ImportPdf })

function ImportPdf() {
  const router = useRouter()
  const { setNotes, persistNow } = useNotesStore()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [pages, setPages] = useState<RenderedPdfPage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Lazy-load pdfjs only on client
  const pdfjs = useRef<any>(null)
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const mod = await import('pdfjs-dist')
        // Set workerSrc to the ESM worker with proper Vite handling
        const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
        mod.GlobalWorkerOptions.workerSrc = workerUrl
        if (mounted) pdfjs.current = mod
      } catch (e) {
        console.error('Failed to load pdfjs-dist', e)
        setError('Failed to load PDF renderer. Please check if pdfjs-dist is installed correctly.')
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const handleSelect = async (file: File) => {
    if (!pdfjs.current) {
      setError('PDF renderer not initialized yet. Please try again.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const loadingTask = pdfjs.current.getDocument({
        data: arrayBuffer,
        cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.current.version}/cmaps/`,
        cMapPacked: true,
      })
      const doc = await loadingTask.promise
      const renderedPages = await renderPdfDocumentPages(doc)
      doc.cleanup?.()
      setPages(renderedPages)
    } catch (e: any) {
      console.error('PDF rendering error:', e)
      setError(`Failed to render PDF: ${e?.message || 'Unknown error'}. Please make sure the file is a valid PDF.`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateNote = async () => {
    if (pages.length === 0) return
    const now = Date.now()
    const notePages: Page[] = pages.map((page, i) => ({
      id: `page-${i + 1}`,
      strokes: [],
      backgroundColor: '#FFFFFF',
      pageSize: page.size,
      thumbnailUrl: page.full,
      bgWidth: page.dims.w,
      bgHeight: page.dims.h,
    }))
    const cover = pages[0]
    const coverFull = cover?.full ?? cover?.preview
    const coverPreview = cover?.preview ?? cover?.full
    const newNote: Note = {
      id: `note-${now}`,
      dataUrl: coverFull,
      thumbnailUrl: coverPreview,
      title: `Imported PDF – ${new Date(now).toLocaleDateString()}`,
      createdAt: now,
      updatedAt: now,
      pages: notePages,
      currentPageIndex: 0,
    }
    let createdId: string | null = null
    setNotes((prev) => {
      const base = prev ?? []
      createdId = newNote.id
      return [newNote, ...base]
    })
    persistNow()
    if (createdId) {
      router.navigate({ to: '/sketch/$noteId', params: { noteId: createdId } })
    }
  }

  const preview = useMemo(() => (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
      {pages.map((page, i) => (
        <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 8, boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }}>
          <img src={page.preview} style={{ width: '100%', borderRadius: 8 }} />
        </div>
      ))}
    </div>
  ), [pages])

  return (
    <div style={{ padding: 24, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 'min(980px, 96vw)', display: 'grid', gap: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Import PDF</h1>
          <p style={{ color: '#6b7280', marginBottom: 12 }}>Select a PDF. Each page will be rendered to an image that you can use as a background.</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0]
                if (file) void handleSelect(file)
              }}
              style={{ display: 'none' }}
            />
            <Button type="button" onClick={() => inputRef.current?.click()}>
              Choose PDF…
            </Button>
            {loading ? <span style={{ color: '#6b7280' }}>Rendering…</span> : null}
            {pages.length > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280' }}>{pages.length} page{pages.length > 1 ? 's' : ''} rendered</span>
                <Button type="button" onClick={handleCreateNote}>
                  Create Note from These Pages
                </Button>
              </div>
            ) : null}
          </div>
          {error ? <div style={{ color: 'crimson', marginTop: 8 }}>{error}</div> : null}
        </div>

        {pages.length > 0 ? (
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Rendered Pages</h3>
            {preview}
          </div>
        ) : null}
      </div>
    </div>
  )
}
export default ImportPdf
