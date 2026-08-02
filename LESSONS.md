# Lecciones del proyecto

- No aplicar gradientes con `background-clip: text` a cuerpo, metadatos o navegación completa: el contraste se vuelve impredecible.
- Un bloque de `prefers-reduced-motion` nunca debe reactivar animaciones, aunque use una duración mayor.
- `aria-hidden` no elimina controles del orden de tabulación; los paneles cerrados necesitan `inert` o `hidden`.
- Los layouts editoriales de proyectos deben convertirse en stack real en móvil, no conservar offsets laterales y recortarlos con `overflow`.
- No montar catálogos visuales pesados fuera de la vista activa. La carga progresiva es parte del diseño, no un parche posterior.
- Inicializar `data-view` en HTML evita cambios de layout antes de que ejecute JavaScript.
- Mantener una sola fuente de verdad para tokens y movimiento; los overrides acumulados vuelven frágil la cascada.
- Los masters de imagen pueden permanecer fuera del repositorio, pero los derivados optimizados deben versionarse junto con el sitio para evitar depender de cabeceras de terceros.
- Medir CLS también en accesos directos por hash: inicializar siempre la vista correcta antes del primer render.
- Una mejora de dependencia puede reducir FCP sin elevar el score global en todas las corridas; documentar métricas individuales y no optimizar para un número aislado.
