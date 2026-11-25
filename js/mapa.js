/* =====================================================================
   mapa.js — Mapa base, capa de calor y capa de puntos (RF-03)
   ---------------------------------------------------------------------
   - Mapa base: teselas de OpenStreetMap (necesita internet).
   - Capa de calor: Leaflet.heat. La intensidad de cada punto es
       puntaje / puntaje máximo posible   (un 9 de 9 pinta con fuerza 1.0)
     Los puntos cercanos se suman; "max: 2" quiere decir que el rojo
     intenso aparece cuando se acumulan unos 2 reportes de puntaje máximo
     en el mismo sitio. Así se distinguen las cuadras más reincidentes.
   - Capa de puntos: un círculo por reporte, de color según el nivel.
   ===================================================================== */

var COLOR_NIVEL = { Bajo: "#2e7d32", Medio: "#f59e0b", Alto: "#c62828" };
var COLOR_VIA = { arterial: "#6d28d9", secundaria: "#0284c7" };

// Crea un mapa Leaflet dentro del div indicado y dibuja las cuadras de vias.json.
function crearMapa(idDiv, vias) {
  var mapa = L.map(idDiv, { zoomControl: true });
  mapa.createPane("calor");
  mapa.getPane("calor").style.zIndex = 350;       // debajo de la grilla hexagonal
  mapa.getPane("calor").style.pointerEvents = "none";
  mapa.createPane("hexagonos");
  mapa.getPane("hexagonos").style.zIndex = 390;   // debajo de los puntos
  mapa.createPane("puntos");
  mapa.getPane("puntos").style.zIndex = 620;      // encima: el clic abre la ficha
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; colaboradores de OpenStreetMap"
  }).addTo(mapa);

  var limites = [];
  vias.cuadras.forEach(function (c) {
    // Cada cuadra es una línea entre sus dos esquinas (inicio y fin)
    L.polyline([c.inicio, c.fin], { color: COLOR_VIA[c.tipo] || "#555", weight: 6, opacity: 0.35 })
      .bindTooltip(c.id + " · " + c.tipo)
      .addTo(mapa);
    limites.push(c.inicio, c.fin);
  });
  mapa.limitesZona = limites;          // se guardan para volver a encuadrar la zona
  mapa.fitBounds(limites, { padding: [30, 30] });
  // Leaflet.heat se desfasaba en el celular al hacer zoom o scroll;
  // se reubica el lienzo al terminar el movimiento y al cambiar el tamaño.
  mapa.on("zoomend moveend resize", function () { sincronizarCapaCalor(mapa); });
  return mapa;
}

// Reubica y redibuja el lienzo de Leaflet.heat (y ajusta el tamaño del mapa).
function sincronizarCapaCalor(mapa) {
  if (!mapa) return;
  mapa.invalidateSize();
  if (capasTablero.calor && typeof capasTablero.calor._reset === "function") {
    capasTablero.calor._reset();
  }
}

// Objeto que guarda las dos capas del tablero para poder redibujarlas.
var capasTablero = { calor: null, puntos: null };

// Redibuja la capa de calor y (si se pide) la de puntos individuales.
function dibujarReportes(mapa, reportes, criterios, mostrarPuntos, textoPopup) {
  var maximo = puntajeMaximo(criterios);   // función de criticidad.js

  // Se quitan las capas anteriores (sin recargar la página)
  if (capasTablero.calor) mapa.removeLayer(capasTablero.calor);
  if (capasTablero.puntos) mapa.removeLayer(capasTablero.puntos);

  // Capa de calor: [lat, lng, intensidad]
  var puntosCalor = reportes.map(function (r) {
    return [r.lat, r.lng, r.criticidad.puntaje / maximo];
  });
  capasTablero.calor = L.heatLayer(puntosCalor, {
    radius: 25, blur: 18, maxZoom: 17, max: 2, minOpacity: 0.3,
    gradient: { 0.3: "#2563eb", 0.55: "#facc15", 0.75: "#f97316", 1.0: "#dc2626" }
  }).addTo(mapa);
  // Leaflet.heat se pinta en overlayPane; se mueve al pane bajo para no tapar la grilla.
  if (capasTablero.calor._canvas && mapa.getPane("calor")) {
    mapa.getPane("calor").appendChild(capasTablero.calor._canvas);
  }

  // Capa de puntos individuales
  capasTablero.puntos = L.layerGroup();
  reportes.forEach(function (r) {
    L.circleMarker([r.lat, r.lng], {
      radius: 8, color: "#fff", weight: 2,
      fillColor: COLOR_NIVEL[r.criticidad.nivel], fillOpacity: 0.95,
      pane: "puntos", bubblingMouseEvents: false, interactive: true
    }).bindPopup(textoPopup(r), {
      maxWidth: 280, minWidth: 200,
      autoPanPaddingTopLeft: [16, 100],
      autoPanPaddingBottomRight: [16, 40],
      className: "ficha-popup-wrap"
    }).addTo(capasTablero.puntos);
  });
  if (mostrarPuntos) {
    capasTablero.puntos.addTo(mapa);
    capasTablero.puntos.eachLayer(function (capa) { capa.bringToFront(); });
  }
}

/* ---------------- Capa de HEXÁGONOS (opcional, casilla "Ver hexágonos") ----------------
   Usa agruparEnHexagonos() de hexagonos.js. El color depende de la SUMA de
   puntajes del hexágono comparada con el hexágono más alto del momento:
   claro = poca criticidad acumulada, rojo oscuro = la más alta.          */
var ANCHO_HEX_POR_DEFECTO = 50;   // metros (si criterios.json no trae "mapa_hexagonos")
var COLORES_HEX = ["#fff5b1", "#fed976", "#feb24c", "#fd8d3c", "#f03b20", "#bd0026"];

// Escoge un color según qué fracción del máximo representa la suma (0 a 1)
function colorHex(fraccion) {
  var i = Math.min(COLORES_HEX.length - 1, Math.floor(fraccion * COLORES_HEX.length));
  return COLORES_HEX[i];
}

capasTablero.hexagonos = null;

function dibujarHexagonos(mapa, reportes, criterios, vias, mostrar) {
  if (capasTablero.hexagonos) mapa.removeLayer(capasTablero.hexagonos);
  capasTablero.hexagonos = null;
  if (!mostrar) return [];

  var ancho = (criterios.mapa_hexagonos && criterios.mapa_hexagonos.ancho_metros) || ANCHO_HEX_POR_DEFECTO;
  var origen = origenDeVias(vias);
  // Grilla completa de la zona (fija). Solo cambian los valores al filtrar.
  var hexagonos = completarGrilla(reportes, ancho, origen, vias, 1);
  var llenos = hexagonos.filter(function (h) { return h.cantidad > 0; });
  var sumaMaxima = llenos.length ? llenos[0].suma : 0;

  capasTablero.hexagonos = L.layerGroup();
  hexagonos.forEach(function (h) {
    if (h.cantidad === 0) {
      // Celda vacía: trazo fino gris, relleno casi transparente, no intercepta clics.
      L.polygon(h.esquinas, {
        color: "#64748b", weight: 1, fillColor: "#cbd5e1", fillOpacity: 0.22,
        pane: "hexagonos", interactive: false
      }).addTo(capasTablero.hexagonos);
      return;
    }
    L.polygon(h.esquinas, {
      color: "#7f1d1d", weight: 1, fillColor: colorHex(h.suma / sumaMaxima), fillOpacity: 0.65,
      pane: "hexagonos"
    }).bindTooltip("<b>" + h.cantidad + " reporte" + (h.cantidad === 1 ? "" : "s") + "</b><br>Suma de criticidad: <b>" + h.suma + "</b>")
      .bindPopup("<b>Hexágono de " + ancho + " m</b><br>Reportes: " + h.cantidad + "<br>Suma de criticidad: " + h.suma +
        "<br><small>" + h.ids.join(", ") + "</small>")
      .addTo(capasTablero.hexagonos);
  });
  capasTablero.hexagonos.addTo(mapa);
  // Los hexágonos viven en un pane más bajo; se reafirma que los puntos queden encima y reciban el clic.
  if (capasTablero.puntos && mapa.hasLayer(capasTablero.puntos)) {
    capasTablero.puntos.eachLayer(function (capa) { capa.bringToFront(); });
  }
  return hexagonos;
}
