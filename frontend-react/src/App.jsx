import { useState, useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import './App.css'

/* CSS Styles for disabled buttons */
const styles = `
  .tool-btn {
    padding: 8px 12px;
    border: 1px solid #ddd;
    background: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    margin-right: 8px;
  }
  .tool-btn:hover {
    background: #f0f0f0;
  }
  .tool-btn.active {
    background: #007bff;
    color: white;
    border-color: #007bff;
  }
  .tool-btn:disabled {
    background: #f8f9fa;
    color: #6c757d;
    border-color: #dee2e6;
    cursor: not-allowed;
    opacity: 0.6;
  }
  .tool-btn:disabled:hover {
    background: #f8f9fa;
  }
`;

// Inject styles into document head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}

function App() {
  const [fileInfo, setFileInfo] = useState(null)
  const [selectedDirection, setSelectedDirection] = useState(null)
  const [selectedState, setSelectedState] = useState(null)
  const [selectedColor, setSelectedColor] = useState(null)
  const [renderedGif, setRenderedGif] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [jsonContent, setJsonContent] = useState('')
  // Removed showJsonEditor state - JSON editor is always visible when file is loaded
  const [jsonSaving, setJsonSaving] = useState(false)
  const [jsonValid, setJsonValid] = useState(true)
  const [jsonError, setJsonError] = useState('')
  
  // PNG Editor states
  const [pngData, setPngData] = useState(null)
  const [pngLoading, setPngLoading] = useState(false)
  const [pngError, setPngError] = useState('')
  const [pngSaving, setPngSaving] = useState(false)
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
  const [maxHistorySize] = useState(50) // Límite de historial para evitar uso excesivo de memoria
  const [showCursor, setShowCursor] = useState(false)
  
  // Drawing states for stroke tracking
  const [isDrawing, setIsDrawing] = useState(false)
  const [strokeStarted, setStrokeStarted] = useState(false)
  

  
  // Simplified states - only the essentials
  
  // Drag states for gif container
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState({ x: 'center', y: 'center' })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const canvasRef = useRef(null)
  const renderDebounceRef = useRef(null)
  const gifContainerRef = useRef(null)
  const jsonDebounceRef = useRef(null)
  const fileInputRef = useRef(null)
  const pngFileInputRef = useRef(null)

  const handleFileUpload = async (file, autoRender = false) => {
    if (!file || !file.name.endsWith('.nitro')) {
      setError('Please select a valid .nitro file')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      setLoading(true)
      setError('')
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      
      if (response.ok) {
        setFileInfo(result.info)
        setSelectedDirection(result.info.directions[0])
        setSelectedState(result.info.states[0])
        setSelectedColor(result.info.colors[0])
        setSuccess('File uploaded successfully')
        
        // Load JSON content
        loadJsonContent(result.info.name)
        
        if (autoRender) {
          setTimeout(() => {
            renderGIF(result.info.directions[0], result.info.states[0], result.info.colors[0], result.info.name)
          }, 500)
        }
      } else {
        setError(result.error || 'Error uploading file')
      }
    } catch (err) {
      setError('Error de conexión: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const renderGIF = async (direction = selectedDirection, state = selectedState, color = selectedColor, filename = fileInfo?.name) => {
    if (!filename) return

    try {
      setLoading(true)
      setError('')
      
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename,
          direction: parseInt(direction),
          state: parseInt(state),
          color: parseInt(color),
          size: 64
        })
      })

      const result = await response.json()
      
      if (response.ok) {
        // Agregar timestamp para evitar cache del navegador
        const gifUrlWithTimestamp = result.gif_url + '?t=' + Date.now()
        setRenderedGif(gifUrlWithTimestamp)
        setSuccess('GIF renderizado correctamente')
      } else {
        setError(result.error || 'Error rendering')
      }
    } catch (err) {
      setError('Error de conexión: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const autoRenderWithDebounce = (direction = selectedDirection, state = selectedState, color = selectedColor) => {
    if (renderDebounceRef.current) {
      clearTimeout(renderDebounceRef.current)
    }
    renderDebounceRef.current = setTimeout(() => {
      renderGIF(direction, state, color)
    }, 150)
  }

  const handleControlChange = (type, value) => {
    let newDirection = selectedDirection
    let newState = selectedState
    let newColor = selectedColor
    
    if (type === 'direction') {
      newDirection = value
      setSelectedDirection(value)
    } else if (type === 'state') {
      newState = value
      setSelectedState(value)
    } else if (type === 'color') {
      newColor = value
      setSelectedColor(value)
    }
    
    autoRenderWithDebounce(newDirection, newState, newColor)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0], true)
    }
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      handleFileUpload(file, true)
    }
  }

  const loadJsonContent = async (filename) => {
    try {
      const response = await fetch(`/api/json/${filename}`)
      
      if (response.ok) {
        const jsonText = await response.text()
        setJsonContent(jsonText)
        setJsonError('')
      } else {
        setJsonError('Error loading JSON content')
      }
    } catch (error) {
      setJsonError('Error loading JSON content')
    }
  }

  const refreshFileInfo = async () => {
    if (!fileInfo) return
    
    try {
      const response = await fetch(`/api/info/${fileInfo.name}`)
      
      if (response.ok) {
        const updatedInfo = await response.json()
        setFileInfo(updatedInfo)
        
        // Update selected values if they're no longer available
        if (!updatedInfo.directions.includes(selectedDirection)) {
          setSelectedDirection(updatedInfo.directions[0])
        }
        if (!updatedInfo.states.includes(selectedState)) {
          setSelectedState(updatedInfo.states[0])
        }
        if (!updatedInfo.colors.includes(selectedColor)) {
          setSelectedColor(updatedInfo.colors[0])
        }
      }
    } catch (error) {
      console.error('Error refreshing file info:', error)
    }
  }

  const saveJsonContent = async (content) => {
    if (!fileInfo) return
    
    setJsonSaving(true)
    
    try {
      const response = await fetch(`/api/json/${fileInfo.name}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: content
      })
      
      const result = await response.json()
      
      if (response.ok) {
        setJsonError('')
        setSuccess('JSON guardado y aplicado correctamente')
        
        // Refresh file info to update available directions, states, and colors
        await refreshFileInfo()
        
        // Trigger immediate re-render with current settings after JSON save
        renderGIF()
      } else {
        setJsonError('Error saving JSON content')
      }
    } catch (error) {
      setJsonError('Invalid JSON or error saving')
    } finally {
      setJsonSaving(false)
    }
  }

  const validateJson = (content) => {
    try {
      JSON.parse(content)
      return { isValid: true, error: null }
    } catch (error) {
      return { 
        isValid: false, 
        error: `Error en línea ${error.message.includes('position') ? 
          error.message.match(/position (\d+)/)?.[1] || 'desconocida' : 
          'desconocida'}: ${error.message}`
      }
    }
  }

  const handleJsonChange = (content) => {
    setJsonContent(content)
    
    // Validate JSON in real-time
    const validation = validateJson(content)
    
    if (!validation.isValid) {
      setJsonError(`JSON inválido: ${validation.error}`)
      setJsonValid(false)
      return
    }
    
    // Clear JSON error if valid
    setJsonError('')
    setJsonValid(true)
  }

  // Function to export .nitro file with modifications
  const handleExportNitro = async () => {
    if (!fileInfo) return
    
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch(`/api/export/${fileInfo.name}`)
      
      if (response.ok) {
        // Create a blob with the file data
        const blob = await response.blob()
        
        // Crear un enlace de descarga
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${fileInfo.name.replace('.nitro', '')}_modified.nitro`
        document.body.appendChild(a)
        a.click()
        
        // Limpiar
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        setSuccess('.nitro file exported successfully')
      } else {
        const result = await response.json()
        setError(result.error || 'Error exporting file')
      }
    } catch (err) {
      setError('Error de conexión: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // Function to load detailed information
  // Funciones simplificadas - overlays removidos

  const handleUpdateRender = async () => {
    if (!jsonValid || !fileInfo) return
    
    // First save the JSON content
    await saveJsonContent(jsonContent)
  }

  const clearMessages = () => {
    setTimeout(() => {
      setError('')
      setSuccess('')
      setPngError('')
    }, 5000)
  }

  // Drag functionality for gif container
  const handleMouseDown = (e) => {
    if (!gifContainerRef.current || !renderedGif) return
    
    const rect = gifContainerRef.current.getBoundingClientRect()
    const viewerRect = gifContainerRef.current.parentElement.getBoundingClientRect()
    
    setIsDragging(true)
    // Calculate offset from mouse position to center of gif container
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    setDragOffset({
      x: e.clientX - centerX,
      y: e.clientY - centerY
    })
    
    e.preventDefault()
  }

  const handleMouseMove = (e) => {
    if (!isDragging || !gifContainerRef.current) return
    
    const viewerRect = gifContainerRef.current.parentElement.getBoundingClientRect()
    const containerRect = gifContainerRef.current.getBoundingClientRect()
    
    // Calculate new position based on mouse position and center offset
    const newCenterX = e.clientX - dragOffset.x
    const newCenterY = e.clientY - dragOffset.y
    
    // Convert center position to top-left position
    const newX = newCenterX - viewerRect.left - containerRect.width / 2
    const newY = newCenterY - viewerRect.top - containerRect.height / 2
    
    // Constrain within viewer bounds
    const maxX = viewerRect.width - containerRect.width
    const maxY = viewerRect.height - containerRect.height
    
    const constrainedX = Math.max(0, Math.min(newX, maxX))
    const constrainedY = Math.max(0, Math.min(newY, maxY))
    
    setDragPosition({ x: constrainedX, y: constrainedY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  // Add global mouse event listeners for drawing
  useEffect(() => {
    if (isDrawing) {
      document.addEventListener('mouseup', handleCanvasMouseUp)
      
      return () => {
        document.removeEventListener('mouseup', handleCanvasMouseUp)
      }
    }
  }, [isDrawing, pixelData])

  // Center the gif when it loads for the first time
  useEffect(() => {
    if (renderedGif && gifContainerRef.current && (dragPosition.x === 'center' || dragPosition.y === 'center')) {
      const container = gifContainerRef.current
      const viewer = container.parentElement
      
      if (viewer) {
        const viewerRect = viewer.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        
        const centerX = (viewerRect.width - containerRect.width) / 2
        const centerY = (viewerRect.height - containerRect.height) / 2
        
        setDragPosition({ x: Math.max(0, centerX), y: Math.max(0, centerY) })
      }
    }
  }, [renderedGif])

  // useEffect para resize removido - overlays eliminados

  // Undo/Redo functions
  const saveToHistory = (currentPixelData) => {
    if (!currentPixelData || currentPixelData.length === 0) return
    
    // Create a deep copy of the current state
    const stateCopy = currentPixelData.map(row => [...row])
    
    setUndoStack(prev => {
      const newStack = [...prev, stateCopy]
      // Limit history size
      if (newStack.length > maxHistorySize) {
        return newStack.slice(-maxHistorySize)
      }
      return newStack
    })
    
    // Limpiar el stack de redo cuando se hace una nueva acción
    setRedoStack([])
  }
  
  const undo = () => {
    if (undoStack.length === 0) return
    
    const currentState = pixelData.map(row => [...row])
    const previousState = undoStack[undoStack.length - 1]
    
    // Move current state to redo stack
    setRedoStack(prev => [...prev, currentState])
    
    // Remove last state from undo stack
    setUndoStack(prev => prev.slice(0, -1))
    
    // Apply previous state
    setPixelData(previousState)
    drawPixelData(previousState)
    
    // Save automatically
    if (renderDebounceRef.current) {
      clearTimeout(renderDebounceRef.current)
    }
    renderDebounceRef.current = setTimeout(() => {
      savePngFromPixelData(previousState)
    }, 1000)
  }
  
  const redo = () => {
    if (redoStack.length === 0) return
    
    const currentState = pixelData.map(row => [...row])
    const nextState = redoStack[redoStack.length - 1]
    
    // Move current state to undo stack
    setUndoStack(prev => [...prev, currentState])
    
    // Remove last state from redo stack
    setRedoStack(prev => prev.slice(0, -1))
    
    // Apply next state
    setPixelData(nextState)
    drawPixelData(nextState)
    
    // Save automatically
    if (renderDebounceRef.current) {
      clearTimeout(renderDebounceRef.current)
    }
    renderDebounceRef.current = setTimeout(() => {
      savePngFromPixelData(nextState)
    }, 1000)
  }

  // PNG Editor functions
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
    if (pixelSize <= 2) return // No mostrar grid en zooms muy pequeños
    
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    
    // Líneas verticales
    for (let x = 0; x <= width; x += pixelSize) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    }
    
    // Líneas horizontales
    for (let y = 0; y <= height; y += pixelSize) {
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
    }
    
    ctx.stroke()
  }

  const drawBrushPreview = (ctx, x, y, size, color) => {
    if (x < 0 || y < 0 || brushTool !== 'pen') return
    
    const radius = Math.floor(size / 2)
    
    // Draw brush preview with solid color
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

  const drawPixelData = (data) => {
    if (!canvasRef.current || !data) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Draw transparency pattern background
    drawTransparencyPattern(ctx, canvas.width, canvas.height, pixelSize)
    
    // Draw pixels
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const color = data[y][x]
        if (color !== 'transparent') {
          ctx.fillStyle = color
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize)
        }
      }
    }
    
    // Draw grid overlay
    drawGrid(ctx, canvas.width, canvas.height, pixelSize)
    
    // Draw brush preview if cursor is visible
    if (showCursor && cursorPosition.x >= 0 && cursorPosition.y >= 0) {
      drawBrushPreview(ctx, cursorPosition.x, cursorPosition.y, brushSize, brushColor)
    }
  }

  // Redraw canvas when pixelData or pixelSize changes
  useEffect(() => {
    if (pixelData && pixelData.length > 0) {
      drawPixelData(pixelData)
    }
  }, [pixelData, pixelSize, imageWidth, imageHeight])

  // Function to apply brush at a specific position
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
              // For circular brush, check distance from center
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

  // Función para obtener coordenadas del mouse en el canvas
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

  // Manejar inicio de trazo (mousedown)
  const handleCanvasMouseDown = (e) => {
    if (!pixelData || !canvasRef.current) return
    
    const coords = getCanvasCoordinates(e)
    if (!coords) return
    
    // For eyedropper, only change color
    if (brushTool === 'eyedropper') {
      const pickedColor = pixelData[coords.y][coords.x]
      if (pickedColor !== 'transparent') {
        setBrushColor(pickedColor)
      }
      return
    }
    
    // Save state to history only at stroke start
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

  // Manejar movimiento durante el dibujo (mousemove)
  const handleCanvasMouseMove = (e) => {
    const coords = getCanvasCoordinates(e)
    if (!coords) {
      setShowCursor(false)
      setCursorPosition({ x: -1, y: -1 })
      return
    }
    
    // Update cursor position for preview
    setCursorPosition({ x: coords.x, y: coords.y })
    setShowCursor(true)
    
    // If we're drawing and it's brush or eraser, continue the stroke
    if (isDrawing && (brushTool === 'pen' || brushTool === 'eraser')) {
      const newPixelData = [...pixelData]
      applyBrushAt(newPixelData, coords.x, coords.y)
      
      setPixelData(newPixelData)
      drawPixelData(newPixelData)
    }
  }

  // Manejar fin de trazo (mouseup)
  const handleCanvasMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false)
      setStrokeStarted(false)
      
      // Auto-save después de completar el trazo
      if (renderDebounceRef.current) {
        clearTimeout(renderDebounceRef.current)
      }
      renderDebounceRef.current = setTimeout(() => {
        savePngFromPixelData(pixelData)
      }, 1000)
    }
  }

  // Función legacy para compatibilidad con clicks simples (bucket tool)
  const handleCanvasClick = (e) => {
    if (!pixelData || !canvasRef.current) return
    
    const coords = getCanvasCoordinates(e)
    if (!coords) return
    
    // Solo para herramientas que funcionan con click simple
    if (brushTool === 'bucket') {
      // Save state to history
      saveToHistory(pixelData)
      
      const newPixelData = [...pixelData]
      applyBrushAt(newPixelData, coords.x, coords.y)
      
      setPixelData(newPixelData)
      drawPixelData(newPixelData)
      
      // Auto-save after a short delay
      if (renderDebounceRef.current) {
        clearTimeout(renderDebounceRef.current)
      }
      renderDebounceRef.current = setTimeout(() => {
        savePngFromPixelData(newPixelData)
      }, 1000)
    }
  }
  
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
      
      // Add adjacent pixels
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
    }
  }
  
  const savePngFromPixelData = async (data) => {
    if (!fileInfo || !canvasRef.current) return
    
    setPngSaving(true)
    
    try {
      // Create a temporary canvas for saving at original size
      const tempCanvas = document.createElement('canvas')
      const tempCtx = tempCanvas.getContext('2d')
      
      tempCanvas.width = imageWidth
      tempCanvas.height = imageHeight
      
      // Clear canvas
      tempCtx.clearRect(0, 0, imageWidth, imageHeight)
      
      // Draw pixels
      for (let y = 0; y < imageHeight; y++) {
        for (let x = 0; x < imageWidth; x++) {
          const color = data[y][x]
          if (color !== 'transparent') {
            tempCtx.fillStyle = color
            tempCtx.fillRect(x, y, 1, 1)
          }
        }
      }
      
      // Convert to blob and save
      const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'))
      
      const response = await fetch(`/api/png/${fileInfo.name}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/png'
        },
        body: blob
      })
      
      if (!response.ok) {
        throw new Error('Error saving PNG')
      }
      
      // Re-render GIF to show updated PNG
      renderGIF()
      
    } catch (error) {
      console.error('Error saving PNG:', error)
      setPngError('Error saving: ' + error.message)
    } finally {
      setPngSaving(false)
    }
  }

  // PNG functions
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
          
          // Convert to hex color
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

  const loadPngData = async () => {
    if (!fileInfo) return
    
    setPngLoading(true)
    setPngError('')
    setPixelData([])
    setImageWidth(0)
    setImageHeight(0)
    
    try {
      const response = await fetch(`/api/png/${fileInfo.name}`)
      
      if (response.ok) {
        const blob = await response.blob()
        const imageUrl = URL.createObjectURL(blob)
        setPngData(imageUrl)
        
        // Convert image to pixel data for native editor
        const img = new Image()
        img.onload = async () => {
          const result = await convertImageToPixelData(img)
          setPixelData(result.pixels)
          setImageWidth(result.width)
          setImageHeight(result.height)
          // Draw initial pixel data on canvas
          setTimeout(() => drawPixelData(result.pixels), 100)
        }
        img.onerror = () => {
          setPngError('Error loading image')
        }
        img.src = imageUrl
      } else {
        setPngError('Error loading PNG from .nitro file')
      }
    } catch (error) {
      setPngError('Error loading PNG: ' + error.message)
    } finally {
      setPngLoading(false)
    }
  }

  const savePngData = async (imageData) => {
    if (!fileInfo) return
    
    setPngSaving(true)
    setPngError('')
    
    try {
      // Convert canvas to blob
      const canvas = imageData
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      
      const response = await fetch(`/api/png/${fileInfo.name}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'image/png'
        },
        body: blob
      })
      
      if (response.ok) {
        setSuccess('PNG saved successfully to .nitro file')
        // Reload PNG data to reflect changes
        await loadPngData()
        // Re-render GIF to show updated PNG
        renderGIF()
      } else {
        setPngError('Error saving PNG')
      }
    } catch (error) {
      setPngError('Error saving PNG: ' + error.message)
    } finally {
      setPngSaving(false)
    }
  }

  // Download PNG function
  const downloadPng = () => {
    if (!canvasRef.current || !pixelData || pixelData.length === 0) {
      setPngError('No image to download')
      return
    }

    // Create a temporary canvas for download at original size
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    
    tempCanvas.width = imageWidth
    tempCanvas.height = imageHeight
    
    // Clear canvas
    tempCtx.clearRect(0, 0, imageWidth, imageHeight)
    
    // Draw pixels
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const color = pixelData[y][x]
        if (color !== 'transparent') {
          tempCtx.fillStyle = color
          tempCtx.fillRect(x, y, 1, 1)
        }
      }
    }
    
    // Create download link
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

  // Handle PNG upload function
  const handlePngUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/png')) {
      setPngError('Please select a valid PNG file')
      return
    }

    try {
      setPngLoading(true)
      setPngError('')

      // Create image element to load the uploaded PNG
      const img = new Image()
      img.onload = async () => {
        try {
          // Convert uploaded image to pixel data
          const result = await convertImageToPixelData(img)
          setPixelData(result.pixels)
          setImageWidth(result.width)
          setImageHeight(result.height)
          
          // Draw the new pixel data on canvas and then save
          setTimeout(() => {
            drawPixelData(result.pixels)
            // Auto-save the new PNG data after canvas is updated
            savePngFromPixelData(result.pixels)
          }, 100)
          
          setSuccess('PNG cargado correctamente')
        } catch (error) {
          setPngError('Error al procesar la imagen: ' + error.message)
        } finally {
          setPngLoading(false)
        }
      }
      
      img.onerror = () => {
        setPngError('Error loading image')
        setPngLoading(false)
      }
      
      // Load the uploaded file
      const reader = new FileReader()
      reader.onload = (e) => {
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
      
    } catch (error) {
      setPngError('Error loading file: ' + error.message)
      setPngLoading(false)
    }
    
    // Clear the input value so the same file can be uploaded again
    e.target.value = ''
  }

  useEffect(() => {
    if (error || success || pngError) {
      clearMessages()
    }
  }, [error, success, pngError])



  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only process shortcuts if there's a loaded file and pixelData available
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

  // Load PNG when file is loaded
  useEffect(() => {
    if (fileInfo) {
      loadPngData()
      // Clear history when loading a new file
      setUndoStack([])
      setRedoStack([])
    } else {
      setPngData(null)
      setPngError('')
      setUndoStack([])
      setRedoStack([])
    }
  }, [fileInfo])

  // Redraw canvas when pixel data or pixel size changes
  useEffect(() => {
    if (pixelData && pixelData.length > 0) {
      drawPixelData(pixelData)
    }
  }, [pixelData, pixelSize, imageWidth, imageHeight, cursorPosition, showCursor, brushSize, brushColor, brushTool])

  return (
    <div className="container">
      {/* Primera fila: Upload y controles horizontales */}
      <div className="top-row">
        <div className={`upload-section ${isDragOver ? 'drag-over' : ''}`}
             onDragOver={handleDragOver}
             onDragLeave={handleDragLeave}
             onDrop={handleDrop}>
          
          {!fileInfo ? (
            <div className="upload-area">
              <div className="upload-icon">📁</div>
              <p>Drag and drop your .nitro file here or</p>
              <button 
                className="upload-btn" 
                onClick={() => fileInputRef.current?.click()}
              >
                Select file
              </button>
              <input 
                ref={fileInputRef}
                type="file" 
                className="file-input" 
                accept=".nitro" 
                onChange={handleFileInputChange}
              />
            </div>
          ) : (
            <div className="file-loaded">
              <div className="file-name">
                <span className="file-icon">📄</span>
                <span>{fileInfo.name}</span>
                <button 
                  className="change-file-btn"
                  onClick={() => fileInputRef.current?.click()}
                  title="Change file"
                >
                  🔄
                </button>
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                className="file-input" 
                accept=".nitro" 
                onChange={handleFileInputChange}
              />
            </div>
          )}
        </div>

        {fileInfo && (
          <div className="controls-horizontal">
            <div className="control-group">
              <label>Direction:</label>
              <div className="control-row">
                {fileInfo.directions.map(dir => (
                  <button 
                    key={dir}
                    className={`control-btn ${selectedDirection === dir ? 'active' : ''}`}
                    onClick={() => handleControlChange('direction', dir)}
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <label>State:</label>
              <div className="control-row">
                {fileInfo.states.map(state => (
                  <button 
                    key={state}
                    className={`control-btn ${selectedState === state ? 'active' : ''}`}
                    onClick={() => handleControlChange('state', state)}
                  >
                    {state}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <label>Color:</label>
              <div className="control-row">
                {fileInfo.colors.map(color => (
                  <button 
                    key={color}
                    className={`control-btn ${selectedColor === color ? 'active' : ''}`}
                    onClick={() => handleControlChange('color', color)}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            <div className="control-group">
              <label>Export:</label>
              <div className="control-row">
                <button 
                  className="control-btn export-btn"
                  onClick={handleExportNitro}
                  disabled={!fileInfo}
                  title="Export .nitro file with modifications"
                >
                  📦 Export .nitro
                </button>
              </div>
            </div>

          </div>
        )}

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
      </div>

      {/* Segunda fila: Editor JSON, Editor PNG y Previsualización */}
      <div className="bottom-row">
        {fileInfo && (
          <div className="json-editor-section">
            <div className="json-editor-header">
               <div className="json-title">
                 <h3>📝 Editor JSON</h3>
                 <div className="json-status">
                   {jsonSaving && <span className="json-saving">💾 Guardando...</span>}
                   {!jsonSaving && jsonValid && (
                     <>
                       <span className="json-valid">✅ Válido</span>
                       <button 
                         className="update-btn"
                         onClick={handleUpdateRender}
                         disabled={jsonSaving}
                         title="Save JSON and update render"
                       >
                         🔄 Update
                       </button>


                     </>
                   )}
                   {!jsonSaving && !jsonValid && <span className="json-invalid">❌ Inválido</span>}
                 </div>
               </div>
               {jsonError && <div className="json-error">{jsonError}</div>}
             </div>
            <div className={`json-editor-container ${!jsonValid ? 'json-editor-invalid' : ''}`}>
              <Editor
                height="500px"
                defaultLanguage="json"
                value={jsonContent}
                onChange={(value) => handleJsonChange(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  wordWrap: 'on',
                  automaticLayout: true,
                  formatOnPaste: true,
                  formatOnType: true,
                  tabSize: 2,
                  insertSpaces: true,
                  detectIndentation: false,
                  bracketPairColorization: { enabled: true },
                  folding: true,
                  lineNumbers: 'on',
                  renderWhitespace: 'selection',
                  cursorBlinking: 'blink',
                  cursorSmoothCaretAnimation: 'on',
                  smoothScrolling: true,
                  suggest: {
                    showKeywords: true,
                    showSnippets: true
                  },
                  quickSuggestions: {
                    other: true,
                    comments: false,
                    strings: true
                  }
                }}
                beforeMount={(monaco) => {
                  // Configurar validación JSON personalizada
                  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
                    validate: true,
                    allowComments: false,
                    schemas: [],
                    enableSchemaRequest: false
                  });
                }}
              />
            </div>
            <div className="json-editor-info">
              <p>💡 Click "Update" to save changes and apply them to the visualization</p>
            </div>
            


          </div>
        )}

        {fileInfo && (
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
                  <button onClick={loadPngData} className="retry-btn">🔄 Retry</button>
                </div>
              )}
              
              {!pngLoading && !pngError && pngData && (
                <div className="png-editor-container">
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
                        onClick={undo}
                        disabled={undoStack.length === 0}
                        title="Undo (Ctrl+Z)"
                      >
                        ↶ Undo
                      </button>
                      <button 
                        className="tool-btn"
                        onClick={redo}
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
                        onClick={downloadPng}
                        title="Download edited PNG"
                      >
                        📥 Download
                      </button>
                      <input 
                        type="file" 
                        accept=".png" 
                        onChange={handlePngUpload}
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
                  <div className="native-pixel-editor">
                    <canvas 
                      ref={canvasRef}
                      width={imageWidth * pixelSize || 1}
                      height={imageHeight * pixelSize || 1}
                      style={{
                        border: '2px solid #999',
                        cursor: getCursorStyle(),
                        imageRendering: 'pixelated',
                        minWidth: imageWidth * pixelSize > 0 ? 'auto' : '100px',
                        minHeight: imageHeight * pixelSize > 0 ? 'auto' : '100px'
                      }}
                      onClick={handleCanvasClick}
                      onMouseDown={handleCanvasMouseDown}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseEnter={() => setShowCursor(true)}
                      onMouseLeave={() => {
                        setShowCursor(false)
                        setCursorPosition({ x: -1, y: -1 })
                      }}
                    />
                    {(!pixelData || pixelData.length === 0) && (
                      <div className="png-empty-placeholder">
                        <p>🎨 Load a .nitro file with PNG to start editing</p>
                      </div>
                    )}
                  </div>
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
        )}



        <div className="viewer-section" onMouseDown={handleMouseDown}>
          {loading && <div className="loading">Procesando...</div>}
          
          {!loading && !renderedGif && (
            <div className="placeholder">
              <p>🎮 Upload a .nitro file to get started</p>
            </div>
          )}
          
          {!loading && renderedGif && (
            <div 
              ref={gifContainerRef}
              className={`gif-container ${isDragging ? 'dragging' : ''}`}
              style={{
                left: dragPosition.x === 'center' ? '50%' : `${dragPosition.x}px`,
                top: dragPosition.y === 'center' ? '50%' : `${dragPosition.y}px`,
                transform: dragPosition.x === 'center' || dragPosition.y === 'center' ? 'translate(-50%, -50%)' : 'none'
              }}
            >
              <img src={renderedGif} alt="Rendered furniture" />
            </div>
          )}
        </div>
      </div>

      {/* Sección simplificada - overlays removidos */}
    </div>
  )
}

export default App
