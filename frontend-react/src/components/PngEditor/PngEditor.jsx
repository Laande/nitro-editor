import { useState, useRef, useEffect } from 'react'
import PngEditorToolbar from './PngEditorToolbar'
import PixelCanvas from './PixelCanvas'

const PngEditor = ({ 
  fileInfo,
  pngData,
  pngLoading,
  pngError,
  pngSaving,
  onLoadPngData,
  onSavePngFromPixelData
}) => {
  // PNG Editor states
  const [brushTool, setBrushTool] = useState('pen')
  const [brushColor, setBrushColor] = useState('#000000')
  const [pixelData, setPixelData] = useState([])
  const [imageWidth, setImageWidth] = useState(0)
  const [imageHeight, setImageHeight] = useState(0)
  const [pixelSize, setPixelSize] = useState(1)
  const [brushSize, setBrushSize] = useState(1)
  const [cursorPosition, setCursorPosition] = useState({ x: -1, y: -1 })
  
  // Undo/Redo states
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const [maxHistorySize] = useState(50)
  const [showCursor, setShowCursor] = useState(false)
  
  // Drawing states
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokeStarted, setStrokeStarted] = useState(false)

  const canvasRef = useRef(null)
  const renderDebounceRef = useRef(null)

  // Drawing functions
  const drawTransparencyPattern = (ctx, width, height, pixelSize) => {
    const checkerSize = Math.max(8, pixelSize)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    
    ctx.fillStyle = '#e0e0e0'
    for (let y = 0; y < height; y += checkerSize) {
      for (let x = 0; x < width; x += checkerSize) {
        if ((Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2 === 1) {
          ctx.fillRect(x, y, checkerSize, checkerSize)
        }
      }
    }
  }

  const drawGrid = (ctx, width, height, pixelSize) => {
    if (pixelSize <= 2) return
    
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    
    for (let x = 0; x <= width; x += pixelSize) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    }
    
    for (let y = 0; y <= height; y += pixelSize) {
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
    }
    
    ctx.stroke()
  }

  const drawBrushPreview = (ctx, x, y, size, color) => {
    if (x < 0 || y < 0 || brushTool !== 'pen') return
    
    const radius = Math.floor(size / 2)
    ctx.fillStyle = color
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance <= radius) {
          const pixelX = (x + dx) * pixelSize
          const pixelY = (y + dy) * pixelSize
          ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize)
        }
      }
    }
  }

  const drawPixelData = (data) => {
    if (!canvasRef.current || !data) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawTransparencyPattern(ctx, canvas.width, canvas.height, pixelSize)
    
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const color = data[y][x]
        if (color !== 'transparent') {
          ctx.fillStyle = color
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)
        }
      }
    }
    
    drawGrid(ctx, canvas.width, canvas.height, pixelSize)
    
    if (showCursor && cursorPosition.x >= 0 && cursorPosition.y >= 0) {
      drawBrushPreview(ctx, cursorPosition.x, cursorPosition.y, brushSize, brushColor)
    }
  }

  // History functions
  const saveToHistory = (currentPixelData) => {
    if (!currentPixelData || currentPixelData.length === 0) return
    
    const stateCopy = currentPixelData.map(row => [...row])
    
    setUndoStack(prev => {
      const newStack = [...prev, stateCopy]
      if (newStack.length > maxHistorySize) {
        return newStack.slice(-maxHistorySize)
      }
      return newStack
    })
    
    setRedoStack([])
  }
  
  const undo = () => {
    if (undoStack.length === 0) return
    
    const currentState = pixelData.map(row => [...row])
    const previousState = undoStack[undoStack.length - 1]
    
    setRedoStack(prev => [...prev, currentState])
    setUndoStack(prev => prev.slice(0, -1))
    setPixelData(previousState)
    drawPixelData(previousState)
    
    if (renderDebounceRef.current) {
      clearTimeout(renderDebounceRef.current)
    }
    renderDebounceRef.current = setTimeout(() => {
      onSavePngFromPixelData(previousState)
    }, 1000)
  }
  
  const redo = () => {
    if (redoStack.length === 0) return
    
    const currentState = pixelData.map(row => [...row])
    const nextState = redoStack[redoStack.length - 1]
    
    setUndoStack(prev => [...prev, currentState])
    setRedoStack(prev => prev.slice(0, -1))
    setPixelData(nextState)
    drawPixelData(nextState)
    
    if (renderDebounceRef.current) {
      clearTimeout(renderDebounceRef.current)
    }
    renderDebounceRef.current = setTimeout(() => {
      onSavePngFromPixelData(nextState)
    }, 1000)
  }

  // Brush application
  const floodFill = (data, startX, startY, targetColor, fillColor) => {
    if (targetColor === fillColor) return
    
    const stack = [[startX, startY]]
    const visited = new Set()
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()
      const key = `${x},${y}`
      
      if (visited.has(key) || x < 0 || x >= imageWidth || y < 0 || y >= imageHeight) {
        continue
      }
      
      if (data[y][x] !== targetColor) {
        continue
      }
      
      visited.add(key)
      data[y][x] = fillColor
      
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
    }
  }

  const applyBrushAt = (newPixelData, centerX, centerY) => {
    switch (brushTool) {
      case 'pen':
      case 'eraser':
        const color = brushTool === 'pen' ? brushColor : 'transparent'
        const radius = Math.floor(brushSize / 2)
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const x = centerX + dx
            const y = centerY + dy
            
            if (x >= 0 && x < imageWidth && y >= 0 && y < imageHeight) {
              const distance = Math.sqrt(dx * dx + dy * dy)
              if (distance <= radius) {
                newPixelData[y][x] = color
              }
            }
          }
        }
        break
      case 'bucket':
        floodFill(newPixelData, centerX, centerY, pixelData[centerY][centerX], brushColor)
        break
    }
  }

  // Canvas event handlers
  const getCanvasCoordinates = (e) => {
    if (!canvasRef.current) return null
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    const centerX = Math.floor((e.clientX - rect.left) * scaleX / pixelSize)
    const centerY = Math.floor((e.clientY - rect.top) * scaleY / pixelSize)
    
    if (centerX < 0 || centerX >= imageWidth || centerY < 0 || centerY >= imageHeight) return null
    
    return { x: centerX, y: centerY }
  }

  const handleCanvasMouseDown = (e) => {
    if (!pixelData || !canvasRef.current) return
    
    const coords = getCanvasCoordinates(e)
    if (!coords) return
    
    if (brushTool === 'eyedropper') {
      const pickedColor = pixelData[coords.y][coords.x]
      if (pickedColor !== 'transparent') {
        setBrushColor(pickedColor)
      }
      return
    }
    
    if (!strokeStarted) {
      saveToHistory(pixelData)
      setStrokeStarted(true)
    }
    
    setIsDrawing(true)
    
    const newPixelData = [...pixelData]
    applyBrushAt(newPixelData, coords.x, coords.y)
    
    setPixelData(newPixelData)
    drawPixelData(newPixelData)
  }

  const handleCanvasMouseMove = (e) => {
    const coords = getCanvasCoordinates(e)
    if (!coords) {
      setShowCursor(false)
      setCursorPosition({ x: -1, y: -1 })
      return
    }
    
    setCursorPosition({ x: coords.x, y: coords.y })
    setShowCursor(true)
    
    if (isDrawing && (brushTool === 'pen' || brushTool === 'eraser')) {
      const newPixelData = [...pixelData]
      applyBrushAt(newPixelData, coords.x, coords.y)
      
      setPixelData(newPixelData)
      drawPixelData(newPixelData)
    }
  }

  const handleCanvasMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false)
      setStrokeStarted(false)
      
      if (renderDebounceRef.current) {
        clearTimeout(renderDebounceRef.current)
      }
      renderDebounceRef.current = setTimeout(() => {
        onSavePngFromPixelData(pixelData)
      }, 1000)
    }
  }

  const handleCanvasClick = (e) => {
    if (!pixelData || !canvasRef.current) return
    
    const coords = getCanvasCoordinates(e)
    if (!coords) return
    
    if (brushTool === 'bucket') {
      saveToHistory(pixelData)
      
      const newPixelData = [...pixelData]
      applyBrushAt(newPixelData, coords.x, coords.y)
      
      setPixelData(newPixelData)
      drawPixelData(newPixelData)
      
      if (renderDebounceRef.current) {
        clearTimeout(renderDebounceRef.current)
      }
      renderDebounceRef.current = setTimeout(() => {
        onSavePngFromPixelData(newPixelData)
      }, 1000)
    }
  }

  // File operations
  const downloadPng = () => {
    if (!canvasRef.current || !pixelData || pixelData.length === 0) {
      return
    }

    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    
    tempCanvas.width = imageWidth
    tempCanvas.height = imageHeight
    
    tempCtx.clearRect(0, 0, imageWidth, imageHeight)
    
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const color = pixelData[y][x]
        if (color !== 'transparent') {
          tempCtx.fillStyle = color
          tempCtx.fillRect(x, y, 1, 1)
        }
      }
    }
    
    tempCanvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${fileInfo?.name || 'edited'}_edited.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }, 'image/png')
  }

  const convertImageToPixelData = (imageElement) => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current || document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      canvas.width = imageElement.naturalWidth
      canvas.height = imageElement.naturalHeight
      
      ctx.drawImage(imageElement, 0, 0)
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const pixels = []
      
      for (let y = 0; y < canvas.height; y++) {
        const row = []
        for (let x = 0; x < canvas.width; x++) {
          const index = (y * canvas.width + x) * 4
          const r = imageData.data[index]
          const g = imageData.data[index + 1]
          const b = imageData.data[index + 2]
          const a = imageData.data[index + 3]
          
          const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
          
          row.push(a === 0 ? 'transparent' : hex)
        }
        pixels.push(row)
      }
      
      resolve({
        pixels,
        width: canvas.width,
        height: canvas.height
      })
    })
  }

  const handlePngUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/png')) {
      return
    }

    try {
      const img = new Image()
      img.onload = async () => {
        try {
          const result = await convertImageToPixelData(img)
          setPixelData(result.pixels)
          setImageWidth(result.width)
          setImageHeight(result.height)
          
          setTimeout(() => {
            drawPixelData(result.pixels)
            onSavePngFromPixelData(result.pixels)
          }, 100)
          
        } catch (error) {
          console.error('Error processing image:', error)
        }
      }
      
      const reader = new FileReader()
      reader.onload = (e) => {
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
      
    } catch (error) {
      console.error('Error loading file:', error)
    }
    
    e.target.value = ''
  }

  // Load PNG data when component mounts or fileInfo changes
  const loadPngData = async () => {
    if (!fileInfo) return
    
    try {
      const response = await fetch(`/api/png/${fileInfo.name}`)
      
      if (response.ok) {
        const blob = await response.blob()
        const imageUrl = URL.createObjectURL(blob)
        
        const img = new Image()
        img.onload = async () => {
          const result = await convertImageToPixelData(img)
          setPixelData(result.pixels)
          setImageWidth(result.width)
          setImageHeight(result.height)
          setTimeout(() => drawPixelData(result.pixels), 100)
        }
        img.src = imageUrl
      }
    } catch (error) {
      console.error('Error loading PNG:', error)
    }
  }

  // Effects
  useEffect(() => {
    if (fileInfo) {
      loadPngData()
      setUndoStack([])
      setRedoStack([])
    } else {
      setUndoStack([])
      setRedoStack([])
    }
  }, [fileInfo])

  useEffect(() => {
    if (pixelData && pixelData.length > 0) {
      drawPixelData(pixelData)
    }
  }, [pixelData, pixelSize, imageWidth, imageHeight, cursorPosition, showCursor, brushSize, brushColor, brushTool])

  useEffect(() => {
    if (isDrawing) {
      document.addEventListener('mouseup', handleCanvasMouseUp)
      
      return () => {
        document.removeEventListener('mouseup', handleCanvasMouseUp)
      }
    }
  }, [isDrawing, pixelData])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!fileInfo || !pixelData || pixelData.length === 0) return
      
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'Z')) {
        e.preventDefault()
        redo()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [fileInfo, pixelData, undoStack, redoStack])

  if (!fileInfo) return null

  return (
    <div className="png-editor-section">
      <div className="png-editor-header">
        <div className="png-title">
          <h3>🎨 Editor PNG</h3>
          <div className="png-status">
            {pngLoading && <span className="png-loading">📥 Cargando...</span>}
            {pngSaving && <span className="png-saving">💾 Guardando...</span>}
            {!pngLoading && !pngSaving && pngData && (
              <span className="png-ready">✅ Listo</span>
            )}
          </div>
        </div>
        {pngError && <div className="png-error">{pngError}</div>}
      </div>
      
      <div className="png-editor-container">
        {pngLoading && (
          <div className="png-loading-placeholder">
            <p>📥 Cargando PNG...</p>
          </div>
        )}
        
        {!pngLoading && pngError && (
          <div className="png-error-placeholder">
            <p>❌ Error loading PNG</p>
            <button onClick={onLoadPngData} className="retry-btn">🔄 Retry</button>
          </div>
        )}
        
        {!pngLoading && !pngError && pngData && (
          <div className="png-editor-container">
            <PngEditorToolbar
              brushTool={brushTool}
              setBrushTool={setBrushTool}
              undoStack={undoStack}
              redoStack={redoStack}
              onUndo={undo}
              onRedo={redo}
              brushColor={brushColor}
              setBrushColor={setBrushColor}
              pixelSize={pixelSize}
              setPixelSize={setPixelSize}
              brushSize={brushSize}
              setBrushSize={setBrushSize}
              onDownload={downloadPng}
              onUpload={handlePngUpload}
            />
            <PixelCanvas
              ref={canvasRef}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              pixelSize={pixelSize}
              brushTool={brushTool}
              onCanvasClick={handleCanvasClick}
              onCanvasMouseDown={handleCanvasMouseDown}
              onCanvasMouseMove={handleCanvasMouseMove}
              onCanvasMouseUp={handleCanvasMouseUp}
              onMouseEnter={() => setShowCursor(true)}
              onMouseLeave={() => {
                setShowCursor(false)
                setCursorPosition({ x: -1, y: -1 })
              }}
              pixelData={pixelData}
            />
          </div>
        )}
        
        {!pngLoading && !pngError && !pngData && (
          <div className="png-empty-placeholder">
            <p>📄 No PNG found in .nitro file</p>
          </div>
        )}
      </div>
      
      <div className="png-editor-info">
        <p>💡 Use the tools to edit the pixel art. Changes are saved automatically.</p>
      </div>
    </div>
  )
}

export default PngEditor