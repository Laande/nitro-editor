import { useState } from 'react'

export const useJsonEditor = () => {
  const [jsonContent, setJsonContent] = useState('')
  const [jsonSaving, setJsonSaving] = useState(false)
  const [jsonValid, setJsonValid] = useState(true)
  const [jsonError, setJsonError] = useState('')

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

  const refreshFileInfo = async (fileInfo) => {
    if (!fileInfo) return null
    
    try {
      const response = await fetch(`/api/info/${fileInfo.name}`)
      
      if (response.ok) {
        const updatedInfo = await response.json()
        return updatedInfo
      }
    } catch (error) {
      console.error('Error refreshing file info:', error)
    }
    return null
  }

  const saveJsonContent = async (content, fileInfo) => {
    if (!fileInfo) return false
    
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
        return true
      } else {
        setJsonError('Error saving JSON content')
        return false
      }
    } catch (error) {
      setJsonError('Invalid JSON or error saving')
      return false
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
    
    const validation = validateJson(content)
    
    if (!validation.isValid) {
      setJsonError(`JSON inválido: ${validation.error}`)
      setJsonValid(false)
      return
    }
    
    setJsonError('')
    setJsonValid(true)
  }

  return {
    jsonContent,
    setJsonContent,
    jsonSaving,
    jsonValid,
    jsonError,
    loadJsonContent,
    refreshFileInfo,
    saveJsonContent,
    handleJsonChange
  }
}