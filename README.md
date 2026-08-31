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

El catálogo actual contiene “Still Here (Spanish)” y “Troppy Poppy”. Los audios se sirven desde la carpeta `mimusica/` de Cloudflare R2 con CORS y solicitudes por rangos habilitados para que Web Audio pueda procesarlos en el ecualizador.

## Estructura

- `index.html`: contenido y semántica de las seis vistas.
- `styles.css`: sistema visual y responsive.
- `app.js`: navegación, catálogo musical y reproductor.
- `assets/projects/`: imágenes y evidencia visual de los casos.
- `assets/fonts/`: Archivo y Bodoni Moda servidas localmente.
- `DESIGN_SYSTEM.md`: reglas visuales y de interacción.
- `progress.txt` y `LESSONS.md`: estado y decisiones aprendidas.

Las dos canciones actuales todavía no tienen portadas en el repositorio, por lo que la interfaz usa su estado visual de respaldo. CORS y las solicitudes por rangos ya están activos para el dominio del portfolio.

## Estado del archivo — 31.08.2026

- MiEspacio Música abre una temporada nueva con dos canciones y sin recursos del catálogo anterior.
- KICK57 documenta su sistema local integrado sobre Next.js, Expo y Supabase, con los límites de producción visibles.
- HELL BREATH reúne el portal de jugadores versionado y el vertical slice local del cliente D3D11.
- Los casos sin avances verificables durante la última semana conservan su estado anterior.
