import { useEffect, useState } from 'react'
import './App.css'

// Components
import FileUpload from './components/FileUpload'
import Controls from './components/Controls'
import JsonEditor from './components/JsonEditor'
import PngEditor from './components/PngEditor/PngEditor'
import GifViewer from './components/GifViewer'

// Hooks
import { useFileOperations } from './hooks/useFileOperations'
import { useJsonEditor } from './hooks/useJsonEditor'
import { useGifRenderer } from './hooks/useGifRenderer'

// Styles
import './styles/styles.css'

function App() {
  // Custom hooks
  const {
    fileInfo,
    setFileInfo,
    loading,
    error,
    success,
    isDragOver,
    handleFileUpload,
    handleExportNitro,
    handleDragOver,
    handleDragLeave,
    clearMessages,
    setSuccess,
    setError
  } = useFileOperations()

  const {
    jsonContent,
    jsonSaving,
    jsonValid,
    jsonError,
    loadJsonContent,
    refreshFileInfo,
    saveJsonContent,
    handleJsonChange
  } = useJsonEditor(setSuccess)

  const {
    selectedDirection,
    selectedState,
    selectedColor,
    renderedGif,
    renderGIF,
    handleControlChange,
    initializeControls,
    updateControlsFromFileInfo
  } = useGifRenderer(setSuccess, setError)

  // PNG Editor states
  const [pngData, setPngData] = useState(null)
  const [pngLoading, setPngLoading] = useState(false)
  const [pngError, setPngError] = useState('')
  const [pngSaving, setPngSaving] = useState(false)

  // Handle file upload with additional logic
  const handleFileUploadWithLogic = async (file, autoRender = false) => {
    const uploadedFileInfo = await handleFileUpload(file, autoRender)

    if (uploadedFileInfo) {
      setFileInfo(uploadedFileInfo)
      initializeControls(uploadedFileInfo)

      // Load JSON content
      loadJsonContent(uploadedFileInfo.name)

      if (autoRender) {
        setTimeout(() => {
          renderGIF(uploadedFileInfo.directions[0], uploadedFileInfo.states[0], uploadedFileInfo.colors[0], uploadedFileInfo.name)
        }, 500)
      }
    }
  }

  // Handle control changes with file info
  const handleControlChangeWithFileInfo = (type, value) => {
    handleControlChange(type, value, fileInfo)
  }

  const handleDropWithLogic = (e) => {
    e.preventDefault()

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUploadWithLogic(files[0], true)
    }
  }

  const handleFileInputChangeWithLogic = (e) => {
    const file = e.target.files[0]
    if (file) {
      handleFileUploadWithLogic(file, true)
    }
  }

  const handleUpdateRender = async () => {
    if (!jsonValid || !fileInfo) return

    const success = await saveJsonContent(jsonContent, fileInfo)
    if (success) {
      const updatedInfo = await refreshFileInfo(fileInfo)
      if (updatedInfo) {
        setFileInfo(updatedInfo)
        updateControlsFromFileInfo(updatedInfo)
      }
      // Trigger immediate re-render
      renderGIF(selectedDirection, selectedState, selectedColor, fileInfo.name)
    }
  }

  // PNG Editor functions
  const savePngFromPixelData = async (pixelData) => {
    if (!fileInfo) return

    setPngSaving(true)

    try {
      // Create a temporary canvas for saving at original size
      const tempCanvas = document.createElement('canvas')
      const tempCtx = tempCanvas.getContext('2d')

      const imageHeight = pixelData.length
      const imageWidth = pixelData[0]?.length || 0

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
      renderGIF(selectedDirection, selectedState, selectedColor, fileInfo.name)

    } catch (error) {
      console.error('Error saving PNG:', error)
      setPngError('Error saving: ' + error.message)
    } finally {
      setPngSaving(false)
    }
  }

  const loadPngData = async () => {
    if (!fileInfo) return

    setPngLoading(true)
    setPngError('')

    try {
      const response = await fetch(`/api/png/${fileInfo.name}`)

      if (response.ok) {
        const blob = await response.blob()
        const imageUrl = URL.createObjectURL(blob)
        setPngData(imageUrl)
      } else {
        setPngError('Error loading PNG from .nitro file')
      }
    } catch (error) {
      setPngError('Error loading PNG: ' + error.message)
    } finally {
      setPngLoading(false)
    }
  }

  // Effects
  useEffect(() => {
    if (error || success || pngError) {
      clearMessages()
    }
  }, [error, success, pngError])

  useEffect(() => {
    if (fileInfo) {
      loadPngData()
    } else {
      setPngData(null)
      setPngError('')
    }
  }, [fileInfo])

  return (
    <div className="container">
      {/* Primera fila: Upload y controles horizontales */}
      <div className="top-row">
        <FileUpload
          fileInfo={fileInfo}
          isDragOver={isDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDropWithLogic}
          onFileChange={handleFileInputChangeWithLogic}
        />

        <Controls
          fileInfo={fileInfo}
          selectedDirection={selectedDirection}
          selectedState={selectedState}
          selectedColor={selectedColor}
          onControlChange={handleControlChangeWithFileInfo}
          onExportNitro={handleExportNitro}
        />

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
      </div>

      {/* Segunda fila: Editor JSON, Editor PNG y Previsualización */}
      <div className="bottom-row">
        <JsonEditor
          fileInfo={fileInfo}
          jsonContent={jsonContent}
          jsonSaving={jsonSaving}
          jsonValid={jsonValid}
          jsonError={jsonError}
          onJsonChange={handleJsonChange}
          onUpdateRender={handleUpdateRender}
        />

        <PngEditor
          fileInfo={fileInfo}
          pngData={pngData}
          pngLoading={pngLoading}
          pngError={pngError}
          pngSaving={pngSaving}
          onLoadPngData={loadPngData}
          onSavePngFromPixelData={savePngFromPixelData}
        />

        <GifViewer
          loading={loading}
          renderedGif={renderedGif}
        />
      </div>
    </div>
  )
}

export default App
