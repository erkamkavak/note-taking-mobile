import type { Page } from '../types/note'

type PageControlsProps = {
  pages: Page[]
  currentPageIndex: number
  onSelect: (index: number) => void
  onAdd: () => void
  onDuplicate: () => void
  onDelete: () => void
  onExportPage?: () => void
}

const PageControls = ({
  pages,
  currentPageIndex,
  onSelect,
  onAdd,
  onDuplicate,
  onDelete,
  onExportPage,
}: PageControlsProps) => {
  return (
    <div className="page-controls">
      <div className="page-controls-header">
        <span className="page-controls-title">Pages</span>
        <span className="page-controls-count">
          {pages.length > 0 ? `${currentPageIndex + 1} / ${pages.length}` : '0 / 0'}
        </span>
      </div>

      <div className="page-controls-row">
        <button
          type="button"
          className="icon-button"
          onClick={() => onSelect(Math.max(0, currentPageIndex - 1))}
          disabled={currentPageIndex <= 0}
          aria-label="Previous page"
        >
          ‹
        </button>
        <div className="page-list">
          {pages.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              className={`page-pill${idx === currentPageIndex ? ' active' : ''}`}
              onClick={() => onSelect(idx)}
              aria-pressed={idx === currentPageIndex}
            >
              {idx + 1}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => onSelect(Math.min(pages.length - 1, currentPageIndex + 1))}
          disabled={currentPageIndex >= pages.length - 1}
          aria-label="Next page"
        >
          ›
        </button>
      </div>

      <div className="page-actions">
        <div className="page-actions-left">
          <button type="button" className="ghost-button" onClick={onAdd}>Add Page</button>
          <button type="button" className="ghost-button" onClick={onDuplicate} disabled={pages.length === 0}>Duplicate</button>
          <button type="button" className="ghost-button danger" onClick={onDelete} disabled={pages.length <= 1}>Delete</button>
        </div>
        {/* <div className="page-actions-right">
          {onExportPage ? (
            <button type="button" className="ghost-button" onClick={onExportPage}>Export PNG</button>
          ) : null}
        </div> */}
      </div>
    </div>
  )
}

export default PageControls
