# Mal Parqueo SM: Reto 2

**Universidad del Magdalena · Introducción a la Ingeniería de Sistemas 2026-2 · Reto No. 2**
Control de mal parqueo e invasión del espacio público en Santa Marta.

Aplicación web para reportar obstrucciones desde el celular, calcular su criticidad con reglas explícitas y ver en un mapa de calor las cuadras de mayor reincidencia.

- **Equipo:** _(nombre del equipo)_
- **Prototipo publicado:** https://blais3pasc4l.github.io/reto2-mal-parqueo/
- **Integrantes y rol:**
  | Integrante | Usuario de GitHub | Rol |
  |---|---|---|
  | | | Analista de campo y privacidad |
  | | | Integrador del mapa e instrucciones para la IA |
  | | | Ingeniero de lógica y clasificación |
  | | | Diseñador de interfaz y documentador |
- **Uso de IA:** _(declarar qué asistente usaron y para qué partes. Ejemplo: "La primera versión del código y de la documentación se generó con apoyo de un agente de IA (Grok Bot); el equipo la revisó, la probó y la ajustó.")_

> ⚠️ **Estado de los datos:** `datos/reportes.json` está vacío (`[]`). Mientras esté así, la app carga `datos/reportes_ejemplo.json`, que son **30 registros INVENTADOS** (ids `EJEMPLO-01` a `EJEMPLO-30`, campo `"ejemplo": true`) solo para probar. La app muestra un aviso amarillo de **DATOS DE EJEMPLO**. Antes de entregar hay que cargar los 30 registros reales (ver abajo).

## Cómo abrirla

La app lee los archivos JSON con `fetch`, por eso **no funciona con doble clic** (`file://`). Opciones:
- **VS Code + Live Server:** clic derecho en `index.html` → *Open with Live Server*.
- **Python:** en la carpeta del proyecto, `python -m http.server 8000` y abrir http://localhost:8000
- **GitHub Pages:** la dirección publicada (ver abajo).

El mapa base (OpenStreetMap) necesita internet. Leaflet y Leaflet.heat ya vienen en `lib/`. **Plan de contingencia:** grabar un video corto del prototipo funcionando.

## Qué hace (requerimientos)

| RF | Dónde | Cómo probarlo |
|---|---|---|
| RF-01 Captura rápida y ubicada | Vista **Reportar** (`captura.js`) | Tocar el mapa o "Usar mi ubicación" → la cuadra se detecta sola → categoría → actor → foto opcional (se reduce a 800 px; tocar la foto pixela placas/rostros) → Guardar. Muestra el tiempo usado. |
| RF-02 Índice de criticidad | `criticidad.js` + `criterios.json` + `vias.json` | Al guardar se muestra "3 (categoría) + 3 (vía arterial) + 3 (hora pico) = 9 · Alto". Ver `documentos/criterios-justificacion.md`. |
| RF-03 Mapa de calor | Vista **Tablero** (`mapa.js`) | Intensidad = puntaje / 9. Casilla "Ver puntos individuales" (clic en un punto = detalle del cálculo). |
| Extra: mapa de hexágonos | Casilla **"Ver hexágonos"** (`hexagonos.js` + `mapa.js`) | Capa opcional, **adicional** a la de Leaflet.heat (no la reemplaza). Divide la zona en hexágonos de 50 m de ancho (`criterios.json` → `mapa_hexagonos.ancho_metros`); el color de cada uno = **suma de los puntajes** de los reportes que caen dentro. Respeta los filtros. Pasar el mouse o tocar un hexágono muestra cuántos reportes tiene y su suma. |
| RF-04 Filtros | Panel de filtros (`filtros.js`) | Cuadra o sector, franja, categoría, actor y rango de horas. El mapa, los conteos, el resumen y la tabla se actualizan sin recargar. La tabla "Reportes filtrados" sirve para contar a mano. |
| RF-05 Resumen operativo | `resumen.js` | 5 cuadras con mayor puntaje acumulado, cada recomendación con la regla que la produjo (R0–R5). Botón Imprimir. |
| RF-06 Exportar e importar | Sección "Reunir datos de varios celulares" | Exportar descarga los reportes de ese navegador; Importar acepta varios archivos y omite los `id` repetidos. |

Casos de uso: **CU-01** vista Reportar · **CU-02** Tablero → filtro "Sector" + Desde 11:00 / Hasta 14:00 (o franja pico) → mapa + porcentajes por categoría · **CU-03** Resumen operativo · **CU-04** Exportar en cada celular → Importar todos en un computador.

## Estructura

```
index.html              dos vistas: #captura (celular) y #tablero
css/estilos.css         diseño "primero celular" + estilos de impresión
js/criticidad.js        puntaje y nivel (no toca la pantalla, se prueba solo)
js/filtros.js           "para cada reporte, si cumple los filtros, se muestra"
js/resumen.js           agrupa por cuadra, suma, ordena, top 5 y reglas R0–R5
js/datos.js             lectura de JSON, localStorage, unir sin duplicados, exportar
js/hexagonos.js         agrupa reportes en hexágonos (cantidad y suma de puntajes), sin librerías
js/mapa.js              mapa base, cuadras, capa de calor, capa de puntos y capa de hexágonos
js/captura.js           ubicación, cuadra más cercana, foto ≤ 800 px, pixelado, guardar
js/app.js               arranque, vistas y tablero
datos/vias.json         10 cuadras del sector Unimagdalena con tipo de vía (arterial / secundaria) y esquinas
datos/criterios.json    pesos, horas pico, rangos de nivel, umbrales del resumen y ancho de los hexágonos
datos/reportes.json     ← AQUÍ VAN LOS 30 REGISTROS REALES (hoy vacío: [])
datos/reportes_ejemplo.json   datos inventados para probar (se ignoran si reportes.json tiene datos)
datos/fotos/            fotos anonimizadas de los registros precargados
lib/                    Leaflet 1.9.4 y Leaflet.heat 0.2.0 (copias locales)
pruebas/pruebas.js      pruebas automáticas: node pruebas/pruebas.js
documentos/             justificación de pesos, arquitectura, bitácora, anexo, prueba de 30 s, guía de sustentación
```

## Zona de estudio

Sector Universidad del Magdalena, 10 cuadras alrededor de la entrada principal (Portal Universitario, centro `[11.22624, -74.18860]`). Esquinas tomadas de cruces de OpenStreetMap. Clasificación: *arterial* = OSM primary, trunk o secondary; el resto es *secundaria*.
- **Arterial:** Avenida del Río (OSM `secondary`) entre Calle 29C2–Calle 29D y Calle 29D–Calle 29E.
- **Secundaria:** Carrera 22 y Carrera 22A a lo largo de la reja oeste del campus (entre Calle 29I3 y Calle 29D) y las transversales Calle 29I y Calle 29H3 hasta Carrera 21 E.

En OSM, la Avenida del Ferrocarril es `primary` (arterial) pero corre unos 600 m al oeste, y la Carrera 32 no pasa por esta entrada (aparece más al este y al norte/sur del campus). El analista de campo debe confirmar la clasificación en el recorrido.

**El analista de campo debe verificar la clasificación en el recorrido** y corregir `datos/vias.json` si hace falta (se puede cambiar la zona entera: basta con poner otras cuadras con sus esquinas).

## Cómo reemplazar los datos de ejemplo por los reales

1. **Recorridos:** dos por el mismo trayecto, uno en hora pico y otro en hora valle, hasta tener ≥ 30 registros (planilla: `documentos/planilla-campo.csv`). Fotos desde el andén, sin placas ni rostros (pixelar con un toque en la app o antes de subirlas).
2. **Captura:** cada integrante registra en la app publicada desde su celular (origen `campo`). Si un registro se tomó solo en planilla, se puede pasar después con "Más opciones → Fecha y hora".
3. **Reunir:** en cada celular, Tablero → **Exportar mis reportes (JSON)**. En un computador, **Importar archivos JSON** con todos los archivos (los repetidos se omiten).
4. **Generar el archivo definitivo:** en ese computador, **Generar reportes.json + fotos**. Copiar `reportes.json` a `datos/` (reemplazando el `[]`) y las fotos `.jpg` a `datos/fotos/`.
5. Recargar: el aviso de DATOS DE EJEMPLO desaparece. Revisar en la tabla del tablero que estén los 30 y que haya de las dos franjas.
6. Opcional: borrar `datos/reportes_ejemplo.json` (si `reportes.json` tiene datos, ya no se usa).
7. Rehacer los dos cálculos a mano de `documentos/criterios-justificacion.md` con dos registros reales y actualizar `pruebas/pruebas.js` si cambian pesos.

## Publicar en GitHub Pages

1. Un integrante crea un repositorio **público** (por ejemplo `nombre-equipo-reto-2`) y agrega a los otros tres como colaboradores.
2. Subir todo el contenido de esta carpeta a la raíz del repositorio (`index.html` debe quedar en la raíz). Cada integrante sube sus aportes desde su propia cuenta, con mensajes de commit claros.
3. En el repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save**.
4. En uno o dos minutos queda en `https://blais3pasc4l.github.io/reto2-mal-parqueo/` (o `https://USUARIO.github.io/NOMBRE-DEL-REPO/` si cambian el repositorio). Poner ese enlace arriba en este README.
5. GitHub Pages usa https, así que la ubicación del celular funciona (el navegador pide permiso).

Todas las rutas son relativas (`datos/…`, `js/…`, `lib/…`), así que funciona igual en local y en Pages. El archivo `.nojekyll` evita que GitHub procese la carpeta.

## Pruebas

- `node pruebas/pruebas.js`: 60 pruebas de criticidad (incluye los dos casos a mano), bordes de franja, rangos, filtros contra un conteo independiente, resumen y reglas, importación sin duplicados, efecto de cambiar un peso y la geometría de los hexágonos (ningún reporte se pierde ni se repite, las sumas cuadran y respetan los filtros).
- Prueba manual en el navegador: ver `documentos/prueba-30-segundos.md`.

## Privacidad

No se identifican vehículos ni personas. Por la Ley 1581 de 2012, ninguna foto debe mostrar placas ni rostros. Los reportes nuevos solo viven en el navegador que los creó hasta que se exportan.

## Créditos

Mapa © colaboradores de OpenStreetMap. [Leaflet](https://leafletjs.com) (BSD-2) y [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat) (BSD-2).
