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

if (typeof module !== "undefined") {
  module.exports = { generarResumen: generarResumen, contarPor: contarPor,
    porcentajesPor: porcentajesPor, aplicarReglas: aplicarReglas };
}
