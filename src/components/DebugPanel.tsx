import type { FC } from 'react'

type PointerEventLog = {
  type: string
  pointerType: string
  time: number
}

type DebugPanelProps = {
  debugInfo: {
    userAgent: string
    maxTouchPoints: number
    pointerFine: boolean
    pointerCoarse: boolean
    pointerNone: boolean
    hasAnyPointer: boolean
    hasCoarsePointer: boolean
    platform: string
    vendor: string
  }
  hasPenInput: boolean
  isMobile: boolean
  recentPointerEvents: PointerEventLog[]
}

const DebugPanel: FC<DebugPanelProps> = ({
  debugInfo,
  hasPenInput,
  isMobile,
  recentPointerEvents,
}) => (
  <div
    style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      color: '#00ff00',
      padding: '12px',
      borderRadius: '8px',
      fontSize: '11px',
      fontFamily: 'monospace',
      maxWidth: '320px',
      maxHeight: '400px',
      overflow: 'auto',
      zIndex: 9999,
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
    }}
  >
    <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#00ffff' }}>
      🔍 INPUT DEBUG PANEL
    </div>
    <div style={{ marginBottom: '8px' }}>
      <div>
        <strong>hasPenInput:</strong>{' '}
        <span style={{ color: hasPenInput ? '#00ff00' : '#ff0000' }}>
          {hasPenInput.toString()}
        </span>
      </div>
      <div>
        <strong>isMobile:</strong>{' '}
        <span style={{ color: isMobile ? '#00ff00' : '#ff0000' }}>
          {isMobile.toString()}
        </span>
      </div>
      <div>
        <strong>maxTouchPoints:</strong> {debugInfo.maxTouchPoints}
      </div>
    </div>
    <div style={{ marginBottom: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
      <div>
        <strong>pointer: fine</strong> ={' '}
        <span style={{ color: debugInfo.pointerFine ? '#00ff00' : '#ff0000' }}>
          {debugInfo.pointerFine.toString()}
        </span>
      </div>
      <div>
        <strong>pointer: coarse</strong> ={' '}
        <span style={{ color: debugInfo.pointerCoarse ? '#00ff00' : '#ff0000' }}>
          {debugInfo.pointerCoarse.toString()}
        </span>
      </div>
      <div>
        <strong>pointer: none</strong> ={' '}
        <span style={{ color: debugInfo.pointerNone ? '#00ff00' : '#ff0000' }}>
          {debugInfo.pointerNone.toString()}
        </span>
      </div>
      <div>
        <strong>any-pointer: fine</strong> ={' '}
        <span style={{ color: debugInfo.hasAnyPointer ? '#00ff00' : '#ff0000' }}>
          {debugInfo.hasAnyPointer.toString()}
        </span>
      </div>
      <div>
        <strong>any-pointer: coarse</strong> ={' '}
        <span style={{ color: debugInfo.hasCoarsePointer ? '#00ff00' : '#ff0000' }}>
          {debugInfo.hasCoarsePointer.toString()}
        </span>
      </div>
    </div>
    <div
      style={{
        marginBottom: '8px',
        paddingTop: '8px',
        borderTop: '1px solid #333',
        fontSize: '10px',
      }}
    >
      <div>
        <strong>Platform:</strong> {debugInfo.platform}
      </div>
      <div>
        <strong>Vendor:</strong> {debugInfo.vendor}
      </div>
    </div>
    <div style={{ paddingTop: '8px', borderTop: '1px solid #333' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#ffff00' }}>
        Recent Pointer Events:
      </div>
      {recentPointerEvents.length === 0 ? (
        <div style={{ color: '#666' }}>No events yet</div>
      ) : (
        recentPointerEvents.map((event, idx) => (
          <div key={idx} style={{ marginBottom: '2px' }}>
            <span style={{ color: '#888' }}>
              {new Date(event.time).toLocaleTimeString()}
            </span>
            {' - '}
            <span style={{ color: '#fff' }}>{event.type}</span>
            {' ['}
            <span
              style={{
                color:
                  event.pointerType === 'pen'
                    ? '#00ff00'
                    : event.pointerType === 'touch'
                      ? '#ff9900'
                      : '#00ffff',
              }}
            >
              {event.pointerType}
            </span>
            {']'}
          </div>
        ))
      )}
    </div>
  </div>
)

export default DebugPanel
