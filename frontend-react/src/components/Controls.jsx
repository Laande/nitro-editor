const Controls = ({ 
  fileInfo, 
  selectedDirection, 
  selectedState, 
  selectedColor, 
  onControlChange, 
  onExportNitro 
}) => {
  if (!fileInfo) return null

  return (
    <div className="controls-horizontal">
      <div className="control-group">
        <label>Direction:</label>
        <div className="control-row">
          {fileInfo.directions.map(dir => (
            <button 
              key={dir}
              className={`control-btn ${selectedDirection === dir ? 'active' : ''}`}
              onClick={() => onControlChange('direction', dir)}
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
              onClick={() => onControlChange('state', state)}
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
              onClick={() => onControlChange('color', color)}
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
            onClick={onExportNitro}
            disabled={!fileInfo}
            title="Export .nitro file with modifications"
          >
            📦 Export .nitro
          </button>
        </div>
      </div>
    </div>
  )
}

export default Controls