import { useState, useRef } from 'react'

export const useGifRenderer = (setSuccess, setError) => {
  const [selectedDirection, setSelectedDirection] = useState(null)
  const [selectedState, setSelectedState] = useState(null)
  const [selectedColor, setSelectedColor] = useState(null)
  const [renderedGif, setRenderedGif] = useState(null)
  
  const renderDebounceRef = useRef(null)

  const renderGIF = async (direction = selectedDirection, state = selectedState, color = selectedColor, filename) => {
    if (!filename) return

    try {
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
        const gifUrlWithTimestamp = result.gif_url + '?t=' + Date.now()
        setRenderedGif(gifUrlWithTimestamp)
        setSuccess('GIF renderizado correctamente')
      } else {
        setError(result.error || 'Error rendering')
      }
    } catch (err) {
      console.error('Error de conexión: ' + err.message)
    }
  }

  const autoRenderWithDebounce = (direction = selectedDirection, state = selectedState, color = selectedColor, filename) => {
    if (renderDebounceRef.current) {
      clearTimeout(renderDebounceRef.current)
    }
    renderDebounceRef.current = setTimeout(() => {
      renderGIF(direction, state, color, filename)
    }, 150)
  }

  const handleControlChange = (type, value, fileInfo) => {
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
    
    autoRenderWithDebounce(newDirection, newState, newColor, fileInfo?.name)
  }

  const initializeControls = (fileInfo) => {
    if (fileInfo) {
      setSelectedDirection(fileInfo.directions[0])
      setSelectedState(fileInfo.states[0])
      setSelectedColor(fileInfo.colors[0])
    }
  }

  const updateControlsFromFileInfo = (fileInfo) => {
    if (!fileInfo) return

    if (!fileInfo.directions.includes(selectedDirection)) {
      setSelectedDirection(fileInfo.directions[0])
    }
    if (!fileInfo.states.includes(selectedState)) {
      setSelectedState(fileInfo.states[0])
    }
    if (!fileInfo.colors.includes(selectedColor)) {
      setSelectedColor(fileInfo.colors[0])
    }
  }

  return {
    selectedDirection,
    selectedState,
    selectedColor,
    renderedGif,
    renderGIF,
    handleControlChange,
    initializeControls,
    updateControlsFromFileInfo
  }
}