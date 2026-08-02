# CREADOR100K — Archivo personal

Portfolio estático de desarrollo, producto y música construido con HTML, CSS y JavaScript sin dependencias de runtime.

## Desarrollo local

Serví la carpeta con cualquier servidor HTTP. Por ejemplo:

```powershell
python -m http.server 4173
```

Luego abrí `http://127.0.0.1:4173/`. El servidor es necesario para probar Web Audio; abrir `index.html` con `file://` deshabilita el ecualizador.

## Estructura

- `index.html`: contenido y semántica de las cinco vistas.
- `styles.css`: sistema visual y responsive.
- `app.js`: navegación, catálogo musical y reproductor.
- `assets/projects/`: imágenes optimizadas de casos.
- `assets/covers/`: portadas musicales WebP responsivas de 360 y 720 px.
- `assets/fonts/`: Archivo y Bodoni Moda servidas localmente.
- `DESIGN_SYSTEM.md`: reglas visuales y de interacción.
- `progress.txt` y `LESSONS.md`: estado y decisiones aprendidas.

Los audios se sirven desde Cloudflare R2; las portadas optimizadas forman parte del sitio. Para que el ecualizador y el cache de audio funcionen correctamente, el bucket debe permitir CORS para el dominio del portfolio y devolver `Cache-Control` en archivos versionados.
