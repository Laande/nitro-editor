import Editor from '@monaco-editor/react'

const JsonEditor = ({ 
  fileInfo,
  jsonContent, 
  jsonSaving, 
  jsonValid, 
  jsonError, 
  onJsonChange, 
  onUpdateRender 
}) => {
  if (!fileInfo) return null

  return (
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
                  onClick={onUpdateRender}
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
          onChange={(value) => onJsonChange(value || '')}
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
  )
}

export default JsonEditor