import { forwardRef } from 'react'

const PixelCanvas = forwardRef(({
  imageWidth,
  imageHeight,
  pixelSize,
  brushTool,
  onCanvasClick,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp,
  onMouseEnter,
  onMouseLeave,
  pixelData
}, ref) => {
  const getCursorStyle = () => {
    switch (brushTool) {
      case 'eyedropper':
        return 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23000\' d=\'M20.71 5.63l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l8.92-8.92 1.42 1.42 1.41-1.41-1.91-1.93 3.12-3.12c.4-.4.4-1.03 0-1.41zM6.92 19L5 17.08l8.06-8.06 1.92 1.92L6.92 19z\'/%3E%3C/svg%3E") 0 24, auto'
      case 'eraser':
        return 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23000\' d=\'M16.24 3.56l4.95 4.94c.78.79.78 2.05 0 2.84L12 20.53a4.008 4.008 0 0 1-5.66 0L2.81 17c-.78-.79-.78-2.05 0-2.84l10.6-10.6c.79-.78 2.05-.78 2.83 0M4.22 15.58l3.54 3.53c.78.79 2.04.79 2.83 0l3.53-3.53L4.22 15.58z\'/%3E%3C/svg%3E") 12 12, auto'
      case 'bucket':
        return 'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23000\' d=\'M12 2l3.09 6.26L22 9l-5 4.99L18.18 21 12 17.77 5.82 21 7 13.99 2 9l6.91-.74L12 2z\'/%3E%3C/svg%3E") 12 12, auto'
      case 'pen':
      default:
        return 'none'
    }
  }

  return (
    <div className="native-pixel-editor">
      <canvas 
        ref={ref}
        width={imageWidth * pixelSize || 1}
        height={imageHeight * pixelSize || 1}
        style={{
          border: '2px solid #999',
          cursor: getCursorStyle(),
          imageRendering: 'pixelated',
          minWidth: imageWidth * pixelSize > 0 ? 'auto' : '100px',
          minHeight: imageHeight * pixelSize > 0 ? 'auto' : '100px'
        }}
        onClick={onCanvasClick}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />
      {(!pixelData || pixelData.length === 0) && (
        <div className="png-empty-placeholder">
          <p>🎨 Load a .nitro file with PNG to start editing</p>
        </div>
      )}
    </div>
  )
})

PixelCanvas.displayName = 'PixelCanvas'

export default PixelCanvas