/* =====================================================================
   criticidad.js — Índice de criticidad (RF-02)
   ---------------------------------------------------------------------
   ENTRADA : un reporte + la lista de cuadras (vias.json) + las reglas
             (criterios.json).
   PASOS   : 1) peso de la categoría   (criterios.categoria)
             2) peso del tipo de vía   (se busca la cuadra en vias.json)
             3) peso de la franja      (se deduce de la hora del reporte)
             4) puntaje = 1 + 2 + 3
             5) nivel   = el rango de criterios.niveles donde cae el puntaje
   SALIDA  : { puntaje, nivel, detalle }
   Este archivo NO toca el mapa ni la pantalla: así se puede probar solo
   (ver pruebas/pruebas.js).
   ===================================================================== */

// Convierte "HH:MM" en minutos desde la medianoche. Ej: "11:40" -> 700
function aMinutos(hhmm) {
  var partes = hhmm.split(":");
  return Number(partes[0]) * 60 + Number(partes[1]);
}

// Saca la hora "HH:MM" de una fecha_hora como "2026-11-18T11:40".
// Se lee directamente del texto para no tener problemas de zona horaria.
function horaDeReporte(fechaHora) {
  return fechaHora.slice(11, 16);
}

// Devuelve "pico" o "valle" según criterios.horas_pico.
// Regla: la hora es pico si  inicio <= hora < fin.
// Ejemplo con "11:30-14:00": 11:30 es pico, 13:59 es pico, 14:00 ya es valle.
function franjaDeHora(fechaHora, criterios) {
  var minutos = aMinutos(horaDeReporte(fechaHora));
  for (var i = 0; i < criterios.horas_pico.length; i++) {        // repetición
    var rango = criterios.horas_pico[i].split("-");               // ["11:30","14:00"]
    if (minutos >= aMinutos(rango[0]) && minutos < aMinutos(rango[1])) { // condición
      return "pico";
    }
  }
  return "valle";
}

// Busca una cuadra por su id dentro de vias.json. Si no existe devuelve null.
function buscarCuadra(idCuadra, vias) {
  for (var i = 0; i < vias.cuadras.length; i++) {
    if (vias.cuadras[i].id === idCuadra) return vias.cuadras[i];
  }
  return null;
}

// Convierte un puntaje en "Bajo", "Medio" o "Alto" usando criterios.niveles.
// Si el puntaje queda por encima del rango más alto (por ejemplo porque se
// subió un peso y no se ajustaron los rangos) se asigna el nivel más alto,
// y si queda por debajo del más bajo, el nivel más bajo.
function nivelDePuntaje(puntaje, criterios) {
  var nombres = Object.keys(criterios.niveles);  // ["Bajo","Medio","Alto"]
  for (var i = 0; i < nombres.length; i++) {
    var rango = criterios.niveles[nombres[i]];   // [min, max]
    if (puntaje >= rango[0] && puntaje <= rango[1]) return nombres[i];
  }
  // Fuera de todos los rangos: se busca el extremo más cercano.
  var masBajo = nombres[0], masAlto = nombres[0];
  nombres.forEach(function (n) {
    if (criterios.niveles[n][0] < criterios.niveles[masBajo][0]) masBajo = n;
    if (criterios.niveles[n][1] > criterios.niveles[masAlto][1]) masAlto = n;
  });
  return puntaje > criterios.niveles[masAlto][1] ? masAlto : masBajo;
}

// Puntaje máximo posible con los pesos actuales (sirve para el mapa de calor).
function puntajeMaximo(criterios) {
  function max(obj) { return Math.max.apply(null, Object.values(obj)); }
  return max(criterios.categoria) + max(criterios.via) + max(criterios.franja);
}

// FUNCIÓN PRINCIPAL: recibe un reporte y devuelve su puntaje y su nivel.
function calcularCriticidad(reporte, vias, criterios) {
  // 1) Categoría (si la categoría no está en criterios.json vale 0)
  var pesoCategoria = criterios.categoria[reporte.categoria] || 0;

  // 2) Tipo de vía: el usuario NO lo escribe, se toma de vias.json
  var cuadra = buscarCuadra(reporte.cuadra, vias);
  var tipoVia = cuadra ? cuadra.tipo : "desconocida";
  var pesoVia = criterios.via[tipoVia] || 0;

  // 3) Franja horaria: se deduce de la hora del reporte
  var franja = franjaDeHora(reporte.fecha_hora, criterios);
  var pesoFranja = criterios.franja[franja] || 0;

  // 4) Suma y 5) nivel
  var puntaje = pesoCategoria + pesoVia + pesoFranja;
  return {
    puntaje: puntaje,
    nivel: nivelDePuntaje(puntaje, criterios),
    // "detalle" explica de dónde sale cada número (se muestra en pantalla)
    detalle: {
      categoria: pesoCategoria,
      tipo_via: tipoVia, via: pesoVia,
      franja: franja, peso_franja: pesoFranja
    }
  };
}

// Permite usar este archivo desde Node.js para las pruebas automáticas.
// En el navegador esta línea no hace nada.
if (typeof module !== "undefined") {
  module.exports = { calcularCriticidad: calcularCriticidad, franjaDeHora: franjaDeHora,
    nivelDePuntaje: nivelDePuntaje, buscarCuadra: buscarCuadra, puntajeMaximo: puntajeMaximo,
    horaDeReporte: horaDeReporte, aMinutos: aMinutos };
}
