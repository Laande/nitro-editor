package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

func main() {
	// Crear directorio de uploads si no existe
	os.MkdirAll("../uploads", 0755)
	os.MkdirAll("../static", 0755)

	// Configurar Gin
	r := gin.Default()

	// Configurar CORS - Configuración permisiva para desarrollo
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "*")
		c.Header("Access-Control-Allow-Headers", "*")
		c.Header("Access-Control-Expose-Headers", "*")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusOK)
			return
		}
		c.Next()
	})

	// Serve static files
	r.Static("/static", "../static")
	r.Static("/uploads", "../uploads")

	// Servir frontend
	r.StaticFile("/", "../frontend/index.html")
	r.Static("/frontend", "../frontend")

	// Rutas API
	api := r.Group("/api")
	{
		api.POST("/upload", uploadNitroFile)
		api.POST("/render", renderFurni)
		api.GET("/info/:filename", getFurniInfo)
		api.GET("/json/:filename", getNitroJSON)
		api.PUT("/json/:filename", updateNitroJSON)
		api.GET("/png/:filename", getNitroPNG)
		api.PUT("/png/:filename", updateNitroPNG)

		api.GET("/png-original/:filename", getNitroPNGOriginal)
		api.GET("/details/:filename", getDetailedInfo)
		api.GET("/export/:filename", exportNitroFile)
	}

	log.Println("Servidor iniciado en http://localhost:7777")
	r.Run(":7777")
}

// uploadNitroFile handles .nitro file uploads
func uploadNitroFile(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Could not get file"})
		return
	}

	// Validar extensión
	if filepath.Ext(file.Filename) != ".nitro" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Only .nitro files are allowed"})
		return
	}

	// Save file temporarily with original name
	tempFilename := filepath.Base(file.Filename)
	tempFilepath := filepath.Join("../uploads", tempFilename)

	if err := c.SaveUploadedFile(file, tempFilepath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error saving file"})
		return
	}

	// Process .nitro file to get information and internal name
	info, err := processNitroFile(tempFilepath)
	if err != nil {
		// Remove temp file on error
		os.Remove(tempFilepath)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing file: " + err.Error()})
		return
	}

	// Use internal name from JSON if available, otherwise use original filename
	finalFilename := info.Name + ".nitro"
	finalFilepath := filepath.Join("../uploads", finalFilename)

	// If the final filename is different from temp, rename the file
	if tempFilename != finalFilename {
		if err := os.Rename(tempFilepath, finalFilepath); err != nil {
			// If rename fails, remove temp file
			os.Remove(tempFilepath)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error renaming file"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"filename": finalFilename,
		"info":     info,
		"message":  "File uploaded successfully",
	})
}

// renderFurni renderiza el mueble con parámetros específicos
func renderFurni(c *gin.Context) {
	var req RenderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Printf("[ERROR] renderFurni: error binding JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	log.Printf("[DEBUG] renderFurni: processing request %+v", req)

	// Render GIF
	gifPath, err := renderFurniToGIF(req)
	if err != nil {
		log.Printf("[ERROR] renderFurni: error rendering GIF: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error rendering: " + err.Error()})
		return
	}

	log.Printf("[DEBUG] renderFurni: successfully rendered GIF to %s", gifPath)
	c.JSON(http.StatusOK, gin.H{
		"gif_url": "/static/" + filepath.Base(gifPath),
	})
}

// getFurniInfo obtiene información del mueble
func getFurniInfo(c *gin.Context) {
	filename := c.Param("filename")
	
	// Asegurar que el filename tenga la extensión .nitro
	if filepath.Ext(filename) != ".nitro" {
		filename = filename + ".nitro"
	}
	
	filepath := filepath.Join("../uploads", filename)

	log.Printf("[DEBUG] getFurniInfo processing file: %s", filepath)
	info, err := processNitroFile(filepath)
	if err != nil {
		log.Printf("[ERROR] getFurniInfo: error processing file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing file: " + err.Error()})
		return
	}

	log.Printf("[DEBUG] getFurniInfo returning - Size: %d, Directions: %v, States: %v, Colors: %v", info.Size, info.Directions, info.States, info.Colors)
	c.JSON(http.StatusOK, info)
}

type RenderRequest struct {
	Filename  string `json:"filename"`
	Direction int    `json:"direction"`
	State     int    `json:"state"`
	Size      int    `json:"size"`
	Color     int    `json:"color"`
}

func getNitroJSON(c *gin.Context) {
	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Filename is required"})
		return
	}

	// Asegurar que el filename tenga la extensión .nitro
	if filepath.Ext(filename) != ".nitro" {
		filename = filename + ".nitro"
	}

	// Load .nitro file
	nitroPath := filepath.Join("../uploads", filename)
	log.Printf("[DEBUG] updateNitroPNG: loading nitro file from %s", nitroPath)
	lib, err := LoadNitroLibrary(nitroPath)
	if err != nil {
		log.Printf("[ERROR] updateNitroPNG: error loading nitro library: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error loading .nitro file: " + err.Error()})
		return
	}

	// Get JSON content
	jsonContent, err := lib.GetJSONContent()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error getting JSON content: " + err.Error()})
		return
	}

	c.Header("Content-Type", "application/json")
	c.String(http.StatusOK, jsonContent)
}

func updateNitroJSON(c *gin.Context) {
	filename := c.Param("filename")
	if filename == "" {
		log.Printf("[ERROR] updateNitroJSON: filename is required")
		c.JSON(http.StatusBadRequest, gin.H{"error": "Filename is required"})
		return
	}

	// Asegurar que el filename tenga la extensión .nitro
	if filepath.Ext(filename) != ".nitro" {
		filename = filename + ".nitro"
	}

	log.Printf("[DEBUG] updateNitroJSON: processing file %s", filename)

	// Read new JSON content from body as string
	jsonContent, err := c.GetRawData()
	if err != nil {
		log.Printf("[ERROR] updateNitroJSON: error reading JSON content: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Error reading JSON content: " + err.Error()})
		return
	}

	log.Printf("[DEBUG] updateNitroJSON: received %d bytes of JSON content", len(jsonContent))

	// Validar que sea JSON válido
	var jsonData map[string]interface{}
	if err := json.Unmarshal(jsonContent, &jsonData); err != nil {
		log.Printf("[ERROR] updateNitroJSON: invalid JSON: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "JSON inválido: " + err.Error()})
		return
	}

	// Load .nitro file
	nitroPath := filepath.Join("../uploads", filename)
	log.Printf("[DEBUG] updateNitroJSON: loading nitro file from %s", nitroPath)
	lib, err := LoadNitroLibrary(nitroPath)
	if err != nil {
		log.Printf("[ERROR] updateNitroJSON: error loading nitro library: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error loading .nitro file: " + err.Error()})
		return
	}

	// Update JSON content
	log.Printf("[DEBUG] updateNitroJSON: updating JSON content")
	err = lib.UpdateJSONContent(jsonData)
	if err != nil {
		log.Printf("[ERROR] updateNitroJSON: error updating JSON content: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating JSON content: " + err.Error()})
		return
	}

	// Save updated .nitro file
	log.Printf("[DEBUG] updateNitroJSON: saving updated nitro file")
	err = lib.Save(nitroPath)
	if err != nil {
		log.Printf("[ERROR] updateNitroJSON: error saving nitro file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error saving .nitro file: " + err.Error()})
		return
	}

	log.Printf("[DEBUG] updateNitroJSON: JSON updated successfully for %s", filename)
	c.JSON(http.StatusOK, gin.H{"message": "JSON updated successfully"})
}

// getNitroPNG extracts PNG file from .nitro
func getNitroPNG(c *gin.Context) {
	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Filename is required"})
		return
	}

	// Asegurar que el filename tenga la extensión .nitro
	if filepath.Ext(filename) != ".nitro" {
		filename = filename + ".nitro"
	}

	// Load .nitro file
	nitroPath := filepath.Join("../uploads", filename)
	lib, err := LoadNitroLibrary(nitroPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error loading .nitro file: " + err.Error()})
		return
	}

	// Search for PNG file in archive
	var pngData []byte
	for _, file := range lib.Archive.Files {
		if strings.HasSuffix(strings.ToLower(file.Name), ".png") {
			pngData = file.Data
			break
		}
	}

	if pngData == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "PNG file not found in .nitro"})
		return
	}

	// Devolver el PNG como respuesta
	c.Header("Content-Type", "image/png")
	c.Data(http.StatusOK, "image/png", pngData)
}

// updateNitroPNG updates PNG file inside .nitro
func updateNitroPNG(c *gin.Context) {
	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Filename is required"})
		return
	}

	// Asegurar que el filename tenga la extensión .nitro
	if filepath.Ext(filename) != ".nitro" {
		filename = filename + ".nitro"
	}

	log.Printf("[DEBUG] updateNitroPNG: updating PNG for file %s", filename)

	// Leer los datos PNG del body
	pngData, err := c.GetRawData()
	if err != nil {
		log.Printf("[ERROR] updateNitroPNG: error reading PNG data: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Error reading PNG data: " + err.Error()})
		return
	}

	log.Printf("[DEBUG] updateNitroPNG: received PNG data of size %d bytes", len(pngData))

	// Load .nitro file
	nitroPath := filepath.Join("../uploads", filename)
	lib, err := LoadNitroLibrary(nitroPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error loading .nitro file: " + err.Error()})
		return
	}

	// Search and update PNG file in archive
	var pngFileName string
	log.Printf("[DEBUG] updateNitroPNG: searching for PNG file in archive with %d files", len(lib.Archive.Files))
	for name, file := range lib.Archive.Files {
		log.Printf("[DEBUG] updateNitroPNG: checking file %s", file.Name)
		if strings.HasSuffix(strings.ToLower(file.Name), ".png") {
			pngFileName = file.Name
			log.Printf("[DEBUG] updateNitroPNG: found PNG file %s, updating with %d bytes", pngFileName, len(pngData))
			lib.Archive.Files[name] = NitroFile{
				Name: file.Name,
				Data: pngData,
			}
			break
		}
	}

	if pngFileName == "" {
		log.Printf("[ERROR] updateNitroPNG: no PNG file found in archive")
		c.JSON(http.StatusNotFound, gin.H{"error": "PNG file not found in .nitro"})
		return
	}

	// Guardar el archivo .nitro actualizado
	log.Printf("[DEBUG] updateNitroPNG: saving updated nitro file to %s", nitroPath)
	err = lib.Save(nitroPath)
	if err != nil {
		log.Printf("[ERROR] updateNitroPNG: error saving nitro file: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error saving .nitro file: " + err.Error()})
		return
	}

	log.Printf("[DEBUG] updateNitroPNG: PNG updated successfully for %s", filename)
	c.JSON(http.StatusOK, gin.H{"message": "PNG updated successfully"})
}



// getNitroPNGOriginal devuelve la imagen PNG original sin modificaciones
func getNitroPNGOriginal(c *gin.Context) {
	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nombre de archivo requerido"})
		return
	}

	// Asegurar que el filename tenga la extensión .nitro
	if filepath.Ext(filename) != ".nitro" {
		filename = filename + ".nitro"
	}

	// Cargar la biblioteca Nitro
	nitroPath := filepath.Join("../uploads", filename)
	lib, err := LoadNitroLibrary(nitroPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al cargar la biblioteca Nitro: " + err.Error()})
		return
	}

	// Obtener la imagen PNG original desde el archive
	if lib.Furni.Spritesheet.Meta.Image == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "No se encontró imagen en el spritesheet"})
		return
	}

	// Buscar el archivo PNG en el archive
	var pngData []byte
	for fileName, file := range lib.Archive.Files {
		if fileName == lib.Furni.Spritesheet.Meta.Image {
			pngData = file.Data
			break
		}
	}

	if len(pngData) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Archivo PNG no encontrado: " + lib.Furni.Spritesheet.Meta.Image})
		return
	}

	c.Header("Content-Type", "image/png")
	c.Header("Content-Disposition", "inline; filename=\""+strings.TrimSuffix(filename, ".nitro")+"_original.png\"")
	c.Data(http.StatusOK, "image/png", pngData)
}

// getNitroVisualizationBySize obtiene la visualización raw del JSON por tamaño
func getNitroVisualizationBySize(lib *NitroLibrary, size int) *NitroVisualization {
	for _, vis := range lib.Furni.Visualizations {
		if vis.Size == size {
			return &vis
		}
	}
	return nil
}

// getDetailedInfo devuelve información detallada de frames, assets y visualizaciones
func getDetailedInfo(c *gin.Context) {
	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nombre de archivo requerido"})
		return
	}

	// Asegurar que el filename tenga la extensión .nitro
	if filepath.Ext(filename) != ".nitro" {
		filename = filename + ".nitro"
	}

	// Cargar la biblioteca Nitro
	nitroPath := filepath.Join("../uploads", filename)
	lib, err := LoadNitroLibrary(nitroPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al cargar la biblioteca Nitro: " + err.Error()})
		return
	}

	// Extraer información detallada de frames con estructura completa
	frames := make([]map[string]interface{}, 0)
	for frameName, frame := range lib.Furni.Spritesheet.Frames {
		frames = append(frames, map[string]interface{}{
			"name":   frameName,
			"frame": map[string]interface{}{
				"x": frame.Frame.X,
				"y": frame.Frame.Y,
				"w": frame.Frame.W,
				"h": frame.Frame.H,
			},
			"rotated": frame.Rotated,
			"trimmed": frame.Trimmed,
			"spriteSourceSize": map[string]interface{}{
				"x": frame.SpriteSourceSize.X,
				"y": frame.SpriteSourceSize.Y,
				"w": frame.SpriteSourceSize.W,
				"h": frame.SpriteSourceSize.H,
			},
			"sourceSize": map[string]interface{}{
				"x": frame.SourceSize.X,
				"y": frame.SourceSize.Y,
				"w": frame.SourceSize.W,
				"h": frame.SourceSize.H,
			},
			"pivot": map[string]interface{}{
				"x": frame.Pivot.X,
				"y": frame.Pivot.Y,
			},
		})
	}

	// Extraer información detallada de assets
	assets := make([]map[string]interface{}, 0)
	for assetName, asset := range lib.Furni.Assets {
		// Construir el nombre completo del asset como lo hace nx imager
		fullAssetName := lib.Furni.Name + "_" + assetName
		sourceFrameName := ""
		if asset.Source != "" {
			sourceFrameName = lib.Furni.Name + "_" + asset.Source
		} else {
			sourceFrameName = fullAssetName
		}
		
		// Calcular offset correcto según Nitro Renderer
		// El offset debe considerar tanto la posición del asset como el spriteSourceSize
		offsetX := -asset.X
		offsetY := -asset.Y
		
		// Si existe información del frame en el spritesheet, ajustar con spriteSourceSize
		if frameData, exists := lib.Furni.Spritesheet.Frames[sourceFrameName]; exists {
			// Según Nitro, el offset final debe considerar el spriteSourceSize
			// que indica dónde está posicionado el sprite dentro del sourceSize
			offsetX += float64(frameData.SpriteSourceSize.X)
			offsetY += float64(frameData.SpriteSourceSize.Y)
		}
		
		assets = append(assets, map[string]interface{}{
			"name":    assetName,
			"source":  sourceFrameName,
			"x":       asset.X,
			"y":       asset.Y,
			"offsetX": offsetX,
			"offsetY": offsetY,
			"flipH":   asset.FlipH,
			"flipV":   asset.FlipV,
		})
	}

	// Extraer información de visualizaciones y capas
	visualizations := make([]map[string]interface{}, 0)
	for _, vis := range lib.Furni.Visualizations {
		// Extraer capas base con sus propiedades
		layers := make(map[string]interface{})
		for layerIdStr, layer := range vis.Layers {
			layers[layerIdStr] = map[string]interface{}{
				"id":          layerIdStr,
				"z":           layer.Z,
				"alpha":       layer.Alpha,
				"ink":         layer.Ink,
				"ignoreMouse": layer.IgnoreMouse,
				"color":       layer.Color,
				"x":           layer.X, // Offset base de la capa
				"y":           layer.Y, // Offset base de la capa
			}
		}
		
		// Extraer direcciones con capas específicas por dirección
		directions := make(map[string]interface{})
		for dirIdStr := range vis.Directions {
			// Obtener capas específicas de esta dirección desde el archivo JSON
			directionLayers := make(map[string]interface{})
			
			// Acceder a los datos raw del JSON para obtener los offsets de capas por dirección
			if nitroVis := getNitroVisualizationBySize(lib, vis.Size); nitroVis != nil {
				if dirData, exists := nitroVis.Directions[dirIdStr]; exists {
					// Si la dirección tiene capas específicas, extraer sus offsets
					for layerIdStr, dirLayer := range dirData.Layers {
						directionLayers[layerIdStr] = map[string]interface{}{
							"x": dirLayer.X, // Offset específico de la capa en esta dirección
							"y": dirLayer.Y, // Offset específico de la capa en esta dirección
							"z": dirLayer.Z,
							"alpha": dirLayer.Alpha,
							"ink": dirLayer.Ink,
							"ignoreMouse": dirLayer.IgnoreMouse,
							"color": dirLayer.Color,
						}
					}
				}
			}
			
			directions[dirIdStr] = map[string]interface{}{
				"id": dirIdStr,
				"layers": directionLayers,
			}
		}
		
		visualizations = append(visualizations, map[string]interface{}{
			"size":       vis.Size,
			"layerCount": vis.LayerCount,
			"angle":      vis.Angle,
			"layers":     layers,
			"directions": directions,
		})
	}

	response := map[string]interface{}{
		"frames":        frames,
		"assets":        assets,
		"visualizations": visualizations,
		"meta": map[string]interface{}{
			"name":        lib.Furni.Name,
			"logicType":   lib.Furni.LogicType,
			"visualType":  lib.Furni.VisualizationType,
			"frameCount":  len(frames),
			"assetCount":  len(assets),
			"spritesheet": lib.Furni.Spritesheet.Meta.Image,
		},
	}

	c.JSON(http.StatusOK, response)
}

// exportNitroFile exporta el archivo .nitro con las modificaciones aplicadas
func exportNitroFile(c *gin.Context) {
	filename := c.Param("filename")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nombre de archivo requerido"})
		return
	}

	// Asegurar que el filename tenga la extensión .nitro
	if filepath.Ext(filename) != ".nitro" {
		filename = filename + ".nitro"
	}

	// Cargar la biblioteca Nitro original
	nitroPath := filepath.Join("../uploads", filename)
	lib, err := LoadNitroLibrary(nitroPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al cargar la biblioteca Nitro: " + err.Error()})
		return
	}

	// Crear un nuevo archivo .nitro con las modificaciones
	exportedData, err := createModifiedNitroFile(lib, filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error al crear archivo modificado: " + err.Error()})
		return
	}

	// Configurar headers para descarga
	baseFilename := strings.TrimSuffix(filename, ".nitro")
	exportFilename := baseFilename + "_modified.nitro"
	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Disposition", "attachment; filename=\""+exportFilename+"\"")
	c.Header("Content-Length", fmt.Sprintf("%d", len(exportedData)))

	c.Data(http.StatusOK, "application/octet-stream", exportedData)
}