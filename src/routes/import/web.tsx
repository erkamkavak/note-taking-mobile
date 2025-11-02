import { createServerFn } from '@tanstack/react-start'
import { normalizeUrl, isValidHttpUrl } from '@/server/import/common'
import { staticCapture } from '@/server/import/staticCapture'
import { summarizedToPdf } from '@/server/import/summarized'
import { simplifiedToPdf } from '@/server/import/simplified'
import type { Note, Page, PageSize } from '@/types/note'
import { z } from 'zod'

const importWebPageSchema = z.object({
  url: z.string().min(1),
  mode: z.enum(['static', 'simplified', 'summarized']).optional(),
})

// Server function: fetch/prepare content and build a PDF depending on mode
export const importWebPage = createServerFn({ method: 'POST' })
  .inputValidator(importWebPageSchema)
  .handler(async ({ data }) => {
  try {
    const url = data.url
    const mode = data.mode ?? 'static'

    console.log('ServerFn resolved:', { url, mode })
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return { ok: false, error: 'Please provide a valid URL' }
    }

    const normalized = normalizeUrl(url.trim())
    console.log('Normalized URL:', normalized)
    if (!isValidHttpUrl(normalized)) {
      return { ok: false, error: 'Please enter a valid http(s) URL (public domain). Example: https://example.com/article' }
    }
    const selected = (mode as 'static' | 'simplified' | 'summarized') || 'simplified'

    if (selected === 'static') {
      const { pdfBase64, filename } = await staticCapture(normalized)
      return { ok: true, pdfBase64, filename }
    }

    if (selected === 'summarized') {
      const { pdfBase64, filename } = await summarizedToPdf(normalized)
      return { ok: true, pdfBase64, filename }
    }

    const { pdfBase64, filename } = await simplifiedToPdf(normalized)
    return { ok: true, pdfBase64, filename }
  } catch (e: any) {
    console.error('Import error:', e)
    return { ok: false, error: e?.message || 'Failed to import webpage' }
  }
})

// Client-side helper to import a web page, render to images, and create+persist a Note
export async function importWebAndCreateNoteClient(params: {
  url: string
  mode: 'static' | 'simplified' | 'summarized'
}): Promise<Note> {
  const { url, mode } = params
  

  // Call server function to get PDF
  const response = await importWebPage({ data: { url, mode } })
  

  if (!response?.ok) {
    throw new Error(response?.error || 'Failed to import webpage')
  }

  try {
    // Load pdf.js lazily
    
    const pdfjs = await import('pdfjs-dist')
    const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
    

    if (typeof response.pdfBase64 !== 'string') {
      throw new Error('Invalid PDF payload from server')
    }
    

    // Decode base64 -> render pages
    
    const bytes = Uint8Array.from(atob(response.pdfBase64), (c) => c.charCodeAt(0))
    

    if (bytes.length === 0) {
      throw new Error('Failed to decode PDF base64 - empty result')
    }

    
    const loadingTask = pdfjs.getDocument({
      data: bytes,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
      cMapPacked: true,
    })

    const doc = await loadingTask.promise
    

    if (doc.numPages === 0) {
      throw new Error(`PDF parsed but has ${doc.numPages} pages`)
    }

    const urls: string[] = []
    const sizes: PageSize[] = []
    const dims: Array<{ w: number; h: number }> = []

    for (let i = 1; i <= doc.numPages; i++) {
      
      const page = await doc.getPage(i)
      // Reduced scale to prevent localStorage quota exceeded
      const viewport = page.getViewport({ scale: 1.5 })
      

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')

      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      

      await page.render({ canvasContext: ctx, viewport, intent: 'display' }).promise
      

      // Use JPEG with 0.85 quality to reduce file size
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      

      if (!dataUrl || dataUrl.length < 100) {
        throw new Error(`Page ${i} generated invalid/empty data URL`)
      }

      urls.push(dataUrl)
      const ratio = viewport.width / viewport.height
      const size: PageSize = ratio > 1.15 ? 'horizontal' : ratio < 0.85 ? 'vertical' : 'square'
      sizes.push(size)
      dims.push({ w: canvas.width, h: canvas.height })

      // Release resources
      canvas.width = 0
      canvas.height = 0
    }

    

    if (urls.length === 0) throw new Error('The generated PDF has no pages')

    // Build note and persist
    const now = Date.now()
    const notePages: Page[] = urls.map((dataUrl, i) => ({
      id: `page-${i + 1}`,
      strokes: [],
      backgroundColor: '#FFFFFF',
      pageSize: sizes[i] ?? ('vertical' as const),
      thumbnailUrl: dataUrl,
      bgWidth: dims[i]?.w,
      bgHeight: dims[i]?.h,
    }))

    

    const newNote: Note = {
      id: `note-${now}`,
      dataUrl: urls[0],
      thumbnailUrl: urls[0],
      title: `${response.filename || 'Imported Webpage'} – ${new Date(now).toLocaleDateString()}`,
      createdAt: now,
      updatedAt: now,
      pages: notePages,
      currentPageIndex: 0,
    }

    return newNote
  } catch (e) {
    console.error('PDF import error:', e)
    throw e
  }
}