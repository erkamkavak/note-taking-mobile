import type { ComponentType } from 'react'

type PageSize = 'vertical' | 'horizontal' | 'square'

type IconProps = {
  className?: string
}

const createIcon = (path: string) => ({ className }: IconProps) => (
  <svg
    className={className}
    width={18}
    height={18}
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d={path} fill="currentColor" />
  </svg>
)

const PageVerticalIcon = createIcon(
  'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z',
)

const PageHorizontalIcon = createIcon(
  'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z',
)

const PageSquareIcon = createIcon(
  'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z',
)

const DownloadIcon = createIcon(
  'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
)

const FileTextIcon = createIcon(
  'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z',
)

const CloseIcon = createIcon(
  'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
)

type SettingsProps = {
  backgroundColor: string
  onBackgroundColorChange: (color: string) => void
  pageSize: PageSize
  onPageSizeChange: (size: PageSize) => void
  onExportPNG: () => void
  onExportPDF: () => Promise<void>
  onClose: () => void
}

const BACKGROUND_COLORS = ['#FAFAFA', '#1C1C1E', '#FFF6A1', '#CDE6FF', '#FFE5B9', '#FDD7FF', '#D4F4DD']

const PAGE_SIZE_LABELS: Record<PageSize, string> = {
  vertical: 'Vertical',
  horizontal: 'Horizontal',
  square: 'Square',
}

const Settings = ({
  backgroundColor,
  onBackgroundColorChange,
  pageSize,
  onPageSizeChange,
  onExportPNG,
  onExportPDF,
  onClose,
}: SettingsProps) => {
  const renderColorSwatches = (
    colors: string[],
    activeColor: string,
    onChange: (color: string) => void,
    labelPrefix: string,
  ) => (
    <div className="color-swatches">
      {colors.map((color) => (
        <button
          key={`${labelPrefix}-${color}`}
          type="button"
          className={`color-swatch${activeColor === color ? ' active' : ''}`}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
          aria-label={`Select ${labelPrefix} color ${color}`}
          aria-pressed={activeColor === color}
        />
      ))}
    </div>
  )

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-popup" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button
            type="button"
            className="settings-close-button"
            onClick={onClose}
            aria-label="Close settings"
          >
            <span className="button-icon">
              <CloseIcon />
            </span>
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-section">
            <span className="settings-section-label">Background</span>
            {renderColorSwatches(
              BACKGROUND_COLORS,
              backgroundColor,
              onBackgroundColorChange,
              'background',
            )}
          </div>

          <div className="settings-section">
            <span className="settings-section-label">Page Size</span>
            <div className="page-size-toggle">
              {Object.entries(PAGE_SIZE_LABELS).map(([value, label]) => {
                const Icon = value === 'vertical' ? PageVerticalIcon : 
                           value === 'horizontal' ? PageHorizontalIcon : PageSquareIcon
                return (
                  <button
                    key={value}
                    type="button"
                    className={`tool-button${pageSize === value ? ' active' : ''}`}
                    onClick={() => onPageSizeChange(value as PageSize)}
                    aria-pressed={pageSize === value}
                  >
                    <span className="button-icon">
                      <Icon />
                    </span>
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="settings-section">
            <span className="settings-section-label">Export</span>
            <div className="export-controls">
              <button
                type="button"
                className="ghost-button"
                onClick={onExportPNG}
                aria-label="Export as PNG"
              >
                <span className="button-icon">
                  <DownloadIcon />
                </span>
                <span>PNG</span>
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={onExportPDF}
                aria-label="Export as PDF"
              >
                <span className="button-icon">
                  <FileTextIcon />
                </span>
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
