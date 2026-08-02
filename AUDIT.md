# Auditoría integral — 2026-08-02

## Baseline

Medición Lighthouse local antes de los cambios:

| Vista | Perfil | Performance | LCP | Payload |
|---|---:|---:|---:|---:|
| Inicio | Móvil | 70 | 12,3 s simulado | 2,17 MiB |
| Inicio | Escritorio | 84 | 2,24 s | 2,21 MiB |
| Música | Móvil | 69 | 31,5 s simulado | 38,96 MiB |

El TBT inicial era 0. El CLS de escritorio era 0,114 por inicializar `data-view` después del primer render.

## Resultado después de la implementación

Medición Lighthouse móvil local:

| Vista | Performance | Accesibilidad | Buenas prácticas | SEO | LCP | CLS | Payload |
|---|---:|---:|---:|---:|---:|---:|---:|
| Inicio | 98 | 100 | 100 | 100 | 2,0 s | 0,002 | 260 KiB |
| Música | 81 | 100 | 96 | 100 | 4,9 s | 0 | 8.914 KiB |

La portada subió de 70 a 98 y la vista de música de 69 a 81. El payload de inicio bajó de 2,17 MiB a 260 KiB y el de música de 38,96 MiB a 8,91 MiB. El siguiente salto de rendimiento depende de transformar las portadas alojadas en R2.

Segunda iteración de Música:

| Cambio | Performance | Accesibilidad | Buenas prácticas | SEO | FCP | LCP | CLS | Payload |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Portadas WebP locales + vista temprana | 94 | 100 | 100 | 100 | 2,0 s | 2,8 s | 0 | 388 KiB |
| Fuentes locales, estado final | 93 | 100 | 100 | 100 | 1,8 s | 3,0 s | 0 | 387 KiB |

Las portadas dejaron de depender de R2 y el payload de Música bajó otro 95,6%. Las diferencias de 1 punto entre corridas están dentro de la variabilidad normal; la mejora estable es transferencia, CLS y dependencia de red.

## Fase 1 — Crítica, implementada

- Controles ocultos retirados del orden de foco.
- Atajo de Espacio restringido fuera de controles interactivos.
- Historial real y foco gestionado entre vistas.
- Movimiento reducido respetado.
- Proyectos móviles reconstruidos como stack sin recorte.
- Targets del reproductor llevados a 44 × 44 px.
- Texto funcional y cuerpo aumentados.
- Imágenes locales optimizadas y portadas montadas progresivamente.

## Fase 2 — Refinamiento, parcialmente implementada

- El cromado se reservó para elementos protagonistas.
- Se documentaron tokens, roles tipográficos y reglas responsive.
- Las vistas vacías recuperaron un retorno visible.

Pendiente: separar y consolidar `styles.css`. La hoja heredada tiene más de 4.600 líneas y numerosos overrides; la capa final actual estabiliza el producto, pero no elimina esa deuda.

## Fase 3 — Dependencias externas

- Configurar CORS `GET/HEAD` en R2 para Web Audio.
- Configurar `Cache-Control: public, max-age=31536000, immutable` para archivos versionados.
- Repetir Lighthouse sobre el despliegue final cuando esas cabeceras y derivados estén activos.
