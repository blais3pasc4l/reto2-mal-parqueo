/* =====================================================================
   hexagonos.js — Mapa de calor HEXAGONAL (capa opcional del tablero)
   ---------------------------------------------------------------------
   Idea: se cubre TODA la zona de estudio con una "colmena" de hexágonos
   iguales (no solo donde hay reportes). Cada reporte cae dentro de UN
   hexágono. En los que tienen reportes se cuenta cuántos hay y se SUMAN
   sus puntajes de criticidad; los vacíos se dejan en gris.
   La grilla se calcula a partir de vias.json (caja de las cuadras + 1
   hexágono de margen) y un origen fijo, así no se mueve al filtrar.
   ENTRADA : vias + reportes (ya filtrados) + ancho del hexágono en metros
   SALIDA  : lista de hexágonos { q, r, cantidad, suma, ids, centro, esquinas }
   No usa librerías: solo geometría. No toca el mapa (eso lo hace mapa.js),
   así se puede probar solo con Node.
   Matemática basada en la guía de hexágonos de Red Blob Games
   (https://www.redblobgames.com/grids/hexagons/), hexágonos "con punta arriba".
   ===================================================================== */

var METROS_POR_GRADO = 111320;   // metros que mide un grado de latitud

// Punto fijo de referencia (origen de la colmena). Se usa uno fijo para que
// los hexágonos NO se muevan cuando cambian los filtros.
// Por defecto: la primera esquina de la primera cuadra de vias.json.
function origenDeVias(vias) {
  return { lat: vias.cuadras[0].inicio[0], lng: vias.cuadras[0].inicio[1] };
}

// 1) lat/lng -> metros (x hacia el este, y hacia el norte). Aproximación plana,
//    suficiente para unas pocas cuadras.
function aMetros(lat, lng, origen) {
  var mLng = METROS_POR_GRADO * Math.cos(origen.lat * Math.PI / 180);
  return { x: (lng - origen.lng) * mLng, y: (lat - origen.lat) * METROS_POR_GRADO };
}
// Y al revés: metros -> lat/lng
function aLatLng(x, y, origen) {
  var mLng = METROS_POR_GRADO * Math.cos(origen.lat * Math.PI / 180);
  return [origen.lat + y / METROS_POR_GRADO, origen.lng + x / mLng];
}

// "radio" = distancia del centro a una esquina. Para un hexágono con punta
// arriba, el ancho (de lado plano a lado plano) es  radio * raíz(3).
function radioDesdeAncho(anchoMetros) {
  return anchoMetros / Math.sqrt(3);
}

// 2) ¿En qué hexágono cae el punto (x, y)? Devuelve sus coordenadas (q, r).
function hexagonoDePunto(x, y, radio) {
  // Coordenadas "fraccionarias" del hexágono (fórmula de Red Blob Games)
  var q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / radio;
  var r = (2 / 3 * y) / radio;
  return redondearHex(q, r);
}

// Redondeo al hexágono más cercano. Se usan tres coordenadas (q, r, s) que
// siempre suman 0; se redondean y se corrige la que más se alejó.
function redondearHex(q, r) {
  var s = -q - r;
  var rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  var dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq + 0, r: rr + 0 };   // "+ 0" evita el -0 de JavaScript
}

// Centro (en metros) del hexágono (q, r)
function centroDeHex(q, r, radio) {
  return { x: radio * Math.sqrt(3) * (q + r / 2), y: radio * 1.5 * r };
}

// 4) Las 6 esquinas del hexágono, en lat/lng, listas para L.polygon
function esquinasDeHex(q, r, radio, origen) {
  var c = centroDeHex(q, r, radio), esquinas = [];
  for (var i = 0; i < 6; i++) {                       // repetición: 6 esquinas
    var angulo = Math.PI / 180 * (60 * i - 30);       // -30°, 30°, 90°, ... (punta arriba)
    esquinas.push(aLatLng(c.x + radio * Math.cos(angulo), c.y + radio * Math.sin(angulo), origen));
  }
  return esquinas;
}

// FUNCIÓN PRINCIPAL: agrupa los reportes en hexágonos.
function agruparEnHexagonos(reportes, anchoMetros, origen) {
  var radio = radioDesdeAncho(anchoMetros);
  var grupos = {};                                    // clave "q,r" -> hexágono
  reportes.forEach(function (rep) {                   // para cada reporte...
    var p = aMetros(rep.lat, rep.lng, origen);
    var h = hexagonoDePunto(p.x, p.y, radio);
    var clave = h.q + "," + h.r;
    if (!grupos[clave]) grupos[clave] = { q: h.q, r: h.r, cantidad: 0, suma: 0, ids: [] };
    grupos[clave].cantidad += 1;                      // ...se cuenta
    grupos[clave].suma += rep.criticidad.puntaje;     // ...y se suma su puntaje
    grupos[clave].ids.push(rep.id);
  });
  return Object.values(grupos).map(function (g) {
    var c = centroDeHex(g.q, g.r, radio);
    g.centro = aLatLng(c.x, c.y, origen);
    g.esquinas = esquinasDeHex(g.q, g.r, radio, origen);
    return g;
  }).sort(function (a, b) { return b.suma - a.suma; }); // el más crítico primero
}

// Caja (en metros, respecto al origen) que envuelve todas las cuadras de vias.json.
function cajaDeVias(vias, origen) {
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  vias.cuadras.forEach(function (c) {
    [c.inicio, c.fin].forEach(function (ll) {
      var p = aMetros(ll[0], ll[1], origen);
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
  });
  return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
}

// Todas las celdas que cubren la zona: caja de las cuadras + margenHex hexágonos.
// No depende de los reportes, así la grilla queda fija al filtrar.
function grillaDeZona(vias, anchoMetros, origen, margenHex) {
  if (margenHex === undefined) margenHex = 1;
  var radio = radioDesdeAncho(anchoMetros);
  var caja = cajaDeVias(vias, origen);
  var margen = margenHex * anchoMetros;
  var minX = caja.minX - margen, maxX = caja.maxX + margen;
  var minY = caja.minY - margen, maxY = caja.maxY + margen;
  var pasoX = radio * Math.sqrt(3);   // distancia entre centros vecinos (este-oeste)
  var pasoY = radio * 1.5;            // distancia entre filas (norte-sur)
  var rMin = Math.floor(minY / pasoY) - 2;
  var rMax = Math.ceil(maxY / pasoY) + 2;
  var lista = [];
  for (var r = rMin; r <= rMax; r++) {
    var qMin = Math.floor(minX / pasoX - r / 2) - 2;
    var qMax = Math.ceil(maxX / pasoX - r / 2) + 2;
    for (var q = qMin; q <= qMax; q++) {
      var c = centroDeHex(q, r, radio);
      // Se incluye si el hexágono toca la caja ampliada (el centro está a <= radio).
      if (c.x + radio < minX || c.x - radio > maxX || c.y + radio < minY || c.y - radio > maxY) continue;
      lista.push({
        q: q + 0, r: r + 0, cantidad: 0, suma: 0, ids: [],
        centro: aLatLng(c.x, c.y, origen),
        esquinas: esquinasDeHex(q, r, radio, origen)
      });
    }
  }
  return lista;
}

// Une la grilla fija de la zona con los reportes (filtrados). Las celdas sin
// reportes quedan en 0; las que sí tienen heredan cantidad, suma e ids.
function completarGrilla(reportes, anchoMetros, origen, vias, margenHex) {
  var llenos = {};
  agruparEnHexagonos(reportes, anchoMetros, origen).forEach(function (h) {
    llenos[h.q + "," + h.r] = h;
  });
  return grillaDeZona(vias, anchoMetros, origen, margenHex).map(function (celda) {
    var d = llenos[celda.q + "," + celda.r];
    if (d) { celda.cantidad = d.cantidad; celda.suma = d.suma; celda.ids = d.ids; }
    return celda;
  }).sort(function (a, b) { return b.suma - a.suma; });
}

if (typeof module !== "undefined") {
  module.exports = { agruparEnHexagonos: agruparEnHexagonos, hexagonoDePunto: hexagonoDePunto,
    centroDeHex: centroDeHex, esquinasDeHex: esquinasDeHex, radioDesdeAncho: radioDesdeAncho,
    aMetros: aMetros, aLatLng: aLatLng, origenDeVias: origenDeVias,
    cajaDeVias: cajaDeVias, grillaDeZona: grillaDeZona, completarGrilla: completarGrilla };
}
