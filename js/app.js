/* =====================================================================
   app.js — Arranque de la aplicación y tablero
   ---------------------------------------------------------------------
   - Carga los datos (datos.js) y recalcula la criticidad de todos los
     reportes con los pesos ACTUALES de criterios.json. Por eso, si se
     cambia un peso y se recarga la página, cambian los puntajes, el mapa
     de calor y el resumen operativo.
   - Cambia entre las dos vistas: #captura y #tablero.
   - Tablero: filtros (RF-04), conteos y porcentajes (CU-02), mapa (RF-03),
     resumen (RF-05) y exportar/importar (RF-06, CU-04).
   ===================================================================== */

var app = {
  vias: null, criterios: null,
  precargados: [],    // los de datos/reportes.json (o los de ejemplo)
  todos: [],          // precargados + los guardados en este navegador
  mapaTablero: null,
  alGuardar: function () { juntarReportes(); refrescarTablero(); }
};

cargarDatos().then(function (datos) {
  app.vias = datos.vias;
  app.criterios = datos.criterios;
  app.precargados = datos.precargados;
  document.getElementById("aviso-ejemplo").hidden = !datos.sonEjemplo;
  juntarReportes();
  iniciarCaptura(app);
  iniciarTablero();
  window.addEventListener("hashchange", mostrarVista);
  function alCambiarTamanoVentana() {
    if (app.mapaTablero && !document.getElementById("vista-tablero").hidden) {
      ajustarTamanoMapa(app.mapaTablero);
    }
  }
  window.addEventListener("resize", alCambiarTamanoVentana);
  // No se escucha visualViewport: en Android se dispara al esconder la barra
  // de direcciones o a mitad del gesto, y un invalidateSize/reset despega el calor.
  mostrarVista();
}).catch(function (err) {
  var caja = document.getElementById("error-carga");
  caja.hidden = false;
  caja.innerHTML = "No se pudieron leer los archivos de <code>datos/</code>: " + err.message +
    ".<br>Abra la aplicación con un servidor local (por ejemplo Live Server de VS Code) o desde GitHub Pages, no con doble clic.";
});

// Une precargados + locales sin repetir id y recalcula la criticidad de cada uno.
function juntarReportes() {
  var union = unirSinDuplicados(app.precargados, leerLocales()).lista;
  union.forEach(function (r) {
    var c = calcularCriticidad(r, app.vias, app.criterios);
    r.criticidad = { puntaje: c.puntaje, nivel: c.nivel };
  });
  app.todos = union;
}

// Muestra la vista según el "#" de la dirección (por defecto: captura).
function mostrarVista() {
  var esTablero = location.hash === "#tablero";
  document.getElementById("vista-captura").hidden = esTablero;
  document.getElementById("vista-tablero").hidden = !esTablero;
  document.getElementById("tab-captura").classList.toggle("activa", !esTablero);
  document.getElementById("tab-tablero").classList.toggle("activa", esTablero);
  if (esTablero) {
    // El mapa del tablero se crea la primera vez que la vista es visible
    // (Leaflet.heat falla si el mapa se crea escondido, con tamaño 0).
    if (!app.mapaTablero) app.mapaTablero = crearMapa("mapa-tablero", app.vias);
    app.mapaTablero.invalidateSize();
    refrescarTablero();
    // Segundo ajuste cuando el layout del celular ya midió el mapa.
    requestAnimationFrame(function () { ajustarTamanoMapa(app.mapaTablero); });
  } else if (captura.mapa) {
    // Al esconder el tablero se quita la capa de calor: si el mapa escondido
    // cambia de tamaño, Leaflet.heat falla al dibujar en un lienzo de tamaño 0.
    if (app.mapaTablero && capasTablero.calor) app.mapaTablero.removeLayer(capasTablero.calor);
    if (app.mapaTablero && capasTablero.hexagonos) app.mapaTablero.removeLayer(capasTablero.hexagonos);
    captura.mapa.invalidateSize();
    // Si el mapa de captura se creó escondido, se vuelve a encuadrar la zona una vez
    if (!captura.encuadrado) { captura.mapa.fitBounds(captura.mapa.limitesZona, { padding: [30, 30] }); captura.encuadrado = true; }
  }
}

// ----------------------------- TABLERO -----------------------------
function iniciarTablero() {
  // Llenar los selectores de filtros a partir de los datos
  var zona = document.getElementById("f-zona");
  zona.add(new Option("Todas", ""));
  var grupoSector = document.createElement("optgroup"); grupoSector.label = "Sectores";
  var sectores = [];
  app.vias.cuadras.forEach(function (c) { if (sectores.indexOf(c.sector) < 0) sectores.push(c.sector); });
  sectores.forEach(function (s) { grupoSector.appendChild(new Option("Sector: " + s, "sector:" + s)); });
  var grupoCuadra = document.createElement("optgroup"); grupoCuadra.label = "Cuadras";
  app.vias.cuadras.forEach(function (c) { grupoCuadra.appendChild(new Option(c.id + " (" + c.tipo + ")", "cuadra:" + c.id)); });
  zona.appendChild(grupoSector); zona.appendChild(grupoCuadra);
  llenarSelect("f-categoria", ETIQUETAS.categoria);
  llenarSelect("f-actor", ETIQUETAS.actor);

  // Cada cambio de filtro redibuja todo SIN recargar la página
  ["f-zona", "f-franja", "f-categoria", "f-actor", "f-desde", "f-hasta", "f-puntos", "f-hex"].forEach(function (id) {
    document.getElementById(id).addEventListener("change", refrescarTablero);
  });
  document.getElementById("btn-limpiar").onclick = function () {
    ["f-zona", "f-franja", "f-categoria", "f-actor", "f-desde", "f-hasta"].forEach(function (id) { document.getElementById(id).value = ""; });
    refrescarTablero();
  };
  document.getElementById("btn-imprimir").onclick = function () { window.print(); };
  document.getElementById("btn-exportar").onclick = exportarLocales;
  document.getElementById("btn-exportar-todo").onclick = exportarParaRepositorio;
  document.getElementById("in-importar").onchange = function (e) { importarArchivos(e.target.files); e.target.value = ""; };
  document.getElementById("btn-borrar").onclick = function () {
    if (confirm("¿Borrar los reportes guardados en ESTE navegador? Exporte antes si los necesita.")) {
      localStorage.removeItem(CLAVE_LOCAL); juntarReportes(); refrescarTablero();
    }
  };
  mostrarPesos();
}

function llenarSelect(id, etiquetas) {
  var sel = document.getElementById(id);
  sel.add(new Option("Todas", ""));
  Object.keys(etiquetas).forEach(function (k) { sel.add(new Option(etiquetas[k], k)); });
}

// Lee los filtros que el usuario eligió en pantalla.
function leerFiltros() {
  return {
    zona: document.getElementById("f-zona").value,
    franja: document.getElementById("f-franja").value,
    categoria: document.getElementById("f-categoria").value,
    actor: document.getElementById("f-actor").value,
    horaDesde: document.getElementById("f-desde").value,
    horaHasta: document.getElementById("f-hasta").value
  };
}

// Redibuja mapa, conteos, resumen y tabla con los reportes filtrados.
function refrescarTablero() {
  if (!app.mapaTablero || document.getElementById("vista-tablero").hidden) return;
  var filtrados = filtrarReportes(app.todos, leerFiltros(), app.vias, app.criterios);
  dibujarReportes(app.mapaTablero, filtrados, app.criterios, document.getElementById("f-puntos").checked, textoPopup);
  // Capa opcional de hexágonos (también respeta los filtros)
  var verHex = document.getElementById("f-hex").checked;
  dibujarHexagonos(app.mapaTablero, filtrados, app.criterios, app.vias, verHex);
  document.getElementById("leyenda-hex").hidden = !verHex;
  mostrarConteos(filtrados);
  mostrarResumen(filtrados);
  mostrarTabla(filtrados);
  var locales = leerLocales().length;
  document.getElementById("info-datos").textContent = "Precargados: " + app.precargados.length +
    " · Guardados en este navegador: " + locales + " · Total sin repetidos: " + app.todos.length;
}

// Conteos y porcentajes por categoría, actor, franja y nivel (CU-02).
function mostrarConteos(lista) {
  var html = "<p class='grande'><b>" + lista.length + "</b> de " + app.todos.length + " reportes</p>";
  if (lista.length) {
    var franjas = lista.map(function (r) { return { f: franjaDeHora(r.fecha_hora, app.criterios) }; });
    html += bloqueBarras("Por categoría", lista, "categoria", ETIQUETAS.categoria);
    html += bloqueBarras("Por actor", lista, "actor", ETIQUETAS.actor);
    html += bloqueBarras("Por franja", franjas, "f", ETIQUETAS.franja);
    html += bloqueBarras("Por nivel", lista.map(function (r) { return { n: r.criticidad.nivel }; }), "n", { Alto: "Alto", Medio: "Medio", Bajo: "Bajo" });
  }
  document.getElementById("conteos").innerHTML = html;
}

function bloqueBarras(titulo, lista, campo, etiquetas) {
  var conteo = contarPor(lista, campo);        // de resumen.js
  var html = "<h3>" + titulo + "</h3>";
  Object.keys(etiquetas).forEach(function (k) {
    var n = conteo[k] || 0, pct = Math.round(n * 100 / lista.length);
    html += "<div class='barra-dato'><span>" + etiquetas[k] + "</span><b>" + n + " · " + pct + "%</b>" +
      "<div class='barra-fondo'><div style='width:" + pct + "%'></div></div></div>";
  });
  return html;
}

function mostrarResumen(lista) {
  var f = leerFiltros(), partes = [];
  if (f.zona) partes.push(f.zona.replace(":", ": "));
  if (f.franja) partes.push("franja " + f.franja);
  if (f.categoria) partes.push(ETIQUETAS.categoria[f.categoria]);
  if (f.actor) partes.push(ETIQUETAS.actor[f.actor]);
  if (f.horaDesde || f.horaHasta) partes.push("horas " + (f.horaDesde || "00:00") + "–" + (f.horaHasta || "24:00"));
  document.getElementById("resumen-filtros").textContent = "Filtros: " + (partes.join(" · ") || "ninguno") +
    " · Generado: " + new Date().toLocaleString("es-CO");

  var resumen = generarResumen(lista, app.vias, app.criterios, 5);
  var cajaLista = document.getElementById("resumen-lista");
  if (!resumen.length) {
    cajaLista.innerHTML = "<p>No hay reportes con estos filtros.</p>";
  } else {
    var html = "<ol class='resumen'>";
    resumen.forEach(function (c) {
      html += "<li><div><b>" + c.cuadra + "</b> · " + c.nombre + "</div>" +
        "<div class='nota'>" + c.total_reportes + " reportes · puntaje acumulado <b>" + c.puntaje_acumulado + "</b></div><ul>";
      c.recomendaciones.forEach(function (r) {
        html += "<li>👉 <b>" + r.texto + "</b><br><small>Regla: " + r.regla + "</small></li>";
      });
      html += "</ul></li>";
    });
    cajaLista.innerHTML = html + "</ol>";
  }
  dibujarGraficaPicoValle(
    document.getElementById("grafica-pico-valle"),
    contarPicoVallePorCuadra(lista, app.vias, app.criterios)
  );
}

function mostrarTabla(lista) {
  var html = "<tr><th>id</th><th>fecha_hora</th><th>cuadra</th><th>categoría</th><th>actor</th><th>franja</th><th>puntaje</th><th>nivel</th></tr>";
  lista.forEach(function (r) {
    html += "<tr><td>" + r.id + "</td><td>" + r.fecha_hora + "</td><td>" + r.cuadra + "</td><td>" + r.categoria +
      "</td><td>" + r.actor + "</td><td>" + franjaDeHora(r.fecha_hora, app.criterios) + "</td><td>" + r.criticidad.puntaje +
      "</td><td class='nivel-" + r.criticidad.nivel + "'>" + r.criticidad.nivel + "</td></tr>";
  });
  document.getElementById("tabla-reportes").innerHTML = html;
}

function rutaFoto(foto) {
  if (!foto) return null;
  if (foto.indexOf("data:") === 0) return foto;
  if (foto.indexOf("datos/") === 0) return foto;
  if (foto.indexOf("fotos/") === 0) return "datos/" + foto;
  return "datos/fotos/" + foto;
}

function textoPopup(r) {
  var c = calcularCriticidad(r, app.vias, app.criterios), d = c.detalle;
  var cuadra = buscarCuadra(r.cuadra, app.vias);
  var nombreCuadra = cuadra ? cuadra.nombre : r.cuadra;
  var tipoVia = d.tipo_via || (cuadra ? cuadra.tipo : "desconocida");
  var nota = r.observacion || r.descripcion || r.observaciones || "";
  var src = rutaFoto(r.foto);
  var bloqueFoto = src
    ? "<a href='" + src + "' target='_blank' rel='noopener'><img class='foto-popup' src='" + src + "' alt='Foto anonimizada del reporte'></a>"
    : "<div class='sin-foto'>Sin foto</div>";
  return "<div class='ficha-popup'>" +
    "<p class='ficha-id'><b>" + r.id + "</b></p>" +
    "<p><b>Fecha y hora:</b> " + r.fecha_hora.replace("T", " ") + "</p>" +
    "<p><b>Cuadra:</b> " + nombreCuadra + " <span class='tipo-via'>(" + tipoVia + ")</span></p>" +
    "<p><b>Categoría:</b> " + (ETIQUETAS.categoria[r.categoria] || r.categoria) + "</p>" +
    "<p><b>Actor:</b> " + (ETIQUETAS.actor[r.actor] || r.actor) + "</p>" +
    "<p><b>Franja:</b> " + (ETIQUETAS.franja[d.franja] || d.franja) + "</p>" +
    "<p><b>Criticidad:</b> <span class='nivel-" + c.nivel + "'>" + c.puntaje + " pts · " + c.nivel + "</span><br>" +
    "<small>" + d.categoria + " (categoría) + " + d.via + " (vía " + tipoVia + ") + " + d.peso_franja + " (hora " + d.franja + ")</small></p>" +
    (nota ? "<p><b>Observación:</b> " + nota + "</p>" : "") +
    bloqueFoto +
    "</div>";
}

function mostrarPesos() {
  var c = app.criterios;
  function lista(obj) { return Object.keys(obj).map(function (k) { return k + " = " + obj[k]; }).join(" · "); }
  document.getElementById("pesos").innerHTML =
    "<p><b>Categoría:</b> " + lista(c.categoria) + "</p><p><b>Vía:</b> " + lista(c.via) + "</p>" +
    "<p><b>Franja:</b> " + lista(c.franja) + "</p><p><b>Horas pico:</b> " + c.horas_pico.join(", ") + "</p>" +
    "<p><b>Niveles:</b> " + Object.keys(c.niveles).map(function (k) { return k + " " + c.niveles[k][0] + "–" + c.niveles[k][1]; }).join(" · ") + "</p>" +
    "<p><b>Ancho de los hexágonos:</b> " + ((c.mapa_hexagonos && c.mapa_hexagonos.ancho_metros) || ANCHO_HEX_POR_DEFECTO) + " m</p>";
}

// --------------------- EXPORTAR / IMPORTAR (RF-06) ---------------------
// Descarga los reportes guardados en este navegador (con sus fotos).
function exportarLocales() {
  var locales = leerLocales();
  if (!locales.length) { mensajeDatos("No hay reportes guardados en este navegador."); return; }
  descargarArchivo("reportes-" + fechaHoraLocal().replace(/[:T]/g, "-") + ".json", JSON.stringify(locales, null, 2));
  mensajeDatos("Se exportaron " + locales.length + " reportes.");
}

// Lee uno o varios archivos JSON y agrega solo los reportes con id nuevo.
function importarArchivos(archivos) {
  var pendientes = Array.prototype.slice.call(archivos);
  Promise.all(pendientes.map(function (f) { return f.text(); })).then(function (textos) {
    var nuevos = [], invalidos = 0;
    textos.forEach(function (t) {
      var datos = JSON.parse(t);
      if (!Array.isArray(datos)) datos = datos.reportes || [];
      datos.forEach(function (r) { if (esReporteValido(r)) nuevos.push(r); else invalidos++; });
    });
    // Se compara contra TODO lo que ya está (precargados + locales) para no duplicar
    var yaEstan = {};
    app.todos.forEach(function (r) { yaEstan[r.id] = true; });
    var aGuardar = nuevos.filter(function (r) { return !yaEstan[r.id]; });
    var resultado = unirSinDuplicados(leerLocales(), aGuardar);
    guardarLocales(resultado.lista);
    juntarReportes(); refrescarTablero();
    mensajeDatos("Importados: " + resultado.agregados + " nuevos · " + (nuevos.length - resultado.agregados) +
      " repetidos (mismo id) omitidos" + (invalidos ? " · " + invalidos + " registros inválidos" : "") + ".");
  }).catch(function (e) { mensajeDatos("Error al importar: " + e.message); });
}

// Genera el reportes.json definitivo para el repositorio: todos los reportes
// (sin los de ejemplo) con las fotos como archivos aparte en datos/fotos/.
function exportarParaRepositorio() {
  var reales = app.todos.filter(function (r) { return !r.ejemplo; });
  if (!reales.length) { mensajeDatos("No hay reportes reales todavía (los de ejemplo no se exportan)."); return; }
  var fotos = [];
  var salida = reales.map(function (r) {
    var copia = JSON.parse(JSON.stringify(r));
    if (copia.foto && copia.foto.indexOf("data:") === 0) {
      var nombre = "fotos/" + copia.id.toLowerCase() + ".jpg";
      fotos.push({ nombre: nombre, dataUrl: copia.foto });
      copia.foto = nombre;
    }
    return copia;
  });
  descargarArchivo("reportes.json", JSON.stringify(salida, null, 2));
  // Cada foto se descarga como archivo .jpg (el navegador puede pedir permiso)
  fotos.forEach(function (f, i) {
    setTimeout(function () {
      fetch(f.dataUrl).then(function (r) { return r.blob(); }).then(function (b) { descargarArchivo(f.nombre.replace("fotos/", ""), b); });
    }, 400 * (i + 1));
  });
  mensajeDatos("Se generó reportes.json con " + salida.length + " reportes y " + fotos.length +
    " fotos. Copie reportes.json a datos/ y las fotos a datos/fotos/.");
}

function mensajeDatos(t) { document.getElementById("msg-datos").textContent = t; }
