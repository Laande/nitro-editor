import { useState, useRef } from 'react'

export const useGifRenderer = (setSuccess, setError) => {
  const [selectedDirection, setSelectedDirection] = useState(null)
  const [selectedState, setSelectedState] = useState(null)
  const [selectedColor, setSelectedColor] = useState(null)
  const [renderedGif, setRenderedGif] = useState(null)

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

    renderGIF(newDirection, newState, newColor, fileInfo?.name)
  }

  const initializeControls = (fileInfo, autoRender = false) => {
    if (fileInfo) {
      // Set default direction to 2 if available, otherwise use first available
      const defaultDirection = fileInfo.directions.includes(2) ? 2 : fileInfo.directions[0]
      const defaultState = fileInfo.states[0]
      const defaultColor = fileInfo.colors[0]

      setSelectedDirection(defaultDirection)
      setSelectedState(defaultState)
      setSelectedColor(defaultColor)

      if (autoRender) {
        setTimeout(() => {
          renderGIF(defaultDirection, defaultState, defaultColor, fileInfo.name)
        }, 100)
      }
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