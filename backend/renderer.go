package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"xabbo.io/nx/imager"
	"xabbo.io/nx/raw/nitro"
	"xabbo.io/nx/res"
)

// LibraryManager simple para manejar una sola biblioteca
type SimpleLibraryManager struct {
	lib res.FurniLibrary
}

func (m *SimpleLibraryManager) Library(name string) res.AssetLibrary {
	return m.lib
}

func (m *SimpleLibraryManager) Libraries() []string {
	if m.lib != nil {
		return []string{m.lib.Name()}
	}
	return []string{}
}

func (m *SimpleLibraryManager) LibraryExists(name string) bool {
	return m.lib != nil && m.lib.Name() == name
}

func (m *SimpleLibraryManager) AddLibrary(lib res.AssetLibrary) bool {
	// Para este caso simple, solo reemplazamos la biblioteca
	if furniLib, ok := lib.(res.FurniLibrary); ok {
		m.lib = furniLib
		return true
	}
	return false
}

func NewSimpleLibraryManager(lib res.FurniLibrary) *SimpleLibraryManager {
	return &SimpleLibraryManager{lib: lib}
}

// renderFurniToGIF renderiza un mueble a GIF usando el sistema de imager de nx
func renderFurniToGIF(req RenderRequest) (string, error) {
	fmt.Printf("[DEBUG] Rendering request: %+v\n", req)
	
	// Load .nitro file - add extension if it doesn't have one
	filename := req.Filename
	if !strings.HasSuffix(filename, ".nitro") {
		filename += ".nitro"
	}
	filePath := filepath.Join("../uploads", filename)
	fmt.Printf("[DEBUG] Loading file from path: %s\n", filePath)
	
	// Check file timestamp for debug
	fileInfo, err := os.Stat(filePath)
	if err == nil {
		fmt.Printf("[DEBUG] File last modified: %v\n", fileInfo.ModTime())
	}
	
	f, err := os.Open(filePath)
	if err != nil {
		fmt.Printf("[DEBUG] Error opening file: %v\n", err)
		return "", err
	}
	defer f.Close()

	// Read nitro file using nx reader
	r := nitro.NewReader(f)
	archive, err := r.ReadArchive()
	if err != nil {
		return "", err
	}

	// Load furni library using nx
	lib, err := res.LoadFurniLibraryNitro(archive)
	if err != nil {
		fmt.Printf("[DEBUG] Error loading furni library: %v\n", err)
		return "", err
	}
	fmt.Printf("[DEBUG] Library loaded successfully, visualizations: %v\n", len(lib.Visualizations()))
	
	// Debug: check files in archive
	fmt.Printf("[DEBUG] Archive contains %d files:\n", len(archive.Files))
	for _, file := range archive.Files {
		if strings.HasSuffix(strings.ToLower(file.Name), ".png") {
			fmt.Printf("[DEBUG] Found PNG file: %s (size: %d bytes)\n", file.Name, len(file.Data))
		}
	}

	// Crear manager y imager
	mgr := NewSimpleLibraryManager(lib)
	imgr := imager.NewFurniImager(mgr)

	// Get visualization for specified size
	fmt.Printf("[DEBUG] Available visualizations: %v\n", len(lib.Visualizations()))
	for size, v := range lib.Visualizations() {
		fmt.Printf("[DEBUG] Visualization size %d has %d directions\n", size, len(v.Directions))
	}
	vis, ok := lib.Visualizations()[req.Size]
	if !ok {
		return "", fmt.Errorf("no visualization for size: %d", req.Size)
	}
	fmt.Printf("[DEBUG] Selected visualization for size %d has %d directions\n", req.Size, len(vis.Directions))

	// Usar la misma lógica que nx: buscar direcciones válidas empezando por 2, 4, 6, 0
	direction := req.Direction

	// Check that direction is available
	fmt.Printf("[DEBUG] Available directions: %v, requested direction: %d\n", getDirectionKeys(vis.Directions), req.Direction)
	if _, ok := vis.Directions[direction]; !ok {

		// Search for first valid direction
		for i := range 4 {
			d := (2 + i*2) % 8
			if _, ok := vis.Directions[d]; ok {
				direction = d

				break
			}
		}
	} else {

	}

	// Crear especificación de furni
	furni := imager.Furni{
		Identifier: lib.Name(),
		Size:       req.Size,
		Direction:  direction,
		State:      req.State,
		Color:      req.Color,
		Shadow:     false, // Desactivar sombra para GIF como hace nx
	}

	// Componer animación
	anim, err := imgr.Compose(furni)
	if err != nil {
		return "", err
	}

	// Verificar que la animación tiene capas (como hace nx)
	if len(anim.Layers) == 0 {
		return "", fmt.Errorf("no layers in animation for direction %d, state %d", direction, req.State)
	}

	// Create output filename
	libName := lib.Name()
	if libName == "" {
		libName = strings.TrimSuffix(req.Filename, ".nitro")
	}
	fmt.Printf("[DEBUG] Library name: '%s', using: '%s'\n", lib.Name(), libName)
	outputFilename := fmt.Sprintf("%s_s%d_d%d_st%d_c%d.gif", 
		libName, req.Size, direction, req.State, req.Color)
	outputPath := filepath.Join("../static", outputFilename)

	// Crear directorio de salida si no existe
	os.MkdirAll("../static", 0755)

	// Delete existing file if it exists to force regeneration
	if _, err := os.Stat(outputPath); err == nil {
		os.Remove(outputPath)
		fmt.Printf("[DEBUG] Removed existing file: %s\n", outputPath)
	}

	// Create output file
	outFile, err := os.Create(outputPath)
	if err != nil {
		return "", err
	}
	defer outFile.Close()

	// Calcular frameCount como hace nx
	frameCount := 1
	if req.State > 0 {
		// Para animaciones, usar LongestSequence como hace nx
		frameCount = anim.LongestSequence(0)
	}

	
	// Render animation to GIF using nx encoder
	encoder := imager.NewEncoderGIF()
	err = encoder.EncodeAnimation(outFile, anim, 0, frameCount)
	if err != nil {
		return "", err
	}

	return outputFilename, nil
}

// Helper function to get direction keys for debugging
func getDirectionKeys(directions map[int]struct{}) []int {
	keys := make([]int, 0, len(directions))
	for k := range directions {
		keys = append(keys, k)
	}
	return keys
}