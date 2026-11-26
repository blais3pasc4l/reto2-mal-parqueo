/* =====================================================================
   resumen.js — Resumen operativo (RF-05)
   ---------------------------------------------------------------------
   ENTRADA : lista de reportes (ya con su criticidad calculada), vias.json
             y criterios.json.
   PASOS   : 1) agrupar los reportes por cuadra
             2) sumar el puntaje de cada cuadra (puntaje acumulado)
             3) ordenar de mayor a menor y quedarse con las 5 primeras
             4) a cada cuadra aplicarle las REGLAS DE RECOMENDACIÓN
   SALIDA  : lista de hasta 5 cuadras, cada una con sus recomendaciones y
             la regla que produjo cada una.
   ===================================================================== */

if (typeof module !== "undefined") {
  var franjaDeHora = require("./criticidad.js").franjaDeHora;
  var buscarCuadra = require("./criticidad.js").buscarCuadra;
}

// Cuenta cuántas veces aparece cada valor de un campo.
// Ej: contarPor(reportes, "categoria") -> { invasion_anden: 4, doble_fila: 2 }
function contarPor(reportes, campo) {
  var conteo = {};
  reportes.forEach(function (r) {
    conteo[r[campo]] = (conteo[r[campo]] || 0) + 1;
  });
  return conteo;
}

// Porcentaje (0 a 100, redondeado) de cada valor de un campo.
function porcentajesPor(reportes, campo) {
  var conteo = contarPor(reportes, campo), salida = {};
  Object.keys(conteo).forEach(function (k) {
    salida[k] = Math.round((conteo[k] * 100) / reportes.length);
  });
  return salida;
}

/* REGLAS DE RECOMENDACIÓN (escritas, en orden).
   Se revisan TODAS; cada una que se cumpla agrega una recomendación.
   Los umbrales se leen de criterios.json -> "reglas_resumen":
     min_altos_en_pico   (por defecto 3)
     proporcion_predomina (por defecto 0.5 = la mitad o más)          */
function aplicarReglas(grupo, criterios) {
  var umbral = criterios.reglas_resumen || {};
  var minAltos = umbral.min_altos_en_pico || 3;
  var predomina = umbral.proporcion_predomina || 0.5;
  var n = grupo.reportes.length;
  var recomendaciones = [];

  // R1: reportes de nivel Alto en hora pico
  var altosPico = grupo.reportes.filter(function (r) {
    return r.criticidad.nivel === "Alto" && franjaDeHora(r.fecha_hora, criterios) === "pico";
  }).length;
  if (altosPico >= minAltos) {
    recomendaciones.push({ texto: "Patrullaje prioritario en hora pico",
      regla: "R1: " + altosPico + " reportes de nivel Alto en hora pico (≥ " + minAltos + ")" });
  }

  var cat = contarPor(grupo.reportes, "categoria");
  var act = contarPor(grupo.reportes, "actor");
  function pct(x) { return Math.round(((x || 0) * 100) / n); }

  // R2: predomina la invasión de andén
  if ((cat.invasion_anden || 0) / n >= predomina) {
    recomendaciones.push({ texto: "Operativo de espacio público",
      regla: "R2: invasión de andén = " + pct(cat.invasion_anden) + "% de los reportes (≥ " + Math.round(predomina * 100) + "%)" });
  }
  // R3: predomina el vehículo de carga
  if ((act.vehiculo_carga || 0) / n >= predomina) {
    recomendaciones.push({ texto: "Revisar horario de cargue y descargue",
      regla: "R3: vehículo de carga = " + pct(act.vehiculo_carga) + "% de los reportes (≥ " + Math.round(predomina * 100) + "%)" });
  }
  // R4: predomina el parqueo en vía prohibida o doble fila
  if ((cat.doble_fila || 0) / n >= predomina) {
    recomendaciones.push({ texto: "Control de estacionamiento (comparendos y grúa)",
      regla: "R4: doble fila / vía prohibida = " + pct(cat.doble_fila) + "% de los reportes (≥ " + Math.round(predomina * 100) + "%)" });
  }
  // R5: predomina el bloqueo de rampas, cebras o paraderos
  if ((cat.bloqueo_rampa_cebra_paradero || 0) / n >= predomina) {
    recomendaciones.push({ texto: "Despejar y señalizar rampas, cebras y paraderos",
      regla: "R5: bloqueo de rampa/cebra/paradero = " + pct(cat.bloqueo_rampa_cebra_paradero) + "% de los reportes (≥ " + Math.round(predomina * 100) + "%)" });
  }
  // R0: si ninguna regla se cumplió
  if (recomendaciones.length === 0) {
    recomendaciones.push({ texto: "Mantener en observación en los recorridos ordinarios",
      regla: "R0: no se cumplió ninguna de las reglas R1 a R5" });
  }
  return recomendaciones;
}

// FUNCIÓN PRINCIPAL del resumen.
function generarResumen(reportes, vias, criterios, cuantas) {
  cuantas = cuantas || 5;
  // 1) Agrupar por cuadra
  var grupos = {};
  reportes.forEach(function (r) {
    if (!grupos[r.cuadra]) grupos[r.cuadra] = { cuadra: r.cuadra, reportes: [], puntaje: 0 };
    grupos[r.cuadra].reportes.push(r);
    // 2) Sumar puntajes
    grupos[r.cuadra].puntaje += r.criticidad.puntaje;
  });
  // 3) Ordenar: mayor puntaje primero; si empatan, más reportes primero
  var lista = Object.values(grupos).sort(function (a, b) {
    return (b.puntaje - a.puntaje) || (b.reportes.length - a.reportes.length) || a.cuadra.localeCompare(b.cuadra);
  }).slice(0, cuantas);
  // 4) Reglas
  return lista.map(function (g) {
    var info = buscarCuadra(g.cuadra, vias);
    return {
      cuadra: g.cuadra,
      nombre: info ? info.nombre : g.cuadra + " (no está en vias.json)",
      total_reportes: g.reportes.length,
      puntaje_acumulado: g.puntaje,
      recomendaciones: aplicarReglas(g, criterios)
    };
  });
}

/* Comparación pico vs valle por cuadra (para la gráfica del resumen).
   ENTRADA : la lista YA filtrada, vias.json y criterios.json.
   SALIDA  : una fila por cuadra con reportes, con conteos de pico y valle,
             ordenada de más a menos reportes. Lista vacía si no hay datos. */
function contarPicoVallePorCuadra(reportes, vias, criterios) {
  var grupos = {};
  (reportes || []).forEach(function (r) {
    if (!r || !r.cuadra) return;
    if (!grupos[r.cuadra]) grupos[r.cuadra] = { cuadra: r.cuadra, pico: 0, valle: 0 };
    var f = franjaDeHora(r.fecha_hora, criterios);
    if (f === "pico") grupos[r.cuadra].pico += 1;
    else grupos[r.cuadra].valle += 1;
  });
  return Object.keys(grupos).map(function (id) {
    var g = grupos[id];
    var info = vias ? buscarCuadra(id, vias) : null;
    return {
      cuadra: g.cuadra,
      nombre: info ? info.nombre : g.cuadra,
      pico: g.pico,
      valle: g.valle,
      total: g.pico + g.valle
    };
  }).sort(function (a, b) {
    return (b.total - a.total) || (b.pico - a.pico) || a.cuadra.localeCompare(b.cuadra);
  });
}

function escaparXml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Dibuja barras horizontales agrupadas (pico y valle) en un SVG, sin dependencias.
// Si no hay filas, deja un mensaje. No toca el mapa.
function dibujarGraficaPicoValle(contenedor, filas) {
  if (!contenedor) return;
  if (!filas || !filas.length) {
    contenedor.innerHTML = "<p class='nota'>No hay reportes con estos filtros para comparar pico y valle.</p>";
    return;
  }
  var max = 0, i, f, totalPico = 0, totalValle = 0;
  for (i = 0; i < filas.length; i++) {
    f = filas[i];
    if (f.pico > max) max = f.pico;
    if (f.valle > max) max = f.valle;
    totalPico += f.pico;
    totalValle += f.valle;
  }
  if (max < 1) max = 1;

  var ancho = 400, margenIzq = 118, margenDer = 28, tope = 28;
  var altoFila = 44, altoBarra = 12, hueco = 4;
  var alto = tope + filas.length * altoFila + 8;
  var maxBarra = ancho - margenIzq - margenDer;
  var partes = [];
  partes.push("<svg class='svg-pico-valle' viewBox='0 0 " + ancho + " " + alto + "' width='100%' height='" + alto + "' role='img' aria-label='Reportes en hora pico y hora valle por cuadra'>");
  partes.push("<rect width='" + ancho + "' height='" + alto + "' fill='transparent'/>");
  // Leyenda
  partes.push("<rect x='0' y='6' width='10' height='10' rx='2' fill='#c2410c'/>");
  partes.push("<text x='14' y='15' font-size='11' fill='#1f2937'>Hora pico (" + totalPico + ")</text>");
  partes.push("<rect x='130' y='6' width='10' height='10' rx='2' fill='#0f3d63'/>");
  partes.push("<text x='144' y='15' font-size='11' fill='#1f2937'>Hora valle (" + totalValle + ")</text>");

  for (i = 0; i < filas.length; i++) {
    f = filas[i];
    var y = tope + i * altoFila;
    var etiqueta = f.cuadra;
    partes.push("<g>");
    partes.push("<title>" + escaparXml(f.nombre) + " · pico " + f.pico + " · valle " + f.valle + "</title>");
    partes.push("<text x='" + (margenIzq - 8) + "' y='" + (y + 16) + "' text-anchor='end' font-size='10' font-weight='600' fill='#1f2937'>" + escaparXml(etiqueta) + "</text>");

    var wPico = Math.round((f.pico / max) * maxBarra);
    var wValle = Math.round((f.valle / max) * maxBarra);
    if (f.pico > 0 && wPico < 2) wPico = 2;
    if (f.valle > 0 && wValle < 2) wValle = 2;

    partes.push("<rect x='" + margenIzq + "' y='" + y + "' width='" + wPico + "' height='" + altoBarra + "' rx='2' fill='#c2410c'/>");
    partes.push("<text x='" + (margenIzq + wPico + 4) + "' y='" + (y + 10) + "' font-size='10' fill='#1f2937'>" + f.pico + "</text>");
    partes.push("<rect x='" + margenIzq + "' y='" + (y + altoBarra + hueco) + "' width='" + wValle + "' height='" + altoBarra + "' rx='2' fill='#0f3d63'/>");
    partes.push("<text x='" + (margenIzq + wValle + 4) + "' y='" + (y + altoBarra + hueco + 10) + "' font-size='10' fill='#1f2937'>" + f.valle + "</text>");
    partes.push("</g>");
  }
  partes.push("</svg>");
  contenedor.innerHTML = partes.join("");
}

if (typeof module !== "undefined") {
  module.exports = { generarResumen: generarResumen, contarPor: contarPor,
    porcentajesPor: porcentajesPor, aplicarReglas: aplicarReglas,
    contarPicoVallePorCuadra: contarPicoVallePorCuadra,
    dibujarGraficaPicoValle: dibujarGraficaPicoValle };
}
