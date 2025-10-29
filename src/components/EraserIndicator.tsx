import React from 'react'

export type EraserIndicatorProps = {
  x: number
  y: number
  sizePx: number
  active: boolean
}

const EraserIndicator: React.FC<EraserIndicatorProps> = ({ x, y, sizePx, active }) => {
  return (
    <div
      className={`eraser-indicator${active ? ' is-active' : ''}`}
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        width: `${sizePx}px`,
        height: `${sizePx}px`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
      aria-hidden
    />
  )
}

export default EraserIndicator
