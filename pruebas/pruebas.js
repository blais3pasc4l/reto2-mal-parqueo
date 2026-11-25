/* =====================================================================
   pruebas.js — Pruebas automáticas de la lógica (sin navegador)
   Cómo correrlas:   node pruebas/pruebas.js      (desde la carpeta del proyecto)
   Prueban criticidad.js, filtros.js, resumen.js y la unión sin duplicados.
   Usan datos/vias.json, datos/criterios.json y datos/reportes_ejemplo.json.
   OJO: si cambian los pesos de criterios.json, algunos valores esperados
   de aquí también cambian (eso es justamente lo que se quiere ver).
   ===================================================================== */
var path = require("path");
var raiz = path.join(__dirname, "..");
var vias = require(raiz + "/datos/vias.json");
var criterios = require(raiz + "/datos/criterios.json");
var ejemplo = require(raiz + "/datos/reportes_ejemplo.json");
var C = require(raiz + "/js/criticidad.js");
var F = require(raiz + "/js/filtros.js");
var R = require(raiz + "/js/resumen.js");
var D = require(raiz + "/js/datos.js");
var H = require(raiz + "/js/hexagonos.js");

var fallos = 0, total = 0;
function igual(obtenido, esperado, nombre) {
  total++;
  var ok = JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallos++;
  console.log((ok ? "  OK   " : "  FALLA") + "  " + nombre + (ok ? "" : "  → obtenido " + JSON.stringify(obtenido) + ", esperado " + JSON.stringify(esperado)));
}
function rep(cuadra, categoria, hora) {
  return { id: "T", fecha_hora: "2026-11-18T" + hora, lat: 0, lng: 0, cuadra: cuadra, categoria: categoria, actor: "vehiculo_particular" };
}
function pn(r) { var c = C.calcularCriticidad(r, vias, criterios); return [c.puntaje, c.nivel]; }

console.log("\n1) Índice de criticidad (RF-02)");
igual(pn(rep("ARIO-C29C2-C29D", "doble_fila", "12:10")), [9, "Alto"], "Ejemplo a mano 1: doble fila, Av. del Río (arterial), 12:10 (pico) = 3+3+3 = 9 Alto");
igual(pn(rep("C29I-CR22-CR21E", "invasion_anden", "10:15")), [4, "Bajo"], "Ejemplo a mano 2: invasión de andén, Calle 29I (secundaria), 10:15 (valle) = 2+1+1 = 4 Bajo");
igual(pn(rep("ARIO-C29D-C29E", "invasion_anden", "11:40")), [8, "Alto"], "Invasión de andén, arterial, 11:40 = 2+3+3 = 8 Alto");
igual(pn(rep("CR22-C29I-C29H3", "bloqueo_rampa_cebra_paradero", "17:30")), [7, "Alto"], "Bloqueo de rampa, secundaria, 17:30 = 3+1+3 = 7 Alto");
igual(pn(rep("CR22-C29I1-C29I", "doble_fila", "15:00")), [5, "Medio"], "Doble fila, secundaria, 15:00 = 3+1+1 = 5 Medio");
igual(pn(rep("NO-EXISTE", "doble_fila", "15:00")), [4, "Bajo"], "Cuadra que no está en vias.json: la vía vale 0");

console.log("\n2) Franjas horarias (bordes: inicio incluido, fin excluido)");
[["06:29", "valle"], ["06:30", "pico"], ["08:29", "pico"], ["08:30", "valle"], ["11:30", "pico"], ["13:59", "pico"],
 ["14:00", "valle"], ["17:00", "pico"], ["19:29", "pico"], ["19:30", "valle"], ["00:00", "valle"]].forEach(function (c) {
  igual(C.franjaDeHora("2026-11-18T" + c[0], criterios), c[1], "Hora " + c[0] + " → " + c[1]);
});

console.log("\n3) Rangos de nivel");
[[0, "Bajo"], [4, "Bajo"], [5, "Medio"], [6, "Medio"], [7, "Alto"], [9, "Alto"], [12, "Alto"]].forEach(function (c) {
  igual(C.nivelDePuntaje(c[0], criterios), c[1], "Puntaje " + c[0] + " → " + c[1]);
});
igual(C.puntajeMaximo(criterios), 9, "Puntaje máximo posible = 3 + 3 + 3");

// Recalcular la criticidad de los datos de ejemplo
ejemplo.forEach(function (r) { var c = C.calcularCriticidad(r, vias, criterios); r.criticidad = { puntaje: c.puntaje, nivel: c.nivel }; });

console.log("\n4) Filtros (RF-04): comparar con un conteo independiente");
// Conteo "a mano" escrito aparte, sin usar filtros.js
function contarAMano(sector, franja, categoria) {
  var n = 0;
  ejemplo.forEach(function (r) {
    var cuadra = vias.cuadras.filter(function (c) { return c.id === r.cuadra; })[0];
    var h = r.fecha_hora.slice(11, 16);
    var esPico = (h >= "06:30" && h < "08:30") || (h >= "11:30" && h < "14:00") || (h >= "17:00" && h < "19:30");
    if (sector && cuadra.sector !== sector) return;
    if (franja && (esPico ? "pico" : "valle") !== franja) return;
    if (categoria && r.categoria !== categoria) return;
    n++;
  });
  return n;
}
var casos = [
  [{ zona: "sector:Entrada Unimagdalena (Carrera 22)", franja: "pico" }, contarAMano("Entrada Unimagdalena (Carrera 22)", "pico", ""), 11],
  [{ categoria: "invasion_anden", franja: "valle" }, contarAMano("", "valle", "invasion_anden"), 6],
  [{ zona: "sector:Avenida del Río", categoria: "doble_fila" }, contarAMano("Avenida del Río", "", "doble_fila"), 8],
  [{}, ejemplo.length, 30]
];
casos.forEach(function (c) {
  var n = F.filtrarReportes(ejemplo, c[0], vias, criterios).length;
  igual(n, c[1], "Filtro " + JSON.stringify(c[0]) + " = conteo independiente (" + c[1] + ")");
  igual(n, c[2], "Filtro " + JSON.stringify(c[0]) + " = valor contado sobre el archivo (" + c[2] + ")");
});
igual(F.filtrarReportes(ejemplo, { zona: "cuadra:ARIO-C29D-C29E", actor: "vehiculo_carga" }, vias, criterios).map(function (r) { return r.id; }),
  ["EJEMPLO-02", "EJEMPLO-20"], "Cuadra ARIO-C29D-C29E + vehículo de carga = EJEMPLO-02 y EJEMPLO-20");
igual(F.filtrarReportes(ejemplo, { horaDesde: "11:00", horaHasta: "14:00" }, vias, criterios).length, 10, "CU-02: entre 11:00 y 14:00 hay 10 reportes");

console.log("\n5) Resumen operativo (RF-05)");
var res = R.generarResumen(ejemplo, vias, criterios, 5);
igual(res.map(function (c) { return c.cuadra + "=" + c.puntaje_acumulado; }),
  ["ARIO-C29D-C29E=53", "ARIO-C29C2-C29D=34", "CR22-C29I-C29H3=27", "C29H3-CR22-CR21E=18", "CR22-C29E-C29D=12"], "Top 5 por puntaje acumulado");
function reglas(c) { return c.recomendaciones.map(function (r) { return r.regla.slice(0, 2); }); }
igual(reglas(res[0]), ["R1", "R4"], "ARIO-C29D-C29E: 6 Altos en pico (R1) y predomina doble fila (R4)");
igual(reglas(res[1]), ["R1", "R3", "R4"], "ARIO-C29C2-C29D: R1, vehículo de carga (R3) y doble fila (R4)");
igual(reglas(res[2]), ["R2"], "CR22-C29I-C29H3: predomina invasión de andén (R2)");
igual(R.aplicarReglas({ reportes: [ejemplo[2]] }, criterios).map(function (r) { return r.regla.slice(0, 2); }), ["R5"], "Un solo bloqueo de rampa → R5");
var mezcla = [ejemplo[0], ejemplo[10], ejemplo[2]].map(function (r) { var c = JSON.parse(JSON.stringify(r)); c.fecha_hora = "2026-11-19T10:00"; c.criticidad.nivel = "Medio"; return c; });
igual(R.aplicarReglas({ reportes: mezcla }, criterios).map(function (r) { return r.regla.slice(0, 2); }), ["R0"], "Mezcla sin predominio → R0");

console.log("\n6) Importar sin duplicados (RF-06)");
var u = D.unirSinDuplicados([{ id: "A" }, { id: "B" }], [{ id: "B" }, { id: "C" }, { id: "C" }]);
igual([u.lista.length, u.agregados, u.repetidos], [3, 1, 2], "A,B + B,C,C → A,B,C (1 nuevo, 2 repetidos)");
igual(D.esReporteValido(ejemplo[0]), true, "Un reporte de ejemplo es válido");
igual(D.esReporteValido({ id: "X" }), false, "Un objeto incompleto no es válido");

console.log("\n7) Cambio de un peso (como en la sustentación)");
var otros = JSON.parse(JSON.stringify(criterios));
otros.categoria.invasion_anden = 3;
var c26 = C.calcularCriticidad(ejemplo[25], vias, otros);
igual([c26.puntaje, c26.nivel], [5, "Medio"], "invasion_anden 2→3: EJEMPLO-26 pasa de 4 Bajo a 5 Medio");

console.log("\n8) Datos: cuadras y coordenadas dentro de Santa Marta");
igual(vias.cuadras.length >= 6 && vias.cuadras.length <= 10, true, "La zona tiene entre 6 y 10 cuadras (" + vias.cuadras.length + ")");
igual(ejemplo.every(function (r) { return r.lat > 11.20 && r.lat < 11.28 && r.lng > -74.24 && r.lng < -74.17; }), true, "Todos los puntos de ejemplo están en Santa Marta");
igual(ejemplo.every(function (r) { return C.buscarCuadra(r.cuadra, vias) !== null; }), true, "Todas las cuadras de los reportes existen en vias.json");

console.log("\n9) Mapa de calor hexagonal (hexagonos.js)");
var ancho = criterios.mapa_hexagonos.ancho_metros, radio = H.radioDesdeAncho(ancho);
igual(ancho, 50, "Ancho del hexágono en criterios.json = 50 m");
igual(H.hexagonoDePunto(0, 0, radio), { q: 0, r: 0 }, "El origen cae en el hexágono (0,0)");
var c1 = H.centroDeHex(1, 0, radio);
igual(Math.round(Math.sqrt(c1.x * c1.x + c1.y * c1.y)), 50, "Distancia entre centros de hexágonos vecinos = ancho (50 m)");
var todosVuelven = true, dentro = true;
for (var q = -3; q <= 3; q++) for (var r = -3; r <= 3; r++) {
  var cc = H.centroDeHex(q, r, radio), h = H.hexagonoDePunto(cc.x, cc.y, radio);
  if (h.q !== q || h.r !== r) todosVuelven = false;
}
for (var k = 0; k < 500; k++) {   // puntos al azar: su hexágono tiene el centro a menos de "radio"
  var x = (k * 37 % 400) - 200, y = (k * 53 % 400) - 200;
  var hh = H.hexagonoDePunto(x, y, radio), ce = H.centroDeHex(hh.q, hh.r, radio);
  if (Math.hypot(x - ce.x, y - ce.y) > radio + 1e-9) dentro = false;
}
igual(todosVuelven, true, "El centro de cada hexágono vuelve a caer en su mismo hexágono");
igual(dentro, true, "500 puntos: cada uno queda a menos de un radio del centro de su hexágono");
var origen = H.origenDeVias(vias);
var hexs = H.agruparEnHexagonos(ejemplo, ancho, origen);
var sumaCant = 0, sumaPts = 0, totalPts = 0;
hexs.forEach(function (h) { sumaCant += h.cantidad; sumaPts += h.suma; });
ejemplo.forEach(function (r) { totalPts += r.criticidad.puntaje; });
igual(sumaCant, 30, "La suma de reportes en todos los hexágonos = 30 (ninguno se pierde ni se repite)");
igual(sumaPts, totalPts, "La suma de puntajes de los hexágonos = suma de puntajes de los reportes (" + totalPts + ")");
igual(hexs[0].suma >= hexs[hexs.length - 1].suma, true, "Los hexágonos quedan ordenados del más crítico al menos crítico");
var filtradosHex = F.filtrarReportes(ejemplo, { franja: "pico" }, vias, criterios);
var cantPico = H.agruparEnHexagonos(filtradosHex, ancho, origen).reduce(function (a, h) { return a + h.cantidad; }, 0);
igual(cantPico, filtradosHex.length, "Con filtro franja=pico los hexágonos suman " + filtradosHex.length + " reportes (respetan los filtros)");
var a = { id: "a", lat: 11.22624, lng: -74.18860, criticidad: { puntaje: 9 } };
var b = { id: "b", lat: 11.22627, lng: -74.18861, criticidad: { puntaje: 4 } };   // ~3 m de a
var lejos = { id: "c", lat: 11.22444, lng: -74.18860, criticidad: { puntaje: 5 } }; // ~200 m de a
var g = H.agruparEnHexagonos([a, b, lejos], ancho, origen);
igual(g.length, 2, "Dos reportes a 3 m quedan en el mismo hexágono y uno a 200 m en otro");
igual([g[0].cantidad, g[0].suma], [2, 13], "Ese hexágono tiene 2 reportes y suma 9 + 4 = 13");
igual(g[0].esquinas.length, 6, "Cada hexágono tiene 6 esquinas para dibujarlo");

console.log("\n10) Grilla hexagonal de toda la zona (no solo donde hay reportes)");
var grillaVacia = H.grillaDeZona(vias, ancho, origen, 1);
var grillaLlena = H.completarGrilla(ejemplo, ancho, origen, vias, 1);
var grillaFiltrada = H.completarGrilla(filtradosHex, ancho, origen, vias, 1);
var claves = function (lista) { return lista.map(function (h) { return h.q + "," + h.r; }).sort().join("|"); };
igual(grillaVacia.length > 0, true, "La grilla de la zona tiene celdas (" + grillaVacia.length + ")");
igual(claves(grillaVacia), claves(grillaLlena), "Con o sin reportes, la grilla tiene las mismas celdas (origen fijo)");
igual(claves(grillaLlena), claves(grillaFiltrada), "Al filtrar (franja=pico) la grilla no se mueve ni pierde celdas");
var sumaCantGrilla = 0;
grillaLlena.forEach(function (h) { sumaCantGrilla += h.cantidad; });
igual(sumaCantGrilla, 30, "En la grilla completa la suma de reportes sigue siendo 30");
igual(grillaLlena.some(function (h) { return h.cantidad === 0; }), true, "Hay celdas vacías (cantidad 0) alrededor de los reportes");
igual(grillaVacia.every(function (h) { return h.cantidad === 0 && h.suma === 0; }), true, "Sin reportes, todas las celdas de la grilla están en 0");
// Toda esquina de vias.json cae dentro de alguna celda de la grilla
var cubreVias = vias.cuadras.every(function (c) {
  return [c.inicio, c.fin].every(function (ll) {
    var p = H.aMetros(ll[0], ll[1], origen);
    var h = H.hexagonoDePunto(p.x, p.y, radio);
    return grillaVacia.some(function (g) { return g.q === h.q && g.r === h.r; });
  });
});
igual(cubreVias, true, "Todas las esquinas de vias.json caen en alguna celda de la grilla");
// Con 1 hexágono de margen, la caja de la grilla supera la de las cuadras
var cajaVias = H.cajaDeVias(vias, origen);
var minCx = Infinity, minCy = Infinity, maxCx = -Infinity, maxCy = -Infinity;
grillaVacia.forEach(function (h) {
  var c = H.aMetros(h.centro[0], h.centro[1], origen);
  if (c.x < minCx) minCx = c.x; if (c.y < minCy) minCy = c.y;
  if (c.x > maxCx) maxCx = c.x; if (c.y > maxCy) maxCy = c.y;
});
igual(minCx <= cajaVias.minX && maxCx >= cajaVias.maxX && minCy <= cajaVias.minY && maxCy >= cajaVias.maxY, true,
  "La grilla se extiende al menos hasta la caja de las cuadras (con margen)");

console.log("\nResultado: " + (total - fallos) + " de " + total + " pruebas correctas.");
process.exit(fallos ? 1 : 0);
