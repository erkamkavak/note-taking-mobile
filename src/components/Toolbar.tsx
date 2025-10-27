import type { ComponentType } from 'react'
import { useState } from 'react'

type ToolType = 'pen' | 'highlighter' | 'eraser' | 'selector'

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

const PenIcon = createIcon(
  'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
)

const HighlighterIcon = createIcon(
  'M3 16.5 9 10.5l4 4L7 20.5H3v-4zm11.44-10.94 2.12-2.12 5 5-2.12 2.12z',
)

const EraserIcon = createIcon(
  'M16.24 3.56a2 2 0 0 0-2.83 0L2 15l5 5h6.17l8.07-8.07a2 2 0 0 0 0-2.83l-4.83-4.83zM7.5 18 4.41 14.91l6.36-6.36 3.09 3.09L7.5 18zm7.67 0h-3.18l2.38-2.38 1.59 1.59z',
)

const LassoIcon = createIcon(
  'M12 5c-4.42 0-8 3.13-8 7s3.58 7 8 7c.86 0 1.69-.12 2.47-.34l1.53 1.53A1 1 0 0 0 17 20v-2a7.5 7.5 0 0 0 3-5.5c0-3.87-3.58-7-8-7zm0 12c-3.31 0-6-2.24-6-5s2.69-5 6-5 6 2.24 6 5c0 1.24-.46 2.39-1.24 3.34l1.24 1.24v.42a5.51 5.51 0 0 1-2 .41 3 3 0 1 1 0-6 1 1 0 1 0 0-2 5 5 0 0 0-5 5c0 1.6.87 3 2.18 3.85A4.97 4.97 0 0 1 12 17z',
)

const UndoIcon = createIcon(
  'M12 5V2L7 7l5 5V9c3.31 0 6 2.69 6 6 0 1.1-.28 2.13-.78 3.03l1.46 1.46C19.54 18.05 20 16.57 20 15c0-4.42-3.58-8-8-8z',
)

const RedoIcon = createIcon(
  'M12 5V2l5 5-5 5V9c-3.31 0-6 2.69-6 6 0 1.1.28 2.13.78 3.03l-1.46 1.46C4.46 18.05 4 16.57 4 15c0-4.42 3.58-8 8-8z',
)

const ZoomInIcon = createIcon(
  'M11 4a7 7 0 1 1-4.95 11.95l-3.4 3.4-1.41-1.41 3.4-3.4A7 7 0 1 1 11 4zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm1 2v2h2v2h-2v2h-2v-2H8v-2h2V8h2z',
)

const ZoomOutIcon = createIcon(
  'M11 4a7 7 0 1 1-4.95 11.95l-3.4 3.4-1.41-1.41 3.4-3.4A7 7 0 1 1 11 4zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm-3 4h6v2H8z',
)

const ZoomResetIcon = createIcon(
  'M12 4a8 8 0 1 1-5.66 13.66l1.41-1.41A6 6 0 1 0 12 6v2l-5-5 5-5v2a10 10 0 1 1-7.07 17.07l1.41-1.41A8 8 0 0 1 12 4z',
)

const GalleryIcon = createIcon(
  'M4 5h6v6H4zm10 0h6v6h-6zM4 13h6v6H4zm10 0h6v6h-6z',
)

const CollapseIcon = createIcon(
  'M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z',
)

const ExpandIcon = createIcon(
  'M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z',
)

const SettingsIcon = createIcon(
  'M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z',
)

const toolIconMap: Record<ToolType, ComponentType<IconProps>> = {
  pen: PenIcon,
  highlighter: HighlighterIcon,
  eraser: EraserIcon,
  selector: LassoIcon,
}

type ToolbarProps = {
  currentNoteTitle: string
  tool: ToolType
  onToolChange: (tool: ToolType) => void
  penColor: string
  onPenColorChange: (color: string) => void
  penSize: number
  onPenSizeChange: (size: number) => void
  highlighterColor: string
  onHighlighterColorChange: (color: string) => void
  highlighterSize: number
  onHighlighterSizeChange: (size: number) => void
  highlighterOpacity: number
  onHighlighterOpacityChange: (value: number) => void
  eraserSize: number
  onEraserSizeChange: (size: number) => void
  availableColors: {
    pen: string[]
    highlighter: string[]
  }
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onBack: () => void
  onSettingsClick: () => void
  hasPenInput?: boolean
}

const TOOL_LABELS: Record<ToolType, string> = {
  pen: 'Pen',
  highlighter: 'Highlighter',
  eraser: 'Eraser',
  selector: 'Lasso',
}

const Toolbar = ({
  currentNoteTitle,
  tool,
  onToolChange,
  penColor,
  onPenColorChange,
  penSize,
  onPenSizeChange,
  highlighterColor,
  onHighlighterColorChange,
  highlighterSize,
  onHighlighterSizeChange,
  highlighterOpacity,
  onHighlighterOpacityChange,
  eraserSize,
  onEraserSizeChange,
  availableColors,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onBack,
  onSettingsClick,
  hasPenInput,
}: ToolbarProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
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

  const showColorPicker = tool !== 'eraser' && tool !== 'selector'

  const thicknessConfig = (() => {
    if (tool === 'highlighter') {
      return {
        label: 'Highlight Width',
        value: highlighterSize,
        min: 8,
        max: 40,
        onChange: onHighlighterSizeChange,
      }
    }
    if (tool === 'eraser') {
      return {
        label: 'Eraser Size',
        value: eraserSize,
        min: 8,
        max: 48,
        onChange: onEraserSizeChange,
      }
    }
    if (tool === 'selector') {
      return null
    }
    return {
      label: 'Pen Thickness',
      value: penSize,
      min: 1,
      max: 18,
      onChange: onPenSizeChange,
    }
  })()

  const toolButtons: Array<{ value: ToolType; label: string; Icon: ComponentType<IconProps> }> =
    Object.entries(TOOL_LABELS).map(([value, label]) => ({
      value: value as ToolType,
      label,
      Icon: toolIconMap[value as ToolType],
    }))

  return (
    <div className={`toolbar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="toolbar-header">
        <button type="button" className="toolbar-back-button" onClick={onBack}>
          <span className="button-icon">
            <GalleryIcon />
          </span>
          {!isCollapsed && <span>Gallery</span>}
        </button>
        <button 
          type="button" 
          className="toolbar-collapse-button" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand toolbar' : 'Collapse toolbar'}
        >
          <span className="button-icon">
            {isCollapsed ? <ExpandIcon /> : <CollapseIcon />}
          </span>
        </button>
      </div>
      
      {!isCollapsed && (
        <>
          <div className="toolbar-title-bar">
            <span className="toolbar-note-title">{currentNoteTitle}</span>
          </div>

          <div className="toolbar-section">
            <button 
              type="button" 
              className="ghost-button toolbar-settings-main-button" 
              onClick={onSettingsClick}
              aria-label="Open settings"
            >
              <span className="button-icon">
                <SettingsIcon />
              </span>
              <span>Settings</span>
            </button>
          </div>

          {hasPenInput ? (
            <div className="pen-mode-indicator">
              <svg width="14" height="14" viewBox="0 0 24 24" style={{marginRight: '6px'}}>
                <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
              </svg>
              Pen-only mode active
            </div>
          ) : null}

          <div className="toolbar-section">
            <span className="toolbar-section-label">Tools</span>
            <div className="tool-toggle">
              {toolButtons.map(({ value, label, Icon }) => {
                return (
                  <button
                    key={value}
                    type="button"
                    className={`tool-button${tool === value ? ' active' : ''}`}
                    onClick={() => onToolChange(value as ToolType)}
                    aria-pressed={tool === value}
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

          {showColorPicker ? (
            <div className="toolbar-section">
              <span className="toolbar-section-label">
                {tool === 'highlighter' ? 'Highlight Color' : 'Pen Color'}
              </span>
              {tool === 'highlighter'
                ? renderColorSwatches(
                    availableColors.highlighter,
                    highlighterColor,
                    onHighlighterColorChange,
                    'highlighter',
                  )
                : renderColorSwatches(availableColors.pen, penColor, onPenColorChange, 'pen')}
            </div>
          ) : null}

          {thicknessConfig ? (
            <div className="toolbar-section">
              <label className="toolbar-section-label" htmlFor="thickness-control">
                {thicknessConfig.label}
                <span className="weight-value">{thicknessConfig.value}px</span>
              </label>
              <input
                id="thickness-control"
                type="range"
                min={thicknessConfig.min}
                max={thicknessConfig.max}
                step={1}
                value={thicknessConfig.value}
                onChange={(event) => thicknessConfig.onChange(Number(event.target.value))}
                className="thickness-slider"
              />
            </div>
          ) : (
            <div className="toolbar-section selector-hint">
              <span className="toolbar-section-label">Lasso Tips</span>
              <p>Trace a polygon and release to move a selection.</p>
            </div>
          )}

          {tool === 'highlighter' ? (
            <div className="toolbar-section">
              <label className="toolbar-section-label" htmlFor="highlight-opacity-control">
                Highlight Opacity
                <span className="weight-value">{Math.round(highlighterOpacity * 100)}%</span>
              </label>
              <input
                id="highlight-opacity-control"
                type="range"
                min={0.1}
                max={1}
                step={0.02}
                value={highlighterOpacity}
                onChange={(event) => onHighlighterOpacityChange(Number(event.target.value))}
                className="thickness-slider"
              />
            </div>
          ) : null}

          <div className="toolbar-section">
            <span className="toolbar-section-label">History</span>
            <div className="history-controls">
              <button
                type="button"
                className="ghost-button"
                onClick={onUndo}
                disabled={!canUndo}
              >
                <span className="button-icon">
                  <UndoIcon />
                </span>
                <span>Undo</span>
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={onRedo}
                disabled={!canRedo}
              >
                <span className="button-icon">
                  <RedoIcon />
                </span>
                <span>Redo</span>
              </button>
            </div>
          </div>

          <div className="toolbar-section">
            <span className="toolbar-section-label">Zoom</span>
            <div className="zoom-controls">
              <button
                type="button"
                className="ghost-button"
                onClick={onZoomOut}
                aria-label="Zoom out"
              >
                <span className="button-icon">
                  <ZoomOutIcon />
                </span>
              </button>
              <span className="zoom-label">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className="ghost-button"
                onClick={onZoomIn}
                aria-label="Zoom in"
              >
                <span className="button-icon">
                  <ZoomInIcon />
                </span>
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={onZoomReset}
                aria-label="Reset zoom"
              >
                <span className="button-icon">
                  <ZoomResetIcon />
                </span>
                <span>Reset</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Toolbar
