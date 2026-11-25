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
igual(pn(rep("CR5-C15-C16", "doble_fila", "12:10")), [9, "Alto"], "Ejemplo a mano 1: doble fila, Cra 5 (arterial), 12:10 (pico) = 3+3+3 = 9 Alto");
igual(pn(rep("C15-CR4-CR5", "invasion_anden", "10:15")), [4, "Bajo"], "Ejemplo a mano 2: invasión de andén, Calle 15 (secundaria), 10:15 (valle) = 2+1+1 = 4 Bajo");
igual(pn(rep("CR5-C14-C15", "invasion_anden", "11:40")), [8, "Alto"], "Ejemplo del enunciado MP-014 = 2+3+3 = 8 Alto");
igual(pn(rep("C14-CR4-CR5", "bloqueo_rampa_cebra_paradero", "17:30")), [7, "Alto"], "Bloqueo de rampa, secundaria, 17:30 = 3+1+3 = 7 Alto");
igual(pn(rep("C16-CR4-CR5", "doble_fila", "15:00")), [5, "Medio"], "Doble fila, secundaria, 15:00 = 3+1+1 = 5 Medio");
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
  [{ zona: "sector:Calles 14 a 16", franja: "pico" }, contarAMano("Calles 14 a 16", "pico", ""), 6],
  [{ categoria: "invasion_anden", franja: "valle" }, contarAMano("", "valle", "invasion_anden"), 7],
  [{ zona: "sector:Av. Campo Serrano", categoria: "doble_fila" }, contarAMano("Av. Campo Serrano", "", "doble_fila"), 10],
  [{}, ejemplo.length, 30]
];
casos.forEach(function (c) {
  var n = F.filtrarReportes(ejemplo, c[0], vias, criterios).length;
  igual(n, c[1], "Filtro " + JSON.stringify(c[0]) + " = conteo independiente (" + c[1] + ")");
  igual(n, c[2], "Filtro " + JSON.stringify(c[0]) + " = valor contado sobre el archivo (" + c[2] + ")");
});
igual(F.filtrarReportes(ejemplo, { zona: "cuadra:CR5-C14-C15", actor: "vehiculo_carga" }, vias, criterios).map(function (r) { return r.id; }),
  ["EJEMPLO-02", "EJEMPLO-20"], "Cuadra CR5-C14-C15 + vehículo de carga = EJEMPLO-02 y EJEMPLO-20");
igual(F.filtrarReportes(ejemplo, { horaDesde: "11:00", horaHasta: "14:00" }, vias, criterios).length, 17, "CU-02: entre 11:00 y 14:00 hay 17 reportes");

console.log("\n5) Resumen operativo (RF-05)");
var res = R.generarResumen(ejemplo, vias, criterios, 5);
igual(res.map(function (c) { return c.cuadra + "=" + c.puntaje_acumulado; }),
  ["CR5-C14-C15=49", "CR5-C15-C16=40", "C15-CR4-CR5=32", "CR5-C16-C17=23", "C16-CR4-CR5=17"], "Top 5 por puntaje acumulado");
function reglas(c) { return c.recomendaciones.map(function (r) { return r.regla.slice(0, 2); }); }
igual(reglas(res[0]), ["R1", "R4"], "CR5-C14-C15: 4 Altos en pico (R1) y predomina doble fila (R4)");
igual(reglas(res[1]), ["R1", "R3", "R4"], "CR5-C15-C16: R1, vehículo de carga (R3) y doble fila (R4)");
igual(reglas(res[2]), ["R2"], "C15-CR4-CR5: predomina invasión de andén (R2)");
igual(R.aplicarReglas({ reportes: [ejemplo[2]] }, criterios).map(function (r) { return r.regla.slice(0, 2); }), ["R5"], "Un solo bloqueo de rampa → R5");
var mezcla = [ejemplo[0], ejemplo[6], ejemplo[2]].map(function (r) { var c = JSON.parse(JSON.stringify(r)); c.fecha_hora = "2026-11-19T10:00"; c.criticidad.nivel = "Medio"; return c; });
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
var a = { id: "a", lat: 11.24430, lng: -74.21040, criticidad: { puntaje: 9 } };
var b = { id: "b", lat: 11.24433, lng: -74.21041, criticidad: { puntaje: 4 } };   // ~3 m de a
var lejos = { id: "c", lat: 11.24250, lng: -74.21040, criticidad: { puntaje: 5 } }; // ~200 m de a
var g = H.agruparEnHexagonos([a, b, lejos], ancho, origen);
igual(g.length, 2, "Dos reportes a 3 m quedan en el mismo hexágono y uno a 200 m en otro");
igual([g[0].cantidad, g[0].suma], [2, 13], "Ese hexágono tiene 2 reportes y suma 9 + 4 = 13");
igual(g[0].esquinas.length, 6, "Cada hexágono tiene 6 esquinas para dibujarlo");

console.log("\nResultado: " + (total - fallos) + " de " + total + " pruebas correctas.");
process.exit(fallos ? 1 : 0);
