import { NOTE_STORAGE_KEY, type Note, type Stroke } from '../types/note'

// IndexedDB database name and version
const DB_NAME = 'NoteTakingDB'
const DB_VERSION = 1
const NOTES_STORE = 'notes'
const IMAGES_STORE = 'images'

let dbInstance: IDBDatabase | null = null

/**
 * Initialize IndexedDB connection
 */
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      dbInstance = request.result
      console.log('IndexedDB initialized successfully')
      resolve(dbInstance)
    }

    request.onupgradeneeded = () => {
      const db = request.result
      console.log('Creating/upgrading IndexedDB schema...')

      // Notes store - holds note metadata and references to images
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        const notesStore = db.createObjectStore(NOTES_STORE, { keyPath: 'id' })
        notesStore.createIndex('updatedAt', 'updatedAt', { unique: false })
      }

      // Images store - holds actual image blobs
      if (!db.objectStoreNames.contains(IMAGES_STORE)) {
        db.createObjectStore(IMAGES_STORE, { keyPath: 'id' })
      }
    }
  })
}

/**
 * Validate and convert data URL (base64) to Blob
 */
const isDataUrl = (val: unknown): val is string =>
  typeof val === 'string' && val.startsWith('data:') && val.includes(',')

const dataURLToBlob = (dataURL: string): Blob => {
  if (!isDataUrl(dataURL)) {
    throw new Error('Invalid data URL')
  }
  const arr = dataURL.split(',')
  const mimeMatch = arr[0].match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
  const b64 = arr[1] ?? ''
  const bstr = atob(b64)
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

/**
 * Convert Blob to data URL (base64)
 */
const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Save images to IndexedDB and return their blob IDs
 */
const saveImagesToDB = async (db: IDBDatabase, note: Note): Promise<{
  dataUrl: string
  thumbnailUrl: string
  pages: Note['pages']
}> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([IMAGES_STORE], 'readwrite')
    const store = tx.objectStore(IMAGES_STORE)

    const mainReference = isDataUrl(note.dataUrl)
      ? `note-${note.id}-main`
      : note.dataUrl
    let thumbnailReference: string | undefined = note.thumbnailUrl || undefined
    let processedPages: Note['pages'] = note.pages

    tx.oncomplete = () => {
      resolve({
        dataUrl: mainReference,
        thumbnailUrl: thumbnailReference ?? mainReference,
        pages: processedPages,
      })
    }

    tx.onerror = () => {
      reject(tx.error)
    }

    // Save main image if provided as data URL
    if (isDataUrl(note.dataUrl)) {
      const dataUrlBlob = dataURLToBlob(note.dataUrl)
      store.put({ id: mainReference, blob: dataUrlBlob })
    }

    if (isDataUrl(note.thumbnailUrl)) {
      if (note.thumbnailUrl === note.dataUrl) {
        thumbnailReference = mainReference
      } else {
        const thumbnailBlob = dataURLToBlob(note.thumbnailUrl)
        const thumbId = `note-${note.id}-thumb`
        store.put({ id: thumbId, blob: thumbnailBlob })
        thumbnailReference = thumbId
      }
    } else if (!thumbnailReference) {
      thumbnailReference = mainReference
    }

    processedPages = note.pages.map((page, index) => {
      if (isDataUrl(page.thumbnailUrl)) {
        const pageBlob = dataURLToBlob(page.thumbnailUrl)
        const blobId = `note-${note.id}-page-${index}`
        store.put({ id: blobId, blob: pageBlob })
        return {
          ...page,
          blobId: blobId as any,
          thumbnailUrl: undefined,
        }
      }
      return page
    })
  })
}

/**
 * Load images from IndexedDB and convert back to data URLs
 */
const loadImagesFromDB = async (db: IDBDatabase, note: any): Promise<Note> => {
  const getImageRecord = (id: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction([IMAGES_STORE], 'readonly')
      const store = tx.objectStore(IMAGES_STORE)
      const request = store.get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // Load main image
  let dataUrl = ''
  if (note.dataUrl && typeof note.dataUrl === 'string' && !note.dataUrl.startsWith('data:')) {
    const dataUrlBlobId = note.dataUrl
    const blobResult = await getImageRecord(dataUrlBlobId)
    if (blobResult?.blob) {
      dataUrl = await blobToDataURL(blobResult.blob)
    }
  } else if (note.dataUrl?.startsWith('data:')) {
    dataUrl = note.dataUrl
  }

  // Load thumbnail
  let thumbnailUrl = ''
  if (note.thumbnailUrl && typeof note.thumbnailUrl === 'string' && !note.thumbnailUrl.startsWith('data:')) {
    const thumbnailBlobId = note.thumbnailUrl
    const blobResult = await getImageRecord(thumbnailBlobId)
    if (blobResult?.blob) {
      thumbnailUrl = await blobToDataURL(blobResult.blob)
    }
  } else if (note.thumbnailUrl?.startsWith('data:')) {
    thumbnailUrl = note.thumbnailUrl
  } else {
    thumbnailUrl = dataUrl
  }

  // Load page images
  const pages = await Promise.all(
    (note.pages || []).map(async (page: any) => {
      if (page.blobId) {
        const blobResult = await getImageRecord(page.blobId)
        if (blobResult?.blob) {
          const pageDataUrl = await blobToDataURL(blobResult.blob)
          return {
            ...page,
            thumbnailUrl: pageDataUrl,
            blobId: undefined,
          }
        }
      }
      return page
    })
  )

  return {
    ...note,
    dataUrl: dataUrl || note.dataUrl,
    thumbnailUrl: thumbnailUrl || note.thumbnailUrl || dataUrl,
    pages,
  }
}

const reviveStrokes = (strokes: Stroke[] | undefined): Stroke[] =>
  (strokes ?? []).map((stroke) => ({
    ...stroke,
    points: stroke.points ?? [],
    opacity: stroke.opacity ?? (stroke.tool === 'highlighter' ? 0.35 : 1),
  }))

/**
 * Migrate from localStorage to IndexedDB on first run
 */
const migrateFromLocalStorage = async (db: IDBDatabase): Promise<void> => {
  try {
    const raw = localStorage.getItem(NOTE_STORAGE_KEY)
    if (!raw) {
      return
    }

    const notes = JSON.parse(raw) as Note[]
    console.log(`Migrating ${notes.length} notes from localStorage to IndexedDB...`)

    // Process notes sequentially to avoid long-lived transactions
    for (const note of notes) {
      try {
        const imageData = await saveImagesToDB(db, note)
        const noteToSave = {
          ...note,
          ...imageData,
          migrated: true,
        }
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction([NOTES_STORE], 'readwrite')
          const store = tx.objectStore(NOTES_STORE)
          const req = store.put(noteToSave)
          req.onsuccess = () => resolve()
          req.onerror = () => reject(req.error)
          tx.onabort = () => reject(tx.error)
        })
      } catch (err) {
        console.error(`Failed to migrate note ${note.id}:`, err)
      }
    }

    console.log('Migration completed successfully')
    localStorage.removeItem(NOTE_STORAGE_KEY)
  } catch (error) {
    console.error('Failed to migrate from localStorage:', error)
    throw error
  }
}

export const loadNotes = async (): Promise<Note[]> => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const db = await initDB()

    // Migrate on first run
    if (!localStorage.getItem('note-taking-codex-migrated')) {
      await migrateFromLocalStorage(db)
      localStorage.setItem('note-taking-codex-migrated', 'true')
    }

    const tx = db.transaction([NOTES_STORE], 'readonly')
    const store = tx.objectStore(NOTES_STORE)
    const request = store.getAll()

    const notes = await new Promise<Note[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as Note[])
      request.onerror = () => reject(request.error)
    })

    // Load images for each note
    const notesWithImages = await Promise.all(
      notes.map((note) => loadImagesFromDB(db, note))
    )

    return notesWithImages
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

export const persistNotes = async (notes: Note[]): Promise<void> => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const db = await initDB()

    // Precompute payloads with image blob references first
    const payloads: Note[] = []
    for (const note of notes) {
      const imageData = await saveImagesToDB(db, note)
      payloads.push({ ...note, ...imageData })
    }

    // Single atomic transaction for notes store: clear then put all
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([NOTES_STORE], 'readwrite')
      const store = tx.objectStore(NOTES_STORE)
      store.clear()
      for (const p of payloads) {
        store.put(p)
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })

    // Saved successfully
  } catch (error) {
    console.error('Failed to save notes', error)
  }
}

/**
 * Clear all notes (useful for testing or reset)
 */
export const clearAllNotes = async (): Promise<void> => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const db = await initDB()
    const tx = db.transaction([NOTES_STORE, IMAGES_STORE], 'readwrite')

    await new Promise<void>((resolve, reject) => {
      const notesClear = tx.objectStore(NOTES_STORE).clear()
      notesClear.onsuccess = () => resolve()
      notesClear.onerror = () => reject(notesClear.error)
    })

    await new Promise<void>((resolve, reject) => {
      const imagesClear = tx.objectStore(IMAGES_STORE).clear()
      imagesClear.onsuccess = () => resolve()
      imagesClear.onerror = () => reject(imagesClear.error)
    })

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })

    console.log('All notes cleared')
  } catch (error) {
    console.error('Failed to clear notes', error)
  }
}
