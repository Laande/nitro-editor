package main

import (
	"bufio"
	"bytes"
	"compress/zlib"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"os"
	"sort"
	"strconv"
	"strings"
)

// max returns the larger of x or y
func max(x, y int) int {
	if x > y {
		return x
	}
	return y
}

// NitroArchive represents a .nitro file
type NitroArchive struct {
	Files map[string]NitroFile
}

// NitroLibrary representa una librería .nitro con capacidades de edición
type NitroLibrary struct {
	Archive     *NitroArchive
	FilePath    string
	Furni       *NitroFurni
	OriginalJSON []byte // Preservar el JSON original
}

type NitroFile struct {
	Name string
	Data []byte
}

type NitroReader struct {
	r *bufio.Reader
}

// Asset represents a resource within the .nitro file (maintained for compatibility)
type Asset struct {
	Name   string
	Image  image.Image
	Offset image.Point
	FlipH  bool
	FlipV  bool
}

// Visualization contiene la información de visualización del mueble
type Visualization struct {
	Size       int
	LayerCount int
	Directions map[int]*Direction
	Animations map[int]*Animation
	Colors     map[int]*ColorInfo
	Layers     map[int]*LayerInfo
}

// Direction represents a visualization direction
type Direction struct {
	ID int
}

// Animation representa una animación
type Animation struct {
	ID     int
	Layers map[int]*AnimationLayer
}

// AnimationLayer representa una capa de animación
type AnimationLayer struct {
	ID            int
	FrameRepeat   int
	FrameSequence []int
}

// ColorInfo represents color information
type ColorInfo struct {
	ID     int
	Layers map[int]*ColorLayer
}

// ColorLayer represents a color layer
type ColorLayer struct {
	ID    int
	Color string
}

// LayerInfo representa información de capa
type LayerInfo struct {
	ID    int
	Alpha int
	Ink   string
	Z     int
}

// Index representa el índice del mueble
type Index struct {
	Visualization *Visualization
}

// FurniInfo contiene información básica del mueble
type FurniInfo struct {
	Name         string   `json:"name"`
	Directions   []int    `json:"directions"`
	States       []int    `json:"states"`
	Colors       []int    `json:"colors"`
	Size         int      `json:"size"`
	LayerCount   int      `json:"layer_count"`
	HasAnimation bool     `json:"has_animation"`
}

// processNitroFile processes a .nitro file and extracts information
func processNitroFile(filepath string) (*FurniInfo, error) {
	archive, err := loadNitroArchive(filepath)
	if err != nil {
		return nil, err
	}

	info, err := processNitroArchive(archive)
	if err != nil {
		return nil, err
	}

	// If name couldn't be extracted from JSON, use filename
	if info.Name == "" {
		info.Name = getFileNameWithoutExt(filepath)
	}
	return info, nil
}

func NewNitroReader(r io.Reader) *NitroReader {
	return &NitroReader{r: bufio.NewReader(r)}
}

func (r *NitroReader) readShort() (v uint16, err error) {
	var buf [2]byte
	_, err = io.ReadFull(r.r, buf[:])
	if err != nil {
		return
	}
	v = binary.BigEndian.Uint16(buf[:])
	return
}

func (r *NitroReader) readInt() (v uint32, err error) {
	var buf [4]byte
	_, err = io.ReadFull(r.r, buf[:])
	if err != nil {
		return
	}
	v = binary.BigEndian.Uint32(buf[:])
	return
}

func (r *NitroReader) readString() (s string, err error) {
	length, err := r.readShort()
	if err != nil {
		return
	}
	buf := make([]byte, length)
	_, err = io.ReadFull(r.r, buf)
	if err != nil {
		return
	}
	s = string(buf)
	return
}

func (r *NitroReader) ReadArchive() (archive NitroArchive, err error) {
	archive.Files = make(map[string]NitroFile)

	fileCount, err := r.readShort()
	if err != nil {
		return
	}

	for i := uint16(0); i < fileCount; i++ {
		file, err := r.ReadFile()
		if err != nil {
			return archive, err
		}
		archive.Files[file.Name] = file
	}

	return
}

func (r *NitroReader) ReadFile() (file NitroFile, err error) {
	file.Name, err = r.readString()
	if err != nil {
		return
	}

	length, err := r.readInt()
	if err != nil {
		return
	}

	// Use LimitReader to read exactly the compressed data length
	buffer := bytes.NewBuffer(make([]byte, 0, length*3/2))
	z, err := zlib.NewReader(io.LimitReader(r.r, int64(length)))
	if err != nil {
		return
	}
	defer z.Close()

	_, err = io.Copy(buffer, z)
	if err != nil {
		return
	}

	file.Data = buffer.Bytes()
	return
}

// loadNitroArchive loads a .nitro file
func loadNitroArchive(filepath string) (*NitroArchive, error) {
	file, err := os.Open(filepath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := NewNitroReader(file)
	archive, err := reader.ReadArchive()
	if err != nil {
		return nil, err
	}

	return &archive, nil
}

// Estructura para el JSON principal del furni (basado en nx)
type NitroFurni struct {
	Name              string                     `json:"name"`
	LogicType         string                     `json:"logicType"`
	VisualizationType string                     `json:"visualizationType"`
	Assets            map[string]NitroAsset      `json:"assets"`
	Logic             NitroLogic                 `json:"logic"`
	Visualizations    []NitroVisualization       `json:"visualizations"`
	Spritesheet       NitroSpritesheet           `json:"spritesheet"`
}

type NitroAsset struct {
	Source string  `json:"source"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	FlipH  bool    `json:"flipH"`
	FlipV  bool    `json:"flipV"`
}

type NitroLogic struct {
	Model           NitroModel            `json:"model"`
	ParticleSystems []NitroParticleSystem `json:"particleSystems,omitempty"`
}

type NitroModel struct {
	Dimensions NitroDimensions `json:"dimensions"`
	Directions []int           `json:"directions"`
}

type NitroDimensions struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

type NitroParticleSystem struct {
	Size int `json:"size"`
}

type NitroVisualization struct {
	Angle      int                           `json:"angle"`
	LayerCount int                           `json:"layerCount"`
	Size       int                           `json:"size"`
	Layers     map[string]NitroLayer         `json:"layers"`
	Directions map[string]NitroDirection     `json:"directions"`
	Colors     map[string]NitroColor         `json:"colors"`
	Animations map[string]NitroAnimation     `json:"animations"`
}

type NitroLayer struct {
	Z           int     `json:"z"`
	Alpha       int     `json:"alpha"`
	Ink         string  `json:"ink"`
	IgnoreMouse bool    `json:"ignoreMouse"`
	Color       int     `json:"color"`
	X           float64 `json:"x,omitempty"`
	Y           float64 `json:"y,omitempty"`
}

type NitroDirection struct {
	Id     int                    `json:"id"`
	Layers map[string]NitroLayer `json:"layers,omitempty"`
}

type NitroColor struct {
	Layers map[string]NitroColorLayer `json:"layers"`
}

type NitroColorLayer struct {
	Color string `json:"color"`
}

type NitroAnimation struct {
	Layers       map[string]NitroAnimationLayer `json:"layers"`
	TransitionTo *int                          `json:"transitionTo,omitempty"`
}

type NitroAnimationLayer struct {
	LoopCount      float64                           `json:"loopCount"`
	FrameRepeat    float64                           `json:"frameRepeat"`
	Random         float64                           `json:"random"`
	FrameSequences map[string]NitroFrameSequence     `json:"frameSequences"`
}

type NitroFrameSequence struct {
	Frames map[string]NitroAnimationFrame `json:"frames"`
}

type NitroAnimationFrame struct {
	Id int `json:"id"`
}

type NitroSpritesheet struct {
	Frames map[string]NitroSpriteFrame `json:"frames"`
	Meta   NitroMeta                   `json:"meta"`
}

type NitroSpriteFrame struct {
	Frame            NitroSize  `json:"frame"`
	Rotated          bool       `json:"rotated"`
	Trimmed          bool       `json:"trimmed"`
	SpriteSourceSize NitroSize  `json:"spriteSourceSize"`
	SourceSize       NitroSize  `json:"sourceSize"`
	Pivot            NitroPivot `json:"pivot"`
}

type NitroSize struct {
	X int `json:"x"`
	Y int `json:"y"`
	W int `json:"w"`
	H int `json:"h"`
}

type NitroPivot struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type NitroMeta struct {
	Image string `json:"image"`
}

// Helper function to process archive files
func processNitroArchive(archive *NitroArchive) (*FurniInfo, error) {
	info := &FurniInfo{
		Directions: []int{},
		States:     []int{},
		Colors:     []int{},
	}



	// Search for main furni JSON file
	var furniData *NitroFurni
	for name, file := range archive.Files {

		if strings.HasSuffix(name, ".json") {

			err := json.Unmarshal(file.Data, &furniData)
			if err == nil && furniData.Name != "" {
				info.Name = furniData.Name

				break
			}
		}
	}

	if furniData == nil {
		return info, nil
	}

	// Extraer información de las visualizaciones
	maxSize := 0
	for _, vis := range furniData.Visualizations {
		fmt.Printf("[DEBUG] Processing visualization with size: %d\n", vis.Size)

		// Usar la visualización más grande para obtener información básica
		if vis.Size > maxSize {
			maxSize = vis.Size
			info.Size = vis.Size
			info.LayerCount = vis.LayerCount
			fmt.Printf("[DEBUG] Updated info.Size to: %d\n", info.Size)
		}

		// Extraer direcciones

		for dirKey, _ := range vis.Directions {

			// Use map key as direction, not id field
			if dirID, err := strconv.Atoi(dirKey); err == nil {
				info.Directions = append(info.Directions, dirID)
			}
		}

		// Extract colors
		for colorID := range vis.Colors {
			if id, err := strconv.Atoi(colorID); err == nil {
				info.Colors = append(info.Colors, id)
			}
		}

		// Extract states (animations)
		for stateID := range vis.Animations {
			if id, err := strconv.Atoi(stateID); err == nil {
				info.States = append(info.States, id)
			}
		}

		// Verificar si hay animaciones
		if len(vis.Animations) > 0 {
			info.HasAnimation = true
		}
	}

	// Extraer direcciones del modelo lógico si no hay en visualizaciones
	if len(info.Directions) == 0 && len(furniData.Logic.Model.Directions) > 0 {
		info.Directions = furniData.Logic.Model.Directions
	}

	// Si no hay direcciones, agregar direcciones por defecto
	if len(info.Directions) == 0 {
		info.Directions = []int{0, 2, 4, 6} // Direcciones isométricas básicas
	}

	// Ordenar los arrays para consistencia
	sort.Ints(info.Directions)
	sort.Ints(info.States)
	sort.Ints(info.Colors)

	// If no states, add default state
	if len(info.States) == 0 {
		info.States = []int{0}
	}

	// If no colors, add default color
	if len(info.Colors) == 0 {
		info.Colors = []int{0}
	}

	// Extraer dimensiones del modelo
	// Commented: don't override visualization size with model dimensions
	// if furniData.Logic.Model.Dimensions.X > 0 {
	//	info.Size = int(furniData.Logic.Model.Dimensions.X)
	// }

	return info, nil
}



// getFileNameWithoutExt gets filename without extension
func getFileNameWithoutExt(filepath string) string {
	base := filepath[strings.LastIndex(filepath, "/")+1:]
	if strings.LastIndex(base, ".") > 0 {
		return base[:strings.LastIndex(base, ".")]
	}
	return base
}



// LoadNitroLibrary loads a .nitro file and returns a NitroLibrary
func LoadNitroLibrary(filepath string) (*NitroLibrary, error) {
	archive, err := loadNitroArchive(filepath)
	if err != nil {
		return nil, err
	}

	// Search for JSON file
	var furni *NitroFurni
	var originalJSON []byte
	for _, file := range archive.Files {
		if strings.HasSuffix(file.Name, ".json") {
			originalJSON = file.Data // Preservar el JSON original
			err := json.Unmarshal(file.Data, &furni)
			if err != nil {
				return nil, fmt.Errorf("error parsing JSON: %v", err)
			}
			break
		}
	}

	if furni == nil {
		return nil, fmt.Errorf("JSON file not found in .nitro")
	}

	return &NitroLibrary{
		Archive:      archive,
		FilePath:     filepath,
		Furni:        furni,
		OriginalJSON: originalJSON,
	}, nil
}

// GetJSONContent returns JSON content as string
func (lib *NitroLibrary) GetJSONContent() (string, error) {
	// Si tenemos JSON original, solo formatearlo sin reorganizar
	if lib.OriginalJSON != nil {
		// Usar un buffer para formatear manualmente preservando el orden
		var buf bytes.Buffer
		err := json.Indent(&buf, lib.OriginalJSON, "", "  ")
		if err != nil {
			return "", fmt.Errorf("error formatting JSON: %v", err)
		}
		return buf.String(), nil
	}
	
	// Fallback: serializar la estructura si no hay JSON original
	jsonBytes, err := json.MarshalIndent(lib.Furni, "", "  ")
	if err != nil {
		return "", fmt.Errorf("error serializing JSON: %v", err)
	}
	return string(jsonBytes), nil
}

// UpdateJSONContent updates JSON content
func (lib *NitroLibrary) UpdateJSONContent(jsonData map[string]interface{}) error {
	// Convertir el map a JSON y luego deserializar en la estructura
	jsonBytes, err := json.Marshal(jsonData)
	if err != nil {
		return fmt.Errorf("error serializing JSON data: %v", err)
	}

	var newFurni NitroFurni
	err = json.Unmarshal(jsonBytes, &newFurni)
	if err != nil {
		return fmt.Errorf("error deserializing JSON: %v", err)
	}

	lib.Furni = &newFurni
	// Also update original JSON with new content
	lib.OriginalJSON = jsonBytes
	return nil
}

// Save saves updated .nitro file
func (lib *NitroLibrary) Save(filepath string) error {
	// Usar el JSON original actualizado si está disponible
	var jsonBytes []byte
	if lib.OriginalJSON != nil {
		jsonBytes = lib.OriginalJSON
	} else {
		// Fallback: serializar la estructura
		var err error
		jsonBytes, err = json.Marshal(lib.Furni)
		if err != nil {
			return fmt.Errorf("error serializing JSON: %v", err)
		}
	}

	// Update JSON file in archive
	for name, file := range lib.Archive.Files {
		if strings.HasSuffix(file.Name, ".json") {
			lib.Archive.Files[name] = NitroFile{
				Name: file.Name,
				Data: jsonBytes,
			}
			break
		}
	}

	// Write updated .nitro file
	return lib.writeNitroArchive(filepath)
}

// writeNitroArchive writes a NitroArchive to a file
func (lib *NitroLibrary) writeNitroArchive(filepath string) error {
	file, err := os.Create(filepath)
	if err != nil {
		return err
	}
	defer file.Close()

	// Write number of files (use BigEndian for consistency with reading)
	fileCount := uint16(len(lib.Archive.Files))
	err = binary.Write(file, binary.BigEndian, fileCount)
	if err != nil {
		return err
	}

	// Write each file
	for _, nitroFile := range lib.Archive.Files {
		// Write name length
		nameLen := uint16(len(nitroFile.Name))
		err = binary.Write(file, binary.BigEndian, nameLen)
		if err != nil {
			return err
		}

		// Escribir nombre
		_, err = file.WriteString(nitroFile.Name)
		if err != nil {
			return err
		}

		// Compress data
		var compressedData bytes.Buffer
		zlibWriter := zlib.NewWriter(&compressedData)
		_, err = zlibWriter.Write(nitroFile.Data)
		if err != nil {
			zlibWriter.Close()
			return err
		}
		zlibWriter.Close()

		// Write compressed data length
		compressedLen := uint32(compressedData.Len())
		err = binary.Write(file, binary.BigEndian, compressedLen)
		if err != nil {
			return err
		}

		// Escribir datos comprimidos
		_, err = file.Write(compressedData.Bytes())
		if err != nil {
			return err
		}
	}

	return nil
}



// getOriginalPNG obtiene la imagen PNG original del spritesheet
func getOriginalPNG(lib *NitroLibrary) (image.Image, error) {
	if lib.Furni.Spritesheet.Meta.Image == "" {
		return nil, fmt.Errorf("no se encontró imagen en el spritesheet")
	}

	// Search for PNG file in archive
	for fileName, file := range lib.Archive.Files {
		if fileName == lib.Furni.Spritesheet.Meta.Image {
			// Decodificar la imagen PNG
			img, err := png.Decode(bytes.NewReader(file.Data))
			if err != nil {
				return nil, fmt.Errorf("error decoding PNG: %v", err)
			}
			return img, nil
		}
	}

	return nil, fmt.Errorf("PNG file not found: %s", lib.Furni.Spritesheet.Meta.Image)
}





// drawRectangle dibuja un rectángulo en la imagen
func drawRectangle(img *image.RGBA, x, y, w, h int, c color.RGBA) {
	// Dibujar bordes del rectángulo
	for i := 0; i < w; i++ {
		if x+i >= 0 && x+i < img.Bounds().Dx() {
			if y >= 0 && y < img.Bounds().Dy() {
				img.Set(x+i, y, c) // Borde superior
			}
			if y+h-1 >= 0 && y+h-1 < img.Bounds().Dy() {
				img.Set(x+i, y+h-1, c) // Borde inferior
			}
		}
	}
	for i := 0; i < h; i++ {
		if y+i >= 0 && y+i < img.Bounds().Dy() {
			if x >= 0 && x < img.Bounds().Dx() {
				img.Set(x, y+i, c) // Borde izquierdo
			}
			if x+w-1 >= 0 && x+w-1 < img.Bounds().Dx() {
				img.Set(x+w-1, y+i, c) // Borde derecho
			}
		}
	}
}

// drawCross dibuja una cruz en la imagen
func drawCross(img *image.RGBA, x, y, size int, c color.RGBA) {
	// Línea horizontal
	for i := -size; i <= size; i++ {
		if x+i >= 0 && x+i < img.Bounds().Dx() && y >= 0 && y < img.Bounds().Dy() {
			img.Set(x+i, y, c)
		}
	}
	// Línea vertical
	for i := -size; i <= size; i++ {
		if x >= 0 && x < img.Bounds().Dx() && y+i >= 0 && y+i < img.Bounds().Dy() {
			img.Set(x, y+i, c)
		}
	}
}

// drawText dibuja texto simple en la imagen (implementación básica)
func drawText(img *image.RGBA, x, y int, text string, c color.RGBA) {
	// Implementación mejorada que dibuja texto más legible usando patrones de píxeles
	lines := strings.Split(text, "\n")
	charWidth := 8
	charHeight := 12
	
	for lineIdx, line := range lines {
		for charIdx, char := range line {
			baseX := x + charIdx*charWidth
			baseY := y + lineIdx*charHeight
			
			// Dibujar patrón básico para cada carácter
			drawCharPattern(img, baseX, baseY, char, c)
		}
	}
}

// drawCharPattern dibuja un patrón básico para caracteres comunes
func drawCharPattern(img *image.RGBA, x, y int, char rune, c color.RGBA) {
	// Patrones básicos para algunos caracteres comunes
	patterns := getCharPatterns()
	pattern, exists := patterns[char]
	
	if !exists {
		// Patrón por defecto para caracteres no definidos
		pattern = []string{
			"▓▓▓▓▓▓",
			"▓    ▓",
			"▓    ▓",
			"▓    ▓",
			"▓    ▓",
			"▓    ▓",
			"▓▓▓▓▓▓",
		}
	}
	
	for row, line := range pattern {
		for col, pixel := range line {
			if pixel != ' ' {
				pixelX := x + col
				pixelY := y + row
				if pixelX >= 0 && pixelX < img.Bounds().Dx() && pixelY >= 0 && pixelY < img.Bounds().Dy() {
					img.Set(pixelX, pixelY, c)
				}
			}
		}
	}
}

// getCharPatterns devuelve patrones de píxeles para caracteres comunes
func getCharPatterns() map[rune][]string {
	return map[rune][]string{
		'A': {"  ▓▓  ", " ▓  ▓ ", "▓    ▓", "▓▓▓▓▓▓", "▓    ▓", "▓    ▓", "      "},
		'B': {"▓▓▓▓▓ ", "▓    ▓", "▓▓▓▓▓ ", "▓    ▓", "▓    ▓", "▓▓▓▓▓ ", "      "},
		'C': {" ▓▓▓▓ ", "▓    ▓", "▓     ", "▓     ", "▓    ▓", " ▓▓▓▓ ", "      "},
		'D': {"▓▓▓▓▓ ", "▓    ▓", "▓    ▓", "▓    ▓", "▓    ▓", "▓▓▓▓▓ ", "      "},
		'E': {"▓▓▓▓▓▓", "▓     ", "▓▓▓▓▓ ", "▓     ", "▓     ", "▓▓▓▓▓▓", "      "},
		'F': {"▓▓▓▓▓▓", "▓     ", "▓▓▓▓▓ ", "▓     ", "▓     ", "▓     ", "      "},
		'G': {" ▓▓▓▓ ", "▓    ▓", "▓     ", "▓  ▓▓▓", "▓    ▓", " ▓▓▓▓ ", "      "},
		'H': {"▓    ▓", "▓    ▓", "▓▓▓▓▓▓", "▓    ▓", "▓    ▓", "▓    ▓", "      "},
		'I': {"▓▓▓▓▓▓", "  ▓▓  ", "  ▓▓  ", "  ▓▓  ", "  ▓▓  ", "▓▓▓▓▓▓", "      "},
		'J': {"▓▓▓▓▓▓", "    ▓▓", "    ▓▓", "    ▓▓", "▓   ▓▓", " ▓▓▓▓ ", "      "},
		'K': {"▓    ▓", "▓   ▓ ", "▓▓▓▓  ", "▓   ▓ ", "▓    ▓", "▓    ▓", "      "},
		'L': {"▓     ", "▓     ", "▓     ", "▓     ", "▓     ", "▓▓▓▓▓▓", "      "},
		'M': {"▓    ▓", "▓▓  ▓▓", "▓ ▓▓ ▓", "▓    ▓", "▓    ▓", "▓    ▓", "      "},
		'N': {"▓    ▓", "▓▓   ▓", "▓ ▓  ▓", "▓  ▓ ▓", "▓   ▓▓", "▓    ▓", "      "},
		'O': {" ▓▓▓▓ ", "▓    ▓", "▓    ▓", "▓    ▓", "▓    ▓", " ▓▓▓▓ ", "      "},
		'P': {"▓▓▓▓▓ ", "▓    ▓", "▓▓▓▓▓ ", "▓     ", "▓     ", "▓     ", "      "},
		'Q': {" ▓▓▓▓ ", "▓    ▓", "▓    ▓", "▓  ▓ ▓", "▓   ▓▓", " ▓▓▓▓▓", "      "},
		'R': {"▓▓▓▓▓ ", "▓    ▓", "▓▓▓▓▓ ", "▓   ▓ ", "▓    ▓", "▓    ▓", "      "},
		'S': {" ▓▓▓▓ ", "▓    ▓", " ▓▓▓  ", "    ▓▓", "▓    ▓", " ▓▓▓▓ ", "      "},
		'T': {"▓▓▓▓▓▓", "  ▓▓  ", "  ▓▓  ", "  ▓▓  ", "  ▓▓  ", "  ▓▓  ", "      "},
		'U': {"▓    ▓", "▓    ▓", "▓    ▓", "▓    ▓", "▓    ▓", " ▓▓▓▓ ", "      "},
		'V': {"▓    ▓", "▓    ▓", "▓    ▓", "▓    ▓", " ▓  ▓ ", "  ▓▓  ", "      "},
		'W': {"▓    ▓", "▓    ▓", "▓    ▓", "▓ ▓▓ ▓", "▓▓  ▓▓", "▓    ▓", "      "},
		'X': {"▓    ▓", " ▓  ▓ ", "  ▓▓  ", "  ▓▓  ", " ▓  ▓ ", "▓    ▓", "      "},
		'Y': {"▓    ▓", " ▓  ▓ ", "  ▓▓  ", "  ▓▓  ", "  ▓▓  ", "  ▓▓  ", "      "},
		'Z': {"▓▓▓▓▓▓", "    ▓ ", "   ▓  ", "  ▓   ", " ▓    ", "▓▓▓▓▓▓", "      "},
		'0': {" ▓▓▓▓ ", "▓    ▓", "▓   ▓▓", "▓  ▓ ▓", "▓▓   ▓", " ▓▓▓▓ ", "      "},
		'1': {"  ▓▓  ", " ▓▓▓  ", "  ▓▓  ", "  ▓▓  ", "  ▓▓  ", "▓▓▓▓▓▓", "      "},
		'2': {" ▓▓▓▓ ", "▓    ▓", "    ▓▓", "  ▓▓  ", " ▓    ", "▓▓▓▓▓▓", "      "},
		'3': {" ▓▓▓▓ ", "▓    ▓", "  ▓▓▓ ", "     ▓", "▓    ▓", " ▓▓▓▓ ", "      "},
		'4': {"   ▓▓ ", "  ▓▓▓ ", " ▓ ▓▓ ", "▓▓▓▓▓▓", "   ▓▓ ", "   ▓▓ ", "      "},
		'5': {"▓▓▓▓▓▓", "▓     ", "▓▓▓▓▓ ", "     ▓", "▓    ▓", " ▓▓▓▓ ", "      "},
		'6': {" ▓▓▓▓ ", "▓    ▓", "▓▓▓▓▓ ", "▓    ▓", "▓    ▓", " ▓▓▓▓ ", "      "},
		'7': {"▓▓▓▓▓▓", "    ▓ ", "   ▓  ", "  ▓   ", " ▓    ", "▓     ", "      "},
		'8': {" ▓▓▓▓ ", "▓    ▓", " ▓▓▓▓ ", "▓    ▓", "▓    ▓", " ▓▓▓▓ ", "      "},
		'9': {" ▓▓▓▓ ", "▓    ▓", "▓    ▓", " ▓▓▓▓▓", "▓    ▓", " ▓▓▓▓ ", "      "},
		' ': {"      ", "      ", "      ", "      ", "      ", "      ", "      "},
		':': {"      ", "  ▓▓  ", "  ▓▓  ", "      ", "  ▓▓  ", "  ▓▓  ", "      "},
		'(': {"   ▓▓ ", "  ▓   ", " ▓    ", " ▓    ", "  ▓   ", "   ▓▓ ", "      "},
		')': {" ▓▓   ", "   ▓  ", "    ▓ ", "    ▓ ", "   ▓  ", " ▓▓   ", "      "},
		'-': {"      ", "      ", "▓▓▓▓▓▓", "      ", "      ", "      ", "      "},
		'_': {"      ", "      ", "      ", "      ", "      ", "▓▓▓▓▓▓", "      "},
		'.': {"      ", "      ", "      ", "      ", "  ▓▓  ", "  ▓▓  ", "      "},
		',': {"      ", "      ", "      ", "  ▓▓  ", "  ▓▓  ", " ▓    ", "      "},
		'•': {"      ", "      ", "  ▓▓  ", "  ▓▓  ", "      ", "      ", "      "},
		'+': {"      ", "  ▓▓  ", "▓▓▓▓▓▓", "  ▓▓  ", "      ", "      ", "      "},
		'/': {"     ▓", "    ▓ ", "   ▓  ", "  ▓   ", " ▓    ", "▓     ", "      "},
		'\\': {"▓     ", " ▓    ", "  ▓   ", "   ▓  ", "    ▓ ", "     ▓", "      "},
		'%': {"▓▓   ▓", "▓▓  ▓ ", "   ▓  ", "  ▓   ", " ▓  ▓▓", "▓   ▓▓", "      "},
	}
}

// drawTextLarge dibuja texto más grande para mejor visibilidad
func drawTextLarge(img *image.RGBA, x, y int, text string, c color.RGBA, scaleFactor int) {
	lines := strings.Split(text, "\n")
	charWidth := 6 * scaleFactor
	charHeight := 10 * scaleFactor
	pixelSize := scaleFactor
	
	for lineIdx, line := range lines {
		for charIdx := range line {
			baseX := x + charIdx*charWidth
			baseY := y + lineIdx*charHeight
			
			// Draw larger pixels
			for py := 0; py < pixelSize*2; py++ {
				for px := 0; px < pixelSize*2; px++ {
					pixelX := baseX + px
					pixelY := baseY + py
					if pixelX >= 0 && pixelX < img.Bounds().Dx() && pixelY >= 0 && pixelY < img.Bounds().Dy() {
						img.Set(pixelX, pixelY, c)
					}
				}
			}
		}
	}
}

// drawRectangleThick dibuja un rectángulo con grosor específico
func drawRectangleThick(img *image.RGBA, x, y, w, h int, c color.RGBA, thickness int) {
	// Dibujar bordes del rectángulo con grosor
	for t := 0; t < thickness; t++ {
		// Bordes horizontales
		for i := 0; i < w; i++ {
			if x+i >= 0 && x+i < img.Bounds().Dx() {
				if y+t >= 0 && y+t < img.Bounds().Dy() {
					img.Set(x+i, y+t, c) // Borde superior
				}
				if y+h-1-t >= 0 && y+h-1-t < img.Bounds().Dy() {
					img.Set(x+i, y+h-1-t, c) // Borde inferior
				}
			}
		}
		// Bordes verticales
		for i := 0; i < h; i++ {
			if y+i >= 0 && y+i < img.Bounds().Dy() {
				if x+t >= 0 && x+t < img.Bounds().Dx() {
					img.Set(x+t, y+i, c) // Borde izquierdo
				}
				if x+w-1-t >= 0 && x+w-1-t < img.Bounds().Dx() {
					img.Set(x+w-1-t, y+i, c) // Borde derecho
				}
			}
		}
	}
}

// drawCrossLarge dibuja una cruz más grande
func drawCrossLarge(img *image.RGBA, x, y, size int, c color.RGBA) {
	thickness := max(1, size/5)
	
	// Línea horizontal
	for i := -size; i <= size; i++ {
		for t := -thickness; t <= thickness; t++ {
			if x+i >= 0 && x+i < img.Bounds().Dx() && y+t >= 0 && y+t < img.Bounds().Dy() {
				img.Set(x+i, y+t, c)
			}
		}
	}
	// Línea vertical
	for i := -size; i <= size; i++ {
		for t := -thickness; t <= thickness; t++ {
			if x+t >= 0 && x+t < img.Bounds().Dx() && y+i >= 0 && y+i < img.Bounds().Dy() {
				img.Set(x+t, y+i, c)
			}
		}
	}
}

// drawLegend dibuja una leyenda explicativa
func drawDetailedLegend(img *image.RGBA, width, startY int, frameNames, assetNames []string) {
	legendBg := color.RGBA{250, 250, 250, 255}
	headerBg := color.RGBA{220, 230, 240, 255}
	textColor := color.RGBA{20, 20, 20, 255}
	headerColor := color.RGBA{0, 50, 100, 255}
	blueColor := color.RGBA{0, 100, 200, 255}
	greenColor := color.RGBA{0, 150, 50, 255}
	separatorColor := color.RGBA{200, 200, 200, 255}
	
	// Llenar fondo de la leyenda
	for y := startY; y < img.Bounds().Dy(); y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, legendBg)
		}
	}
	
	currentY := startY + 15
	
	// Título principal con fondo
	drawRectangle(img, 5, currentY-5, width-10, 25, headerBg)
	drawText(img, 15, currentY+5, "INTERACTIVE NITRO ANALYZER", headerColor)
	currentY += 35
	
	// Separador
	drawRectangle(img, 10, currentY, width-20, 2, separatorColor)
	currentY += 15
	
	// Sección de Frames
	drawText(img, 10, currentY, "SPRITESHEET FRAMES:", headerColor)
	currentY += 20
	
	// Explicación de frames con icono
	drawRectangle(img, 15, currentY-2, 20, 12, blueColor)
	drawText(img, 45, currentY, fmt.Sprintf("Total: %d frames (Blue rectangles with dimensions)", len(frameNames)), textColor)
	currentY += 20
	
	// Listar frames con más información
	maxFramesToShow := 6
	for i, frameName := range frameNames {
		if i >= maxFramesToShow {
			drawText(img, 25, currentY, fmt.Sprintf("▶ View %d additional frames in image...", len(frameNames)-maxFramesToShow), color.RGBA{100, 100, 100, 255})
			currentY += 15
			break
		}
		
		blueShades := []color.RGBA{
			{0, 0, 255, 180}, {0, 100, 255, 180}, {0, 150, 255, 180}, 
			{100, 150, 255, 180}, {50, 50, 255, 180}, {150, 200, 255, 180},
		}
		frameColor := blueShades[i%len(blueShades)]
		
		// Indicador de color
		drawRectangle(img, 25, currentY-2, 12, 10, frameColor)
		
		// Nombre del frame
		displayName := frameName
		if len(displayName) > 30 {
			displayName = displayName[:27] + "..."
		}
		drawText(img, 45, currentY, fmt.Sprintf("%d. %s", i+1, displayName), textColor)
		currentY += 15
	}
	
	currentY += 10
	
	// Separador
	drawRectangle(img, 10, currentY, width-20, 1, separatorColor)
	currentY += 15
	
	// Sección de Assets
	drawText(img, 10, currentY, "ASSETS AND CONFIGURATION:", headerColor)
	currentY += 20
	
	// Explicación de assets con icono
	drawCross(img, 25, currentY+3, 8, greenColor)
	drawText(img, 45, currentY, fmt.Sprintf("Total: %d assets (Green crosses with coordinates)", len(assetNames)), textColor)
	currentY += 20
	
	// Listar assets con más información
	maxAssetsToShow := 6
	for i, assetName := range assetNames {
		if i >= maxAssetsToShow {
			drawText(img, 25, currentY, fmt.Sprintf("▶ View %d additional assets in image...", len(assetNames)-maxAssetsToShow), color.RGBA{100, 100, 100, 255})
			currentY += 15
			break
		}
		
		greenShades := []color.RGBA{
			{0, 255, 0, 180}, {100, 255, 0, 180}, {0, 255, 100, 180}, 
			{150, 255, 150, 180}, {0, 200, 0, 180}, {200, 255, 200, 180},
		}
		assetColor := greenShades[i%len(greenShades)]
		
		// Indicador de color
		drawCross(img, 31, currentY+3, 6, assetColor)
		
		// Nombre del asset
		displayName := assetName
		if len(displayName) > 30 {
			displayName = displayName[:27] + "..."
		}
		drawText(img, 45, currentY, fmt.Sprintf("%d. %s", i+1, displayName), textColor)
		currentY += 15
	}
	
	currentY += 15
	
	// Separador
	drawRectangle(img, 10, currentY, width-20, 1, separatorColor)
	currentY += 15
	
	// Información de uso
	drawText(img, 10, currentY, "USAGE GUIDE:", headerColor)
	currentY += 20
	
	drawText(img, 15, currentY, "• Frames: Original spritesheet areas (WxH)", textColor)
	currentY += 15
	drawText(img, 15, currentY, "• Assets: Positioning points (X,Y offset)", textColor)
	currentY += 15
	drawText(img, 15, currentY, "• Image scaled 3x for better visualization", textColor)
	currentY += 15
	drawText(img, 15, currentY, "• Unique colors for quick identification", textColor)
	currentY += 15
	drawText(img, 15, currentY, "• Real names extracted from JSON file", textColor)
	
	// Footer con información técnica
	if currentY < img.Bounds().Dy() - 30 {
		currentY = img.Bounds().Dy() - 25
		drawRectangle(img, 5, currentY-5, width-10, 20, color.RGBA{240, 240, 240, 255})
		drawText(img, 10, currentY, "Nitro Viewer - Habbo .nitro file analysis", color.RGBA{100, 100, 100, 255})
	}
}

// createModifiedNitroFile creates a new .nitro file with applied modifications
func createModifiedNitroFile(lib *NitroLibrary, filename string) ([]byte, error) {
	// The .nitro file already contains all saved modifications
	// We only need to recreate the file from current library
	return createNitroArchive(lib.Archive)
}

// createNitroArchive creates a .nitro file from a NitroArchive
func createNitroArchive(archive *NitroArchive) ([]byte, error) {
	var buffer bytes.Buffer

	// Write number of files (using BigEndian for consistency with reading)
	fileCount := uint16(len(archive.Files))
	if err := binary.Write(&buffer, binary.BigEndian, fileCount); err != nil {
		return nil, fmt.Errorf("error writing file count: %v", err)
	}

	// Write each file
	for _, file := range archive.Files {
		// Write name length
		nameLength := uint16(len(file.Name))
		if err := binary.Write(&buffer, binary.BigEndian, nameLength); err != nil {
			return nil, fmt.Errorf("error writing name length: %v", err)
		}

		// Write filename
		if _, err := buffer.WriteString(file.Name); err != nil {
			return nil, fmt.Errorf("error writing filename: %v", err)
		}

		// Comprimir datos
		var compressedData bytes.Buffer
		zlibWriter := zlib.NewWriter(&compressedData)
		if _, err := zlibWriter.Write(file.Data); err != nil {
			zlibWriter.Close()
			return nil, fmt.Errorf("error compressing data: %v", err)
		}
		zlibWriter.Close()

		// Escribir longitud de datos comprimidos
		compressedLength := uint32(compressedData.Len())
		if err := binary.Write(&buffer, binary.BigEndian, compressedLength); err != nil {
			return nil, fmt.Errorf("error writing data length: %v", err)
		}

		// Write compressed data
		if _, err := buffer.Write(compressedData.Bytes()); err != nil {
			return nil, fmt.Errorf("error writing file data: %v", err)
		}
	}

	return buffer.Bytes(), nil
}