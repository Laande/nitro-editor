import { useState, useRef, useEffect } from 'react'

const GifViewer = ({ loading, renderedGif }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState({ x: 'center', y: 'center' })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  const gifContainerRef = useRef(null)

  const handleMouseDown = (e) => {
    if (!gifContainerRef.current || !renderedGif) return
    
    const rect = gifContainerRef.current.getBoundingClientRect()
    
    setIsDragging(true)
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
    
    const newCenterX = e.clientX - dragOffset.x
    const newCenterY = e.clientY - dragOffset.y
    
    const newX = newCenterX - viewerRect.left - containerRect.width / 2
    const newY = newCenterY - viewerRect.top - containerRect.height / 2
    
    const maxX = viewerRect.width - containerRect.width
    const maxY = viewerRect.height - containerRect.height
    
    const constrainedX = Math.max(0, Math.min(newX, maxX))
    const constrainedY = Math.max(0, Math.min(newY, maxY))
    
    setDragPosition({ x: constrainedX, y: constrainedY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
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
  }, [isDragging, dragOffset])

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
  )
}

export default GifViewer