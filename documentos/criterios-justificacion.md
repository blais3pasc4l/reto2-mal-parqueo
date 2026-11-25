# Índice de criticidad: pesos, justificación y cálculos a mano (RF-02)

> Propuesta inicial que el equipo debe **validar con lo que observe en los recorridos** y ajustar si hace falta.
> Si cambian un valor de `datos/criterios.json`, actualicen también este documento y los dos ejemplos.

## 1. Cómo se calcula

```
puntaje = peso de la categoría + peso del tipo de vía + peso de la franja horaria
```

| Componente | De dónde sale | Lo escribe el usuario |
|---|---|---|
| Categoría | lo que el usuario elige en el formulario | Sí (botón) |
| Tipo de vía | se busca la `cuadra` del reporte en `datos/vias.json` (campo `tipo`) | **No** |
| Franja | se deduce de la hora de `fecha_hora` comparándola con `horas_pico` | **No** |

Luego el puntaje se convierte en nivel con los rangos de `niveles` (los extremos están incluidos).

Regla de bordes de la franja: una hora es **pico** si `inicio ≤ hora < fin`. Con `"11:30-14:00"`, las 11:30 y las 13:59 son pico; las 14:00 ya son valle.

## 2. Valores elegidos (`datos/criterios.json`)

```json
"categoria": { "doble_fila": 3, "bloqueo_rampa_cebra_paradero": 3, "invasion_anden": 2 },
"via":       { "arterial": 3, "secundaria": 1 },
"franja":    { "pico": 3, "valle": 1 },
"horas_pico": ["06:30-08:30", "11:30-14:00", "17:00-19:30"],
"niveles":   { "Bajo": [0, 4], "Medio": [5, 6], "Alto": [7, 9] }
```

### Por qué esos pesos

**Categoría**
- **Doble fila o vía prohibida = 3.** Un solo carro parado le quita un carril completo a la vía; en la Avenida del Río eso frena buses, taxis y motos detrás de él.
- **Bloqueo de rampa, cebra o paradero = 3.** Afecta sobre todo a quien no tiene otra opción: personas en silla de ruedas, adultos mayores y coches de bebé, que terminan bajando a la calzada. También obliga a los buses a recoger pasajeros en medio de la vía.
- **Invasión de andén por comercio o mercancía = 2.** Es grave porque saca al peatón a la calzada, pero casi nunca cierra un carril y muchas veces el peatón puede rodearla. Además se atiende con otro tipo de operativo (espacio público), así que no se le da el máximo.

**Tipo de vía**
- **Arterial = 3, secundaria = 1.** En una arterial (la Avenida del Río) la misma obstrucción afecta a muchas más personas por minuto que en una calle de acceso como la Carrera 22. Se usa una relación 3 a 1 para que el tipo de vía pese tanto como la categoría.
- Clasificación usada en `vias.json` (según OpenStreetMap: arterial = primary, trunk o secondary): la Avenida del Río es `secondary` → arterial; Carrera 22, Carrera 22A, Calle 29I y Calle 29H3 son `residential` → secundarias. **El equipo debe confirmarlo en el recorrido** (si en campo ven flujo alto en Carrera 22 a la hora de entrada al campus, pueden cambiar esas cuadras a `arterial`).

**Franja horaria**
- **Pico = 3, valle = 1.** En hora pico hay más carros y más peatones, así que la misma obstrucción genera más trancón y más riesgo.
- **Horas pico:** 06:30–08:30 (entrada a colegios y trabajos), 11:30–14:00 (en Santa Marta mucha gente sale a almorzar a casa y el comercio del centro tiene su mayor movimiento) y 17:00–19:30 (salida). **Validar con lo visto en los dos recorridos.**

### Por qué esos rangos

Con estos pesos solo hay 12 combinaciones posibles y el puntaje va de 4 a 9:

| Categoría | Vía | Franja | Puntaje | Nivel | Componentes en su máximo |
|---|---|---|---|---|---|
| invasión (2) | secundaria (1) | valle (1) | **4** | Bajo | 0 |
| doble fila / rampa (3) | secundaria (1) | valle (1) | **5** | Medio | 1 |
| invasión (2) | arterial (3) | valle (1) | **6** | Medio | 1 |
| invasión (2) | secundaria (1) | pico (3) | **6** | Medio | 1 |
| doble fila / rampa (3) | arterial (3) | valle (1) | **7** | Alto | 2 |
| doble fila / rampa (3) | secundaria (1) | pico (3) | **7** | Alto | 2 |
| invasión (2) | arterial (3) | pico (3) | **8** | Alto | 2 |
| doble fila / rampa (3) | arterial (3) | pico (3) | **9** | Alto | 3 |

La regla que queda es fácil de explicar:
- **Alto (7 a 9):** al menos **dos** de los tres componentes están en su valor máximo.
- **Medio (5 a 6):** exactamente **uno** está en su máximo.
- **Bajo (0 a 4):** **ninguno** está en su máximo (invasión de andén, en calle secundaria, en hora valle).

## 3. Dos casos calculados a mano (coinciden con el sistema)

Ambos casos están en las pruebas automáticas (`node pruebas/pruebas.js`, sección 1) y aparecen también en los datos de ejemplo (EJEMPLO-06 y EJEMPLO-26), así que se pueden verificar abriendo el punto en el mapa del tablero.

### Caso 1: doble fila en la Avenida del Río a mediodía

Reporte: `cuadra = "ARIO-C29C2-C29D"`, `categoria = "doble_fila"`, `fecha_hora = "2026-11-18T12:10"` (EJEMPLO-06).

1. Categoría `doble_fila` → `criterios.categoria.doble_fila` = **3**
2. Se busca `ARIO-C29C2-C29D` en `vias.json` → `"tipo": "arterial"` → `criterios.via.arterial` = **3**
3. Hora 12:10 → ¿está en algún rango de `horas_pico`? 06:30–08:30 no; 11:30–14:00 **sí** → franja `pico` → **3**
4. Puntaje = 3 + 3 + 3 = **9**
5. 9 está en `Alto: [7, 9]` → **Alto**

Resultado del sistema: **9 puntos · Alto** ✔

### Caso 2: invasión de andén en la Calle 29I a media mañana

Reporte: `cuadra = "C29I-CR22-CR21E"`, `categoria = "invasion_anden"`, `fecha_hora = "2026-11-19T10:15"` (EJEMPLO-26).

1. Categoría `invasion_anden` → **2**
2. `C29I-CR22-CR21E` en `vias.json` → `"tipo": "secundaria"` → **1**
3. Hora 10:15 → no está en 06:30–08:30, ni en 11:30–14:00, ni en 17:00–19:30 → franja `valle` → **1**
4. Puntaje = 2 + 1 + 1 = **4**
5. 4 está en `Bajo: [0, 4]` → **Bajo**

Resultado del sistema: **4 puntos · Bajo** ✔

> Cuando tengan los 30 registros reales, cambien estos dos casos por dos registros reales suyos (uno Alto y uno Bajo o Medio), hagan la cuenta a mano y comparen con el número que muestra el punto en el mapa.

## 4. Qué pasa si se cambia un peso (para la sustentación)

Ejemplo: subir `"invasion_anden": 2` a `"invasion_anden": 3` en `datos/criterios.json` y recargar la página.

- El Caso 2 pasa de 2 + 1 + 1 = 4 (Bajo) a 3 + 1 + 1 = **5 (Medio)**.
- Todos los reportes de invasión de andén suben 1 punto y su mancha en el mapa de calor se ve más intensa.
- Con los datos de ejemplo, la entrada por Carrera 22 (`CR22-C29I-C29H3`) pasa de 27 a 31 puntos acumulados y, como tres de sus reportes de hora pico suben de Medio (6) a Alto (7), ahora tiene 3 reportes Altos en hora pico: el resumen le agrega la recomendación **«Patrullaje prioritario en hora pico» (regla R1)**, además de «Operativo de espacio público» (R2).
- El puntaje máximo sigue siendo 9, porque el máximo de la categoría ya era 3.

Otro ejemplo: cambiar `"pico": 3` por `"pico": 5`. Ahora el máximo es 3 + 3 + 5 = 11, que queda por encima del rango `Alto: [7, 9]`. El código lo trata como Alto (nivel más alto), pero lo correcto es **ajustar también los rangos** (por ejemplo `"Alto": [7, 11]`).

Ver más ejemplos en `guia-sustentacion.md`.
