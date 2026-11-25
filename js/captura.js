/* =====================================================================
   captura.js — Captura rápida y ubicada (RF-01, caso de uso CU-01)
   ---------------------------------------------------------------------
   1. El usuario toca el mapa o usa la ubicación del celular.
   2. Se detecta la cuadra de vias.json más cercana al punto.
   3. Elige categoría y actor (botones grandes) y, si quiere, una foto.
   4. La foto se reduce a máximo 800 px de ancho y se puede pixelar.
   5. Al guardar: se calcula la criticidad, se guarda en localStorage y
      se avisa al tablero para que se actualice.
   También mide cuántos segundos tomó el reporte (prueba de los 30 s).
   ===================================================================== */

var ANCHO_MAX_FOTO = 800;      // píxeles (lo pide el enunciado)
var CALIDAD_JPEG = 0.6;        // 0 a 1: menos calidad = archivo más liviano
var DISTANCIA_MAX_M = 60;      // si el punto está más lejos de toda cuadra, se avisa
var CLAVE_TIEMPOS = "malparqueo_tiempos";

var captura = { mapa: null, marcador: null, punto: null, hayFoto: false, inicio: null };

// Arranca la vista de captura. "app" trae los datos y la función alGuardar.
function iniciarCaptura(app) {
  crearBotones("opc-categoria", "categoria", ETIQUETAS.categoria);
  crearBotones("opc-actor", "actor", ETIQUETAS.actor);

  var sel = document.getElementById("sel-cuadra");
  app.vias.cuadras.forEach(function (c) {
    sel.add(new Option(c.id + " · " + c.nombre + " (" + c.tipo + ")", c.id));
  });

  captura.mapa = crearMapa("mapa-captura", app.vias);
  captura.mapa.on("click", function (e) { ponerPunto(e.latlng.lat, e.latlng.lng, app); });

  document.getElementById("btn-ubicacion").onclick = function () { usarUbicacion(app); };
  document.getElementById("in-foto").onchange = function (e) { cargarFoto(e.target.files[0]); };
  document.getElementById("lienzo-foto").onclick = pixelarDonde;
  document.getElementById("btn-quitar-foto").onclick = quitarFoto;
  document.getElementById("form-reporte").onsubmit = function (e) { e.preventDefault(); guardarReporte(app); };
  // Cualquier cambio en el formulario arranca el cronómetro
  document.getElementById("form-reporte").addEventListener("change", empezarCronometro);
  mostrarTiempos();
}

// Crea un grupo de botones tipo "radio" (solo se puede elegir uno).
function crearBotones(idContenedor, nombre, etiquetas) {
  var caja = document.getElementById(idContenedor);
  Object.keys(etiquetas).forEach(function (clave) {
    var label = document.createElement("label");
    label.className = "opcion";
    label.innerHTML = '<input type="radio" name="' + nombre + '" value="' + clave + '" required><span>' + etiquetas[clave] + "</span>";
    caja.appendChild(label);
  });
}

function empezarCronometro() {
  if (!captura.inicio) captura.inicio = Date.now();
}

// Pone (o mueve) el marcador y detecta la cuadra más cercana.
function ponerPunto(lat, lng, app) {
  empezarCronometro();
  captura.punto = { lat: lat, lng: lng };
  if (captura.marcador) captura.marcador.setLatLng([lat, lng]);
  else captura.marcador = L.marker([lat, lng]).addTo(captura.mapa);

  var cerca = cuadraMasCercana(lat, lng, app.vias);
  var info = document.getElementById("info-ubicacion");
  if (cerca.distancia <= DISTANCIA_MAX_M) {
    document.getElementById("sel-cuadra").value = cerca.cuadra.id;
    info.textContent = "Cuadra detectada: " + cerca.cuadra.nombre + " (a " + Math.round(cerca.distancia) + " m).";
    info.className = "nota";
  } else {
    document.getElementById("sel-cuadra").value = "";
    info.textContent = "⚠️ El punto está a " + Math.round(cerca.distancia) + " m de la zona de estudio. Elija la cuadra a mano o marque otro punto.";
    info.className = "nota alerta";
  }
}

// Usa el GPS del celular (el navegador pide permiso; requiere https o localhost).
function usarUbicacion(app) {
  var info = document.getElementById("info-ubicacion");
  if (!navigator.geolocation) { info.textContent = "Este navegador no permite ubicación."; return; }
  info.textContent = "Buscando ubicación…";
  navigator.geolocation.getCurrentPosition(function (pos) {
    ponerPunto(pos.coords.latitude, pos.coords.longitude, app);
    captura.mapa.setView([pos.coords.latitude, pos.coords.longitude], 18);
  }, function (err) {
    info.textContent = "No se pudo obtener la ubicación (" + err.message + "). Toque el mapa.";
  }, { enableHighAccuracy: true, timeout: 10000 });
}

/* Distancia (en metros) de un punto a cada cuadra; devuelve la más cercana.
   Cada cuadra es un segmento entre "inicio" y "fin". Se pasa a metros con una
   aproximación plana (suficiente para unas pocas cuadras). */
function cuadraMasCercana(lat, lng, vias) {
  var mLat = 111320;                                   // metros por grado de latitud
  var mLng = 111320 * Math.cos(lat * Math.PI / 180);   // metros por grado de longitud
  var mejor = null, mejorDist = Infinity;
  vias.cuadras.forEach(function (c) {
    // Coordenadas en metros con el punto marcado como origen (0,0)
    var ax = (c.inicio[1] - lng) * mLng, ay = (c.inicio[0] - lat) * mLat;
    var bx = (c.fin[1] - lng) * mLng, by = (c.fin[0] - lat) * mLat;
    var dx = bx - ax, dy = by - ay;
    // t = qué tan avanzado sobre el segmento está el punto más cercano (0 a 1)
    var t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
    var px = ax + t * dx, py = ay + t * dy;
    var dist = Math.sqrt(px * px + py * py);
    if (dist < mejorDist) { mejorDist = dist; mejor = c; }
  });
  return { cuadra: mejor, distancia: mejorDist };
}

// ---------------------------- FOTO ----------------------------
// Dibuja la foto en un lienzo de máximo 800 px de ancho (así pesa poco).
function cargarFoto(archivo) {
  if (!archivo) return;
  empezarCronometro();
  var img = new Image();
  img.onload = function () {
    var escala = Math.min(1, ANCHO_MAX_FOTO / img.width);
    var lienzo = document.getElementById("lienzo-foto");
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
    URL.revokeObjectURL(img.src);
    captura.hayFoto = true;
    document.getElementById("caja-foto").hidden = false;
  };
  img.src = URL.createObjectURL(archivo);
}

// Pixela un cuadro alrededor del punto tocado (para tapar placas o rostros).
function pixelarDonde(e) {
  var lienzo = e.target, ctx = lienzo.getContext("2d");
  var rect = lienzo.getBoundingClientRect();
  var x = (e.clientX - rect.left) * (lienzo.width / rect.width);
  var y = (e.clientY - rect.top) * (lienzo.height / rect.height);
  var lado = Math.round(lienzo.width / 5);             // tamaño del cuadro pixelado
  // Esquina superior izquierda del cuadro, sin salirse de la foto
  var x0 = Math.min(Math.max(0, Math.round(x - lado / 2)), lienzo.width - lado);
  var y0 = Math.min(Math.max(0, Math.round(y - lado / 2)), lienzo.height - lado);
  if (y0 < 0) y0 = 0;
  var bloque = 12;                                     // tamaño de cada "pixel" grande
  // Truco: se dibuja el cuadro muy pequeño y luego se agranda sin suavizado.
  var mini = document.createElement("canvas");
  mini.width = Math.ceil(lado / bloque); mini.height = Math.ceil(lado / bloque);
  mini.getContext("2d").drawImage(lienzo, x0, y0, lado, lado, 0, 0, mini.width, mini.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(mini, 0, 0, mini.width, mini.height, x0, y0, lado, lado);
}

function quitarFoto() {
  captura.hayFoto = false;
  document.getElementById("in-foto").value = "";
  document.getElementById("caja-foto").hidden = true;
}

// ---------------------------- GUARDAR ----------------------------
function guardarReporte(app) {
  var form = document.getElementById("form-reporte");
  var cuadra = document.getElementById("sel-cuadra").value;
  var categoria = form.querySelector('input[name="categoria"]:checked');
  var actor = form.querySelector('input[name="actor"]:checked');

  // Validación del formulario
  var falta = [];
  if (!captura.punto) falta.push("la ubicación");
  if (!cuadra) falta.push("la cuadra");
  if (!categoria) falta.push("la categoría");
  if (!actor) falta.push("el actor");
  if (falta.length) { mostrarResultado("Falta " + falta.join(", ") + ".", "error"); return; }

  var fecha = document.getElementById("in-fecha").value;   // "" = ahora
  var reporte = {
    id: nuevoId(),
    origen: document.getElementById("sel-origen").value,
    fecha_hora: fecha ? fecha.slice(0, 16) : fechaHoraLocal(),
    lat: Number(captura.punto.lat.toFixed(6)),
    lng: Number(captura.punto.lng.toFixed(6)),
    cuadra: cuadra,
    categoria: categoria.value,
    actor: actor.value,
    foto: captura.hayFoto ? document.getElementById("lienzo-foto").toDataURL("image/jpeg", CALIDAD_JPEG) : null,
    criticidad: null
  };
  var calc = calcularCriticidad(reporte, app.vias, app.criterios);
  reporte.criticidad = { puntaje: calc.puntaje, nivel: calc.nivel };

  // Guardar en localStorage (puede fallar si el navegador está lleno)
  var locales = leerLocales();
  locales.push(reporte);
  try {
    guardarLocales(locales);
  } catch (err) {
    if (reporte.foto && confirm("El almacenamiento del navegador está lleno. ¿Guardar el reporte SIN foto?")) {
      reporte.foto = null;
      try { guardarLocales(locales); } catch (e2) { mostrarResultado("No se pudo guardar: exporte y borre reportes antiguos.", "error"); return; }
    } else { mostrarResultado("No se pudo guardar: el almacenamiento está lleno. Exporte sus reportes.", "error"); return; }
  }

  // Tiempo empleado (prueba de los 30 segundos)
  var segundos = captura.inicio ? Math.round((Date.now() - captura.inicio) / 1000) : 0;
  var tiempos = JSON.parse(localStorage.getItem(CLAVE_TIEMPOS) || "[]");
  tiempos.push(segundos);
  localStorage.setItem(CLAVE_TIEMPOS, JSON.stringify(tiempos.slice(-20)));

  var d = calc.detalle;
  mostrarResultado("Guardado " + reporte.id + " en " + segundos + " s.<br>Criticidad: <b>" + calc.puntaje + " puntos · " + calc.nivel +
    "</b><br><small>" + d.categoria + " (categoría) + " + d.via + " (vía " + d.tipo_via + ") + " + d.peso_franja + " (hora " + d.franja + ")</small>",
    "ok nivel-" + calc.nivel);

  // Limpiar para el siguiente reporte (se deja el mapa donde estaba)
  form.reset();
  quitarFoto();
  if (captura.marcador) { captura.mapa.removeLayer(captura.marcador); captura.marcador = null; }
  captura.punto = null; captura.inicio = null;
  document.getElementById("info-ubicacion").textContent = "";
  mostrarTiempos();
  app.alGuardar();
}

function mostrarResultado(html, clase) {
  var caja = document.getElementById("resultado");
  caja.innerHTML = html; caja.className = "resultado " + clase; caja.hidden = false;
}

function mostrarTiempos() {
  var t = JSON.parse(localStorage.getItem(CLAVE_TIEMPOS) || "[]");
  document.getElementById("tiempos").textContent = t.length ? "⏱️ Últimos tiempos de captura: " + t.slice(-5).join(" s, ") + " s" : "";
}
