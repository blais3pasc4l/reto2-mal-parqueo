/* =====================================================================
   datos.js — Carga de los archivos JSON y almacenamiento en el navegador
   ---------------------------------------------------------------------
   - Lee datos/vias.json, datos/criterios.json y datos/reportes.json.
   - Si reportes.json está vacío ( [] ), carga datos/reportes_ejemplo.json
     y la aplicación muestra un aviso de DATOS DE EJEMPLO.
   - Los reportes nuevos de este celular se guardan en localStorage.
   - Exporta e importa reportes en JSON sin duplicar (se comparan por id).
   ===================================================================== */

// Nombres legibles de las categorías y actores (RF-01).
// La clave (izquierda) es la que se guarda en reportes.json.
var ETIQUETAS = {
  categoria: {
    doble_fila: "Estacionamiento en vía prohibida o doble fila",
    bloqueo_rampa_cebra_paradero: "Bloqueo de rampa peatonal, cebra o paradero",
    invasion_anden: "Invasión de andén por comercio o mercancía"
  },
  actor: {
    vehiculo_particular: "Vehículo particular",
    motocicleta: "Motocicleta",
    vehiculo_carga: "Vehículo de carga descargando",
    mobiliario_comercial: "Mobiliario comercial"
  },
  franja: { pico: "Hora pico", valle: "Hora valle" }
};

var CLAVE_LOCAL = "malparqueo_reportes";   // nombre del espacio en localStorage

// Lee un archivo JSON con fetch (necesita servidor local o GitHub Pages).
function cargarJSON(ruta) {
  return fetch(ruta, { cache: "no-store" }).then(function (resp) {
    if (!resp.ok) throw new Error("No se pudo leer " + ruta + " (" + resp.status + ")");
    return resp.json();
  });
}

// Carga los tres archivos de datos. Devuelve una promesa con todo junto.
function cargarDatos() {
  return Promise.all([
    cargarJSON("datos/vias.json"),
    cargarJSON("datos/criterios.json"),
    cargarJSON("datos/reportes.json")
  ]).then(function (r) {
    var datos = { vias: r[0], criterios: r[1], precargados: r[2], sonEjemplo: false };
    if (datos.precargados.length > 0) return datos;
    // reportes.json vacío: se usan los datos de ejemplo
    return cargarJSON("datos/reportes_ejemplo.json").then(function (ej) {
      datos.precargados = ej;
      datos.sonEjemplo = true;
      return datos;
    });
  });
}

// ---------- localStorage (reportes hechos en ESTE navegador) ----------
function leerLocales() {
  try { return JSON.parse(localStorage.getItem(CLAVE_LOCAL)) || []; }
  catch (e) { return []; }
}

// Guarda la lista. Si el navegador se llena (unos 5 MB) lanza un error
// que captura.js muestra al usuario.
function guardarLocales(lista) {
  localStorage.setItem(CLAVE_LOCAL, JSON.stringify(lista));
}

// Une dos listas sin repetir: si un id ya existe, el nuevo se ignora.
function unirSinDuplicados(lista, nuevos) {
  var ids = {};
  lista.forEach(function (r) { ids[r.id] = true; });
  var agregados = 0, repetidos = 0;
  var salida = lista.slice();
  nuevos.forEach(function (r) {
    if (ids[r.id]) { repetidos++; return; }
    ids[r.id] = true; salida.push(r); agregados++;
  });
  return { lista: salida, agregados: agregados, repetidos: repetidos };
}

// Crea un id que no se repite entre celulares: MP-<fecha y hora>-<letras al azar>
function nuevoId() {
  var d = new Date();
  function dos(n) { return String(n).padStart(2, "0"); }
  return "MP-" + d.getFullYear() + dos(d.getMonth() + 1) + dos(d.getDate()) + "-" +
    dos(d.getHours()) + dos(d.getMinutes()) + dos(d.getSeconds()) + "-" +
    Math.random().toString(36).slice(2, 5).toUpperCase();
}

// Fecha y hora local en el formato del modelo: "2026-11-18T11:40"
function fechaHoraLocal(d) {
  d = d || new Date();
  function dos(n) { return String(n).padStart(2, "0"); }
  return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()) +
    "T" + dos(d.getHours()) + ":" + dos(d.getMinutes());
}

// Revisa que un objeto importado tenga los campos mínimos de un reporte.
function esReporteValido(r) {
  return r && typeof r.id === "string" && typeof r.fecha_hora === "string" &&
    typeof r.lat === "number" && typeof r.lng === "number" &&
    typeof r.cuadra === "string" && typeof r.categoria === "string" && typeof r.actor === "string";
}

// Descarga un texto como archivo (sin servidor: se crea un enlace temporal).
function descargarArchivo(nombre, contenido, tipo) {
  var blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo || "application/json" });
  var a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

if (typeof module !== "undefined") {
  module.exports = { unirSinDuplicados: unirSinDuplicados, esReporteValido: esReporteValido,
    fechaHoraLocal: fechaHoraLocal, nuevoId: nuevoId, ETIQUETAS: ETIQUETAS };
}
