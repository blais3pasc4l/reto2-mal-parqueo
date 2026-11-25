/* =====================================================================
   filtros.js — Selección de reportes (RF-04)
   ---------------------------------------------------------------------
   ENTRADA : la lista completa de reportes y los filtros activos.
   PASO    : PARA CADA reporte, SI cumple TODAS las opciones elegidas,
             se agrega a la lista de salida.
   SALIDA  : la lista filtrada.
   Un filtro vacío ("") significa "todos".
   ===================================================================== */

// En Node.js se cargan las funciones de criticidad.js; en el navegador ya
// están disponibles porque index.html carga criticidad.js antes.
if (typeof module !== "undefined") {
  var franjaDeHora = require("./criticidad.js").franjaDeHora;
  var buscarCuadra = require("./criticidad.js").buscarCuadra;
  var horaDeReporte = require("./criticidad.js").horaDeReporte;
}

/* filtros = {
     zona:      "" | "sector:Av. Campo Serrano" | "cuadra:CR5-C14-C15",
     franja:    "" | "pico" | "valle",
     categoria: "" | "doble_fila" | ...,
     actor:     "" | "motocicleta" | ...,
     horaDesde: "" | "11:00",   horaHasta: "" | "14:00"   (opcional, CU-02)
   } */
function filtrarReportes(reportes, filtros, vias, criterios) {
  var salida = [];
  for (var i = 0; i < reportes.length; i++) {          // repetición
    var r = reportes[i];
    if (cumpleFiltros(r, filtros, vias, criterios)) {  // condición
      salida.push(r);                                  // se muestra
    }
  }
  return salida;
}

function cumpleFiltros(r, f, vias, criterios) {
  // Cuadra o sector
  if (f.zona) {
    var tipo = f.zona.split(":")[0];          // "sector" o "cuadra"
    var valor = f.zona.slice(tipo.length + 1);
    if (tipo === "cuadra" && r.cuadra !== valor) return false;
    if (tipo === "sector") {
      var cuadra = buscarCuadra(r.cuadra, vias);
      if (!cuadra || cuadra.sector !== valor) return false;
    }
  }
  // Franja horaria (pico / valle)
  if (f.franja && franjaDeHora(r.fecha_hora, criterios) !== f.franja) return false;
  // Categoría
  if (f.categoria && r.categoria !== f.categoria) return false;
  // Tipo de actor
  if (f.actor && r.actor !== f.actor) return false;
  // Rango de horas (incluye "desde", excluye "hasta"). "HH:MM" se compara como texto.
  var hora = horaDeReporte(r.fecha_hora);
  if (f.horaDesde && hora < f.horaDesde) return false;
  if (f.horaHasta && hora >= f.horaHasta) return false;
  return true;
}

if (typeof module !== "undefined") {
  module.exports = { filtrarReportes: filtrarReportes };
}
