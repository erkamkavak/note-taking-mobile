export type StrokeTool = 'pen' | 'highlighter' | 'eraser'

export type StrokePoint = {
  x: number
  y: number
}

export type Stroke = {
  id: string
  tool: StrokeTool
  color: string
  size: number
  opacity: number
  points: StrokePoint[]
}

export type PageSize = 'vertical' | 'horizontal' | 'square'

export type Page = {
  id: string
  strokes: Stroke[]
  backgroundColor: string
  pageSize: PageSize
  thumbnailUrl?: string
}

export type Note = {
  id: string
  dataUrl: string
  thumbnailUrl: string
  title: string
  createdAt: number
  updatedAt: number
  pages: Page[]
  currentPageIndex: number
}

export const NOTE_STORAGE_KEY = 'note-taking-codex-notes'
