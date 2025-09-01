import { useState } from 'react'

export const useFileOperations = () => {
  const [fileInfo, setFileInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)

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
        setSuccess('File uploaded successfully')
        return result.info
      } else {
        setError(result.error || 'Error uploading file')
        return null
      }
    } catch (err) {
      setError('Error de conexión: ' + err.message)
      return null
    } finally {
      setLoading(false)
    }
  }

  const handleExportNitro = async () => {
    if (!fileInfo) return
    
    try {
      setLoading(true)
      setError('')
      
      const response = await fetch(`/api/export/${fileInfo.name}`)
      
      if (response.ok) {
        const blob = await response.blob()
        
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${fileInfo.name.replace('.nitro', '')}_modified.nitro`
        document.body.appendChild(a)
        a.click()
        
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

  const clearMessages = () => {
    setTimeout(() => {
      setError('')
      setSuccess('')
    }, 5000)
  }

  return {
    fileInfo,
    setFileInfo,
    loading,
    setLoading,
    error,
    setError,
    success,
    setSuccess,
    isDragOver,
    handleFileUpload,
    handleExportNitro,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    clearMessages
  }
}