# CREADOR100K — Archivo personal

Portfolio estático de desarrollo, producto y música construido con HTML, CSS y JavaScript sin dependencias de runtime.

## Desarrollo local

Serví la carpeta con cualquier servidor HTTP. Por ejemplo:

```powershell
python -m http.server 4173
```

Luego abrí `http://127.0.0.1:4173/`. El servidor es necesario para probar Web Audio; abrir `index.html` con `file://` deshabilita el ecualizador.

## Modo TV

Los navegadores Samsung Smart TV/Tizen activan automáticamente una interfaz musical para control remoto y abren el catálogo de canciones. La misma versión puede probarse desde una computadora agregando `?tv=1` a la URL, por ejemplo `http://127.0.0.1:4173/?tv=1#canciones`. Para desactivar una detección de TV puede usarse `?tv=0`.

En el modo TV, las flechas desplazan el foco, OK/Enter reproduce, la tecla multimedia de reproducción/pausa controla el audio y Volver regresa al inicio. La experiencia normal de escritorio no cambia.

El streaming desde Cloudflare R2 tiene CORS y solicitudes por rangos verificados para el dominio publicado. Esto permite que Web Audio procese el audio en el ecualizador; todavía falta definir `Cache-Control` para mejorar la reutilización de archivos versionados.

## Estructura

- `index.html`: contenido y semántica de las seis vistas.
- `styles.css`: sistema visual y responsive.
- `app.js`: navegación, catálogo musical y reproductor.
- `assets/projects/`: imágenes optimizadas de casos.
- `assets/covers/`: portadas musicales WebP responsivas de 360 y 720 px.
- `assets/fonts/`: Archivo y Bodoni Moda servidas localmente.
- `DESIGN_SYSTEM.md`: reglas visuales y de interacción.
- `progress.txt` y `LESSONS.md`: estado y decisiones aprendidas.

Los audios se sirven desde Cloudflare R2; las portadas optimizadas forman parte del sitio. CORS ya está activo para el dominio del portfolio. El pendiente externo es devolver `Cache-Control` en los audios versionados.
