# Nitro Viewer

An interactive viewer and editor for Habbo Hotel .nitro files that allows you to visualize, edit, and export furni assets.

## 🚀 Features

### 📊 JSON Editor
- Visualization and editing of JSON content from .nitro files
- Intuitive interface with syntax highlighting
- Real-time validation
- Automatic saving of changes

### 🎨 PNG Editor
- Integrated pixel editor for modifying textures
- Drawing tools:
  - **Brush**: For free drawing
  - **Eraser**: For removing pixels
  - **Eyedropper**: For selecting existing colors
  - **Bucket**: For filling areas with color
- Advanced color picker
- Adjustable brush sizes
- **Undo/Redo system** with support for complete strokes
- Keyboard shortcuts (Ctrl+Z, Ctrl+Y)

### 🎬 GIF Rendering
- Automatic generation of animated GIFs
- Support for multiple directions and states
- Size and color configuration
- Real-time preview

### 📦 Export
- Export of modified .nitro files
- Preservation of original structure
- Automatic download with `_modified` suffix

## 🛠️ Technologies

### Backend
- **Go** with Gin framework
- .nitro file processing
- RESTful API
- GIF rendering

### Frontend
- **React** with Vite
- Modern and responsive interface
- Interactive editors
- Drag & Drop for files

## 📋 Requirements

- **Go** 1.19 or higher
- **Node.js** 16 or higher
- **npm** or **yarn**

## 🚀 Installation and Usage

### 1. Clone the repository
```bash
git clone <repository-url>
cd nitro-viewer
```

### 2. Setup Backend
```bash
cd backend
go mod download
go run .
```

The backend will start at `http://localhost:7777`

### 3. Setup Frontend
```bash
cd frontend-react
npm install
npm run dev
```

The frontend will start at `http://localhost:5173`

### 4. Access the application
Open your browser and go to `http://localhost:5173`

## 📁 Project Structure

```
nitro-viewer/
├── backend/                 # Go server
│   ├── main.go             # Server entry point
│   ├── nitro.go            # .nitro file processing
│   ├── renderer.go         # GIF rendering
│   ├── go.mod              # Go dependencies
│   └── go.sum
├── frontend-react/          # React application
│   ├── src/
│   │   ├── App.jsx         # Main component
│   │   ├── App.css         # Main styles
│   │   └── main.jsx        # Entry point
│   ├── package.json        # Node.js dependencies
│   └── vite.config.js      # Vite configuration
├── uploads/                 # Uploaded .nitro files
├── static/                  # Generated GIFs
└── README.md               # This file
```

## 🎯 Application Usage

### Loading a .nitro file
1. Drag and drop a .nitro file into the upload area
2. Or click "Select file" to choose one

### JSON Editor
1. Select the "JSON Editor" tab
2. Modify the JSON content as needed
3. Changes are saved automatically

### PNG Editor
1. Select the "PNG Editor" tab
2. Choose a tool (brush, eraser, eyedropper, bucket)
3. Select a color and brush size
4. Draw on the canvas
5. Use Ctrl+Z to undo and Ctrl+Y to redo

### Rendering
1. Configure direction, state, size and color
2. Click "Render" to generate the GIF
3. The GIF will appear in the preview

### Export
1. Click "Export .nitro"
2. The modified file will download automatically

## 🔧 API Endpoints

- `POST /api/upload` - Upload .nitro file
- `POST /api/render` - Render GIF
- `GET /api/info/:filename` - Get file information
- `GET /api/json/:filename` - Get JSON content
- `PUT /api/json/:filename` - Update JSON content
- `GET /api/png/:filename` - Get PNG data
- `PUT /api/png/:filename` - Update PNG data
- `GET /api/export/:filename` - Export modified file

## 🤝 Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is under the MIT License - see the [LICENSE](LICENSE) file for more details.

## 🙏 Acknowledgments

- Habbo Hotel community
- .nitro tools developers
- Project contributors

---

**¡Disfruta editando tus assets de Habbo Hotel! 🎉**