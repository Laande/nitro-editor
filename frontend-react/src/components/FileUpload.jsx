import { useRef } from 'react'

const FileUpload = ({ 
  fileInfo, 
  isDragOver, 
  onDragOver, 
  onDragLeave, 
  onDrop, 
  onFileChange 
}) => {
  const fileInputRef = useRef(null)

  return (
    <div className={`upload-section ${isDragOver ? 'drag-over' : ''}`}
         onDragOver={onDragOver}
         onDragLeave={onDragLeave}
         onDrop={onDrop}>
      
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
            onChange={onFileChange}
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
            onChange={onFileChange}
          />
        </div>
      )}
    </div>
  )
}

export default FileUpload