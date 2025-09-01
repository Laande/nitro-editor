import { useRef } from 'react'

const PngEditorToolbar = ({
  brushTool,
  setBrushTool,
  undoStack,
  redoStack,
  onUndo,
  onRedo,
  brushColor,
  setBrushColor,
  pixelSize,
  setPixelSize,
  brushSize,
  setBrushSize,
  onDownload,
  onUpload
}) => {
  const pngFileInputRef = useRef(null)

  return (
    <div className="png-editor-toolbar">
      <div className="tool-group">
        <label>Herramientas:</label>
        <div className="tool-buttons">
          <button 
            className={`tool-btn ${brushTool === 'pen' ? 'active' : ''}`}
            onClick={() => setBrushTool('pen')}
            title="Brush"
          >
            ✏️
          </button>
          <button 
            className={`tool-btn ${brushTool === 'eraser' ? 'active' : ''}`}
            onClick={() => setBrushTool('eraser')}
            title="Eraser"
          >
            🧽
          </button>
          <button 
            className={`tool-btn ${brushTool === 'bucket' ? 'active' : ''}`}
            onClick={() => setBrushTool('bucket')}
            title="Paint bucket"
          >
            🪣
          </button>
          <button 
            className={`tool-btn ${brushTool === 'eyedropper' ? 'active' : ''}`}
            onClick={() => setBrushTool('eyedropper')}
            title="Eyedropper"
          >
            💧
          </button>
        </div>
      </div>
      
      <div className="tool-group">
        <label>Historial:</label>
        <button 
          className="tool-btn"
          onClick={onUndo}
          disabled={undoStack.length === 0}
          title="Undo (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button 
          className="tool-btn"
          onClick={onRedo}
          disabled={redoStack.length === 0}
          title="Redo (Ctrl+Y)"
        >
          ↷ Redo
        </button>
      </div>
      
      <div className="tool-group">
        <label>Color:</label>
        <input 
          type="color" 
          value={brushColor} 
          onChange={(e) => setBrushColor(e.target.value)}
        />
      </div>
      
      <div className="tool-group">
        <label>Zoom:</label>
        <input 
          type="range" 
          min="1" 
          max="10" 
          value={pixelSize} 
          onChange={(e) => setPixelSize(parseInt(e.target.value))}
        />
        <span>{pixelSize}x</span>
      </div>
      
      <div className="tool-group">
        <label>Brush size:</label>
        <input 
          type="range" 
          min="1" 
          max="10" 
          value={brushSize} 
          onChange={(e) => setBrushSize(parseInt(e.target.value))}
        />
        <span>{brushSize}px</span>
      </div>
      
      <div className="tool-group">
        <label>File:</label>
        <button 
          className="tool-btn"
          onClick={onDownload}
          title="Download edited PNG"
        >
          📥 Download
        </button>
        <input 
          type="file" 
          accept=".png" 
          onChange={onUpload}
          style={{display: 'none'}}
          ref={pngFileInputRef}
        />
        <button 
          className="tool-btn"
          onClick={() => pngFileInputRef.current?.click()}
          title="Reemplazar PNG actual"
        >
          📤 Upload
        </button>
      </div>
    </div>
  )
}

export default PngEditorToolbar