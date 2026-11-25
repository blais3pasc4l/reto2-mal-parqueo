# Bitácora de ingeniería: Reto 2 (máximo tres páginas)

**Equipo:** _______________________  **Repositorio:** _______________________
**Integrantes y rol:**
- Analista de campo y privacidad: ____________________
- Integrador del mapa e instrucciones para la IA: ____________________
- Ingeniero de lógica y clasificación: ____________________
- Diseñador de interfaz y documentador: ____________________

**Asistente(s) de IA usados y para qué partes:** ______________________________________
(ejemplo: "Grok Bot / ChatGPT / Copilot: primera versión del código de captura, mapa y filtros; revisión de textos")

---

## 1. ¿Cómo definimos las reglas de criticidad y por qué esos pesos?

Partan de `criterios-justificacion.md` y **agreguen lo que vieron en la calle**:
- ¿Qué categoría vimos que más estorbaba y por qué? (dato del recorrido: ___)
- ¿Las horas pico que pusimos coinciden con lo observado? (recorrido pico: __:__ a __:__; recorrido valle: __:__ a __:__)
- ¿Cambiamos algún peso después de los recorridos? ¿Cuál, de cuánto a cuánto y por qué?
- Clasificación de las cuadras: ¿cuáles son arteriales y cuáles secundarias, y con qué criterio? (buses, carriles, flujo observado)

## 2. ¿Qué problemas tuvimos en la calle y con la IA?

### Problemas en la calle
| Fecha | Problema | Qué hicimos |
|---|---|---|
| | | |

### Fallos de la IA (mínimo dos, con los cinco datos)

**Fallo 1**
| Dato | Qué escribir |
|---|---|
| Lo que se pidió | (la instrucción exacta dada a la IA) |
| Lo que entregó | (resultado, con captura o fragmento de código) |
| Cómo lo notaron | (prueba, recorrido o revisión que destapó el error) |
| Cómo lo corrigieron | (cambio en el código, en los datos o en la instrucción) |
| Instrucción final | (la versión que sí funcionó) |

**Fallo 2**
| Dato | Qué escribir |
|---|---|
| Lo que se pidió | |
| Lo que entregó | |
| Cómo lo notaron | |
| Cómo lo corrigieron | |
| Instrucción final | |

Adjuntar como anexo las capturas o la exportación de las conversaciones donde ocurrieron.

> **Fallos reales que ocurrieron al construir este prototipo con un agente de IA.** Sirven de referencia. Si los usan, **reprodúzcanlos ustedes** y documéntenlos con su propia evidencia (captura de la consola, del código o de la conversación):
> 1. **La capa de calor fallaba al cambiar de vista.** El primer código creaba la capa de calor y la dejaba puesta cuando el tablero se escondía. Al cambiar el tamaño de la ventana con el tablero escondido, la consola mostraba `IndexSizeError: Failed to execute 'getImageData'... The source width is 0`. Se notó con una prueba automática en un navegador sin pantalla que revisa los errores de la consola. Corrección: crear el mapa del tablero solo cuando la vista es visible y quitar la capa de calor al esconderlo (`mostrarVista` en `app.js`).
> 2. **El mensaje de "Falta la ubicación…" nunca aparecía.** Los campos tenían el atributo `required` y el navegador bloqueaba el envío con su propia validación antes de que `captura.js` pudiera mostrar qué faltaba (y en los botones de opción ocultos el aviso del navegador ni se veía). Se notó al probar a enviar el formulario vacío. Corrección: `novalidate` en el `<form>`; la validación la hace `guardarReporte()`.
> 3. **Un conteo esperado mal hecho.** La IA afirmó que un filtro por sector + categoría debía dar 11 reportes, pero la prueba con conteo independiente dio 10. Al contar a mano sobre el archivo se confirmó que eran 10 (el error estaba en la "cuenta mental" de la IA, no en el filtro). Lección: los conteos de RF-04 se verifican contando sobre `reportes.json`, no confiando en la IA.

## 3. ¿Qué patrones encontramos en la zona?

(Con los datos reales: cuadras más críticas, a qué horas, categoría y actor más frecuentes, diferencias entre pico y valle. Usen el tablero: filtros + porcentajes + resumen operativo. Incluyan una captura del mapa de calor.)

- Cuadra más crítica: ________ (puntaje acumulado __, __ reportes)
- En hora pico predominó: ________ ; en hora valle: ________
- Recomendaciones que dio el resumen y si nos parecen razonables: ________

## 4. Prueba de los 30 segundos

Resumen de `prueba-30-segundos.md`: __ personas, tiempo promedio __ s, máximo __ s.
