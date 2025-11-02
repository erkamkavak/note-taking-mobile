import { useState, useRef, useEffect } from 'react'
import type { Page } from '../types/note'

type PageControlsProps = {
  pages: Page[]
  currentPageIndex: number
  onSelect: (index: number) => void
  onAdd: () => void
  onDuplicate: () => void
  onDelete: () => void
}

const PageControls = ({
  pages,
  currentPageIndex,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
}: PageControlsProps) => {
  const [expanded, setExpanded] = useState(false)
  const [pageInput, setPageInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Update input when page changes externally
  useEffect(() => {
    setPageInput('')
  }, [currentPageIndex])

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // Only allow numbers
    if (value === '' || /^\d+$/.test(value)) {
      setPageInput(value)
    }
  }

  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pageInput === '') return
    const pageNum = parseInt(pageInput, 10)
    if (pageNum >= 1 && pageNum <= pages.length) {
      onSelect(pageNum - 1)
      setPageInput('')
      inputRef.current?.blur()
    }
  }

  const handlePageInputBlur = () => {
    setPageInput('')
  }

  return (
    <div className="page-controls-modern">
      {/* Compact navigation bar */}
      <div className="page-nav-compact">
        <button
          type="button"
          className="page-nav-btn"
          onClick={() => onSelect(Math.max(0, currentPageIndex - 1))}
          disabled={currentPageIndex <= 0}
          aria-label="Previous page"
          title="Previous page"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <form className="page-nav-info" onSubmit={handlePageInputSubmit}>
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            className="page-nav-input"
            value={pageInput || (currentPageIndex + 1).toString()}
            onChange={handlePageInputChange}
            onBlur={handlePageInputBlur}
            onFocus={(e) => e.target.select()}
            aria-label="Current page number"
            title="Click to jump to page"
          />
          <span className="page-nav-separator">/</span>
          <span className="page-nav-total">{pages.length}</span>
        </form>

        <button
          type="button"
          className="page-nav-btn"
          onClick={() => onSelect(Math.min(pages.length - 1, currentPageIndex + 1))}
          disabled={currentPageIndex >= pages.length - 1}
          aria-label="Next page"
          title="Next page"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="page-nav-divider" />

        <button
          type="button"
          className="page-nav-btn page-nav-btn-add"
          onClick={onAdd}
          aria-label="Add page"
          title="Add new page"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button
          type="button"
          className={`page-nav-btn page-nav-btn-menu ${expanded ? 'active' : ''}`}
          onClick={() => setExpanded(!expanded)}
          aria-label="More options"
          title="More options"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="8" cy="4" r="1" fill="currentColor"/>
            <circle cx="8" cy="8" r="1" fill="currentColor"/>
            <circle cx="8" cy="12" r="1" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* Expanded menu */}
      {expanded && (
        <div className="page-menu-expanded">
          <div className="page-menu-section">
            <div className="page-menu-label">Quick Actions</div>
            <button 
              type="button" 
              className="page-menu-item" 
              onClick={() => { onDuplicate(); setExpanded(false); }}
              disabled={pages.length === 0}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6V3C4 2.44772 4.44772 2 5 2H13C13.5523 2 14 2.44772 14 3V11C14 11.5523 13.5523 12 13 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <rect x="2" y="4" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              Duplicate Page
            </button>
            <button 
              type="button" 
              className="page-menu-item page-menu-item-danger" 
              onClick={() => { onDelete(); setExpanded(false); }}
              disabled={pages.length <= 1}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4H14M6 4V2H10V4M12 4V13C12 13.5523 11.5523 14 11 14H5C4.44772 14 4 13.5523 4 13V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Delete Page
            </button>
          </div>

          {pages.length > 1 && (
            <div className="page-menu-section">
              <div className="page-menu-label">Jump to Page</div>
              <div className="page-thumbnail-grid">
                {pages.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`page-thumbnail ${idx === currentPageIndex ? 'active' : ''}`}
                    onClick={() => { onSelect(idx); setExpanded(false); }}
                    title={`Page ${idx + 1}`}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PageControls
