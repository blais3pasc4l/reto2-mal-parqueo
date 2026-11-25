# Guía para la sustentación

La sustentación dura 15 minutos: 5 para mostrar los casos de uso y 10 de preguntas. El docente escoge a un integrante al azar y le pide **cambiar un valor en los archivos de datos y explicar el efecto**. No se pide programar en vivo.

## 1. Qué hace cada archivo (decirlo con sus palabras)

| Archivo | Qué hace | Entradas → pasos → salida |
|---|---|---|
| `index.html` | La página. Tiene dos vistas: **Reportar** (`#captura`) y **Tablero** (`#tablero`). Carga los scripts en orden. | — |
| `css/estilos.css` | Colores, tamaños y diseño para celular (botones grandes). Define qué se imprime. | — |
| `js/datos.js` | Lee los tres JSON de `datos/`, guarda y lee reportes en `localStorage`, une listas sin repetir `id`, exporta/importa. | archivos → lista de reportes |
| `js/criticidad.js` | **Calcula el puntaje y el nivel** de un reporte. No toca la pantalla. | reporte + vias + criterios → {puntaje, nivel} |
| `js/filtros.js` | **Para cada reporte, si cumple los filtros elegidos, se muestra.** | lista + filtros → lista filtrada |
| `js/resumen.js` | Agrupa por cuadra, suma puntajes, ordena, toma las 5 primeras y aplica las reglas R0–R5. | lista → 5 cuadras con recomendación y regla |
| `js/hexagonos.js` | **Para cada reporte**, calcula en qué hexágono cae (pasando lat/lng a metros) y **acumula** cantidad y suma de puntajes por hexágono. Calcula las 6 esquinas de cada uno. Sin librerías. | lista + ancho → hexágonos {cantidad, suma, esquinas} |
| `js/mapa.js` | Mapa base de OpenStreetMap, líneas de las cuadras, capa de calor (Leaflet.heat), capa de puntos y capa opcional de hexágonos. | lista → dibujo |
| `js/captura.js` | Formulario: ubicación (toque o GPS), cuadra más cercana, foto reducida a 800 px y pixelado, validación, guardado, cronómetro. | toques → reporte guardado |
| `js/app.js` | Arranca todo, recalcula la criticidad con los pesos actuales, cambia de vista y redibuja el tablero cuando cambia un filtro. | — |
| `datos/vias.json` | Las 8 cuadras: id, nombre, sector, **tipo de vía** y esquinas (coordenadas). | — |
| `datos/criterios.json` | **Pesos**, horas pico, rangos de nivel y umbrales del resumen. | — |
| `datos/reportes.json` | Los 30 registros reales de campo (vacío `[]` hasta que el equipo los cargue). | — |
| `datos/reportes_ejemplo.json` | Datos **inventados** para probar. Solo se usan si `reportes.json` está vacío. | — |
| `pruebas/pruebas.js` | Pruebas automáticas de la lógica (`node pruebas/pruebas.js`). | — |

## 2. Cómo hacer el cambio en vivo

1. Abrir `datos/criterios.json` (o `vias.json`) en VS Code.
2. Cambiar el número y guardar.
3. Recargar la página (Live Server lo hace solo). La app **recalcula la criticidad de todos los reportes** con los pesos nuevos.
4. Mostrar: el número de un punto (clic en el punto con "Ver puntos individuales"), los conteos "Por nivel", el mapa de calor y el resumen operativo.
5. Abrir "Pesos en uso" en el tablero para mostrar que la app leyó el valor nuevo.

## 3. Efectos ya calculados con los datos de ejemplo

(Con los datos reales los números cambian; repitan este ejercicio con sus datos antes de la sustentación.)

| Cambio en el archivo | Qué se ve en el prototipo |
|---|---|
| Ninguno (valores actuales) | Top 5: ARIO-C29D-C29E (53), ARIO-C29C2-C29D (34), CR22-C29I-C29H3 (27), C29H3-CR22-CR21E (18), CR22-C29E-C29D (12). Niveles: 18 Alto, 6 Medio, 6 Bajo. |
| `criterios.json`: `"invasion_anden": 2` → `3` | Todos los reportes de invasión suben 1 punto. Niveles: 21 Alto, 9 Medio, 0 Bajo. CR22-C29I-C29H3 sube a 31 y gana **R1 «Patrullaje prioritario en hora pico»** porque ahora tiene 3 Altos en pico. |
| `criterios.json`: `"secundaria": 1` → `3` | Las calles pesan igual que la avenida. CR22-C29I-C29H3 sube al **2.º lugar** (37) y gana R1; C29H3-CR22-CR21E sube a 24. |
| `criterios.json`: `"min_altos_en_pico": 3` → `4` | ARIO-C29C2-C29D (solo 3 Altos en pico) **pierde** la recomendación R1. ARIO-C29D-C29E la conserva (tiene 6). |
| `criterios.json`: `"11:30-14:00"` → `"11:30-12:30"` | Los reportes de 12:30 a 13:59 pasan a valle y bajan 2 puntos. Niveles: 15 Alto, 9 Medio, 6 Bajo. CR22-C29E-C29D sale del top 5 y entra CR22-C29I3-C29I1. |
| `criterios.json`: niveles `Bajo [0,5]`, `Medio [6,7]`, `Alto [8,9]` | Los puntajes no cambian, solo la etiqueta: 11 Alto, 13 Medio, 6 Bajo. El orden del resumen (que suma puntajes) queda igual. R1 cuenta reportes Altos, así que podría cambiar; con estos datos no cambia. |
| `vias.json`: cambiar `"tipo"` de `CR22-C29I-C29H3` a `"arterial"` | Solo esa cuadra suma 2 puntos más por reporte (3 en vez de 1) y pasa a 37 puntos acumulados. |
| `criterios.json`: `"ancho_metros": 50` → `100` (con "Ver hexágonos") | Hexágonos más grandes: de 12 pasan a 5 y el más crítico reúne 11 reportes (suma 86). Se ve "por sector". |
| `criterios.json`: `"ancho_metros": 50` → `30` | Hexágonos más pequeños: 15 hexágonos, el mayor con 4 reportes (suma 33). Se ve casi "por punto". Los puntajes y el resumen no cambian. |

## 4. Preguntas típicas y cómo responderlas

- **¿Por qué el usuario no escribe el tipo de vía?** Porque se toma de `vias.json` según la cuadra; así no depende de lo que crea cada persona y todos los reportes de la misma cuadra se califican igual.
- **¿Cómo se sabe la cuadra?** Al tocar el mapa, `captura.js` mide la distancia del punto a cada cuadra (segmento entre sus dos esquinas) y escoge la más cercana. Si está a más de 60 m, avisa y pide escogerla a mano.
- **¿Cómo se deduce la franja?** Se toma la hora del texto `fecha_hora` (por ejemplo `"11:40"`) y se compara con cada rango de `horas_pico`. Si cae en alguno, es pico; si no, valle.
- **¿Qué pasa si importo el mismo archivo dos veces?** Nada: se comparan los `id` y los repetidos se omiten. La app dice cuántos fueron nuevos y cuántos repetidos.
- **¿Por qué el mapa necesita internet y lo demás no?** El mapa base son imágenes (teselas) de OpenStreetMap que se descargan. Leaflet, Leaflet.heat y los datos vienen con el proyecto.
- **¿Dónde quedan guardados los reportes nuevos?** En `localStorage` del navegador de ese celular (unos 5 MB). Por eso se exportan y se importan en un solo computador.
- **¿Qué diferencia hay entre el mapa de calor y los hexágonos?** El de calor (Leaflet.heat, el que pide RF-03) hace manchas suaves: cada punto pesa puntaje/9 y los cercanos se suman. Los hexágonos dividen la zona en celdas iguales de 50 m y pintan cada celda según la **suma exacta** de puntajes de los reportes que caen dentro, así que se puede leer el número (pasar el mouse o tocar). Los dos respetan los filtros.
- **¿Cómo sabe en qué hexágono cae un reporte?** Se pasa su lat/lng a metros desde un punto fijo (la primera esquina de `vias.json`), se aplica una fórmula que da las coordenadas del hexágono y se redondea al hexágono más cercano. Luego es una repetición con acumulador: para cada reporte, se suma 1 a la cantidad y su puntaje a la suma de su hexágono.
- **¿Por qué 50 m?** En esta zona las cuadras miden entre unos 40 m (Av. del Río entre 29C2 y 29D, o Carrera 22 entre 29I1 y 29I) y unos 110–130 m (Carrera 22A, Av. del Río entre 29D y 29E), así que un hexágono de 50 m distingue cuadras vecinas sin quedar tan pequeño que cada reporte quede solo. Se cambia en `criterios.json`.
- **¿Cómo se pinta el mapa de calor?** Cada reporte aporta una intensidad igual a su puntaje dividido entre el máximo posible (9). Los reportes cercanos se suman: donde hay muchos y graves, se ve rojo.
