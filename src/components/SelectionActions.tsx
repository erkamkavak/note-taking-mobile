import React, { useState } from 'react'
import type { CSSProperties } from 'react'

type Point = { x: number; y: number }

export type SelectionActionsProps = {
  position: Point
  scale: number
  activeColor: string | null
  colors: string[]
  onPickColor: (color: string) => void
  onCopy: () => void
  onShare: () => void
  onDelete: () => void
}

const DropletIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 2C12 2 5 9 5 13.5C5 17.09 7.91 20 11.5 20C15.09 20 18 17.09 18 13.5C18 9 12 2 12 2Z"/>
  </svg>
)

const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M16 1H4c-1.1 0-2 .9-2 2v12h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
  </svg>
)

const ShareIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.02-4.11a3 3 0 1 0-.97-1.76L8.03 9.54a3 3 0 1 0 0 4.92l6.93 4.02a3 3 0 1 0 1.04-2.4z"/>
  </svg>
)

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2z"/>
  </svg>
)

export const SelectionActions: React.FC<SelectionActionsProps> = ({
  position,
  scale,
  activeColor,
  colors,
  onPickColor,
  onCopy,
  onShare,
  onDelete,
}) => {
  const [showPalette, setShowPalette] = useState(false)

  const outerStyle: CSSProperties = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: `translate(-50%, calc(-100% - ${12 / Math.max(0.001, scale)}px))`,
    transformOrigin: 'top left',
    pointerEvents: 'auto',
    gap: '0',
  }

  const s = 1 / Math.max(0.001, scale)
  const clamped = Math.min(1.5, Math.max(0.5, s))
  const contentStyle: CSSProperties = {
    transform: `scale(${clamped})`,
    transformOrigin: 'top center',
  }

  const paletteStyle: CSSProperties = {
    position: 'absolute',
    // put size of content + 10px padding on top
    top: `calc(100% * ${s} + 10px)`,
    left: 0,
    right: 0,
    transform: `scale(${clamped})`,
    transformOrigin: 'top center',
    background: 'rgba(255, 255, 255, 0.96)',
    backdropFilter: 'blur(8px)',
    borderRadius: '12px',
    padding: '10px',
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.12)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
  }

  return (
    <div
      className="selection-actions"
      style={outerStyle}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="selection-actions__content compact" style={contentStyle}>
        <div className="selection-actions__toolbar">
          <button
            type="button"
            className="icon-btn"
            aria-label="Color"
            onClick={(e) => {
              e.stopPropagation()
              setShowPalette((v) => !v)
            }}
            style={{ color: activeColor ?? '#1c1c1e' }}
            title="Color"
          >
            <DropletIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation()
              onCopy()
            }}
            aria-label="Copy PNG"
            title="Copy PNG"
          >
            <CopyIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation()
              onShare()
            }}
            aria-label="Share"
            title="Share"
          >
            <ShareIcon />
          </button>
          <button
            type="button"
            className="icon-btn danger"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            aria-label="Delete"
            title="Delete"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
      {showPalette && (
        <div className="selection-actions__palette" style={paletteStyle}>
          {colors.map((c) => (
            <button
              key={`sel-color-${c}`}
              type="button"
              className={`selection-color${activeColor === c ? ' active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={(e) => {
                e.stopPropagation()
                onPickColor(c)
                setShowPalette(false)
              }}
              aria-label={`Change selection color to ${c}`}
              title={c}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default SelectionActions
