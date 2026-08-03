# Sistema visual CREADOR100K

## Dirección

Archivo editorial nocturno: una interfaz sobria para presentar producto, desarrollo y música. El gesto de marca es el contraste entre tipografía editorial y detalles cromados; el efecto cromado se reserva para títulos o estados protagonistas, nunca para texto de lectura.

## Tokens

- Fondo: `#020304`
- Superficie: `#0d1112`
- Texto principal: `#f1f1ed`
- Texto secundario: `#c2c8c6`
- Texto tenue: `#929b99`
- Línea: `rgba(241, 241, 237, 0.12)`
- Acento frío: `#9df2df`
- Superficie interactiva fría: verde–violeta translúcido para `hover` y foco protagonista
- Acento cálido reservado: `#ff5a2f`

## Tipografía

- Archivo: cuerpo, navegación, controles y metadatos.
- Bodoni Moda: títulos editoriales y nombres de proyectos.
- Ambas familias se sirven localmente desde `assets/fonts/`; no agregar dependencias externas para tipografía.
- Cuerpo: 15–17 px en escritorio y 16 px en móvil, con interlineado 1.5.
- Metadatos: 11–12 px; no usar texto funcional por debajo de 11 px.
- Máximo recomendado para párrafos: 46–65 caracteres.

## Interacción

- Área táctil mínima: 44 × 44 px.
- Los controles auxiliares de ventana del reproductor usan 24 × 24 px para no invadir volumen ni acciones; conservan foco visible y etiquetas accesibles.
- Foco siempre visible en controles interactivos.
- Las transiciones deben durar 150–300 ms y usar `transform` u `opacity`.
- `prefers-reduced-motion: reduce` desactiva toda animación decorativa.
- Las vistas nuevas reciben foco en su encabezado cuando la navegación es iniciada por el usuario.

## Responsive

- 320–620 px: una columna real; ningún panel lateral o transformación puede exceder el viewport.
- 621–940 px: rail horizontal para capítulos y contenido de ancho completo.
- Desde 941 px: shell de archivo con sidebar persistente.

## Medios

- Portadas musicales: WebP de 360 y 720 px con `srcset` y `sizes`.
- Montar 4 portadas al entrar en móvil y ampliar el catálogo progresivamente.
- Toda imagen debe reservar proporción, usar `decoding="async"` y ofrecer un estado de error legible.
