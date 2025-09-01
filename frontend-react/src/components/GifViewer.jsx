import { useState, useRef, useEffect } from 'react'

const GifViewer = ({ loading, renderedGif }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [gridPosition, setGridPosition] = useState(null)
  const [tempPosition, setTempPosition] = useState({ x: 0, y: 0 })

  const gifContainerRef = useRef(null)

  const TILE_WIDTH = 64
  const TILE_HEIGHT = 32

  const getMousePosition = (e) => {
    const rect = gifContainerRef.current.parentElement.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handleMouseDown = (e) => {
    if (!gifContainerRef.current || !renderedGif) return
    setIsDragging(true)
    setTempPosition(getMousePosition(e))
    e.preventDefault()
  }

  const handleMouseMove = (e) => {
    if (isDragging) setTempPosition(getMousePosition(e))
  }

  const handleMouseUp = (e) => {
    if (!isDragging) return
    setIsDragging(false)

    const viewer = gifContainerRef.current.parentElement
    const rect = viewer.getBoundingClientRect()
    const mouseX = e.clientX - rect.left - viewer.offsetWidth / 2
    const mouseY = e.clientY - rect.top - viewer.offsetHeight / 2

    const isoX = (mouseX / (TILE_WIDTH / 2) + mouseY / (TILE_HEIGHT / 2)) / 2
    const isoY = (mouseY / (TILE_HEIGHT / 2) - mouseX / (TILE_WIDTH / 2)) / 2

    setGridPosition({ x: Math.round(isoX), y: Math.round(isoY) })
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging])

  // Reset position when a new mobis loads
  useEffect(() => {
    if (renderedGif) {
      setGridPosition(null)
    }
  }, [renderedGif])

  const getPixelPosition = () => {
    if (isDragging) return tempPosition
    if (!gifContainerRef.current?.parentElement || !gridPosition) return null

    const viewer = gifContainerRef.current.parentElement
    const centerX = viewer.offsetWidth / 2
    const centerY = viewer.offsetHeight / 2

    return {
      x: centerX + (gridPosition.x - gridPosition.y) * (TILE_WIDTH / 2),
      y: centerY + (gridPosition.x + gridPosition.y) * (TILE_HEIGHT / 2)
    }
  }

  const pixelPosition = getPixelPosition()

  return (
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
          style={pixelPosition ? {
            left: `${pixelPosition.x}px`,
            top: `${pixelPosition.y}px`,
            transform: 'translate(-50%, -50%)',
            transition: isDragging ? 'none' : 'all 0.2s ease'
          } : {
            transition: isDragging ? 'none' : 'all 0.2s ease'
          }}
        >
          <img src={renderedGif} alt="Rendered furniture" />
        </div>
      )}
    </div>
  )
}

export default GifViewer