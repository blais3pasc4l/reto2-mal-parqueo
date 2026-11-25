/* =====================================================================
   hexagonos.js — Mapa de calor HEXAGONAL (capa opcional del tablero)
   ---------------------------------------------------------------------
   Idea: se cubre la zona con una "colmena" de hexágonos iguales. Cada
   reporte cae dentro de UN hexágono. Para cada hexágono se cuenta cuántos
   reportes tiene y se SUMAN sus puntajes de criticidad. Entre más alta la
   suma, más oscuro/rojo se pinta.
   ENTRADA : lista de reportes (ya filtrados) + ancho del hexágono en metros
   PASOS   : 1) pasar cada lat/lng a metros (x, y) respecto a un punto fijo
             2) calcular en qué hexágono (q, r) cae ese punto
             3) agrupar: cantidad y suma de puntajes por hexágono
             4) calcular las 6 esquinas de cada hexágono (para dibujarlo)
   SALIDA  : lista de hexágonos { q, r, cantidad, suma, centro, esquinas }
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

if (typeof module !== "undefined") {
  module.exports = { agruparEnHexagonos: agruparEnHexagonos, hexagonoDePunto: hexagonoDePunto,
    centroDeHex: centroDeHex, esquinasDeHex: esquinasDeHex, radioDesdeAncho: radioDesdeAncho,
    aMetros: aMetros, aLatLng: aLatLng, origenDeVias: origenDeVias };
}
