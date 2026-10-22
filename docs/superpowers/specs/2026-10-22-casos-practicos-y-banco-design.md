# Diseño: banco oficial 2026, casos prácticos y simulacro de examen

Fecha: 2026-10-22. Estado: aprobado implícitamente por el propietario ("haz un plan y aplícala"); las decisiones marcadas **(decisión del implementador)** son elecciones propias que el propietario puede revisar.

## Intención

La app entrena para el examen de competencia profesional de transporte de **mercancías** por carretera. Hoy solo cubre la primera prueba (preguntas test) con un banco desactualizado. Queremos:

1. Regenerar el banco de preguntas desde la publicación oficial vigente (26-03-2026) y poder repetirlo en cada revisión del Ministerio con un comando.
2. Añadir la segunda prueba, los **casos prácticos** (660 casos, 8 alternativas cada uno).
3. Aprovechar el contexto del examen real para que la práctica se parezca a él: baremo oficial, cronómetro de 2 horas, posibilidad de dejar preguntas en blanco, y repaso de fallos acumulados.

## Objetivos

- Un script reproducible convierte los ZIP oficiales (`pm_*.zip`, `cm_*.zip`) en los JSON de la app.
- Los casos prácticos se pueden practicar con la misma mecánica que las preguntas (configuración por temas, modo examen, navegación, resumen, historial, repetir fallos).
- El resumen muestra la **puntuación oficial** (BOE, RD 1211/1990 Anexo II apdo. 8): test 1 punto por acierto y −1/3 por fallo sobre 200; casos 50 puntos por acierto y −50/3 por fallo sobre 200; aprobado de la parte con ≥ 50 %.
- Simulacro con cronómetro de 2 h que cierra el test al expirar.
- Se pueden dejar preguntas en blanco al finalizar (como en el examen real), previa advertencia.
- Los fallos se acumulan entre sesiones y se pueden repasar.
- La app funciona sin conexión una vez cargada (service worker), pensando en el uso en móvil que ya sugiere el `manifest.json`.

## No objetivos

- Variante viajeros.
- Backend, cuentas de usuario o sincronización entre dispositivos.
- Descargar automáticamente desde la app: la actualización del banco es una tarea de mantenimiento con el script.
- Reproducir la regla del 60 % conjunto del examen: requiere combinar dos pruebas distintas; el resumen la menciona como texto, nada más.
- Tests automatizados de UI. La UI se verifica manualmente en navegador; las piezas puras (parser, puntuación) sí llevan tests.

## Anti-objetivos (fallos aunque "funcione")

- Que una pregunta del banco muestre una solución distinta a la oficial vigente.
- Que un caso práctico pierda párrafos del enunciado o sub-respuestas de una alternativa.
- Que el cronómetro se reinicie al reanudar una sesión guardada.
- Que un código de pregunta y uno de caso se confundan en fallos o historial (comparten códigos: 650 de 660 casos repiten un código de pregunta).

## Restricciones

- Sin framework, sin bundler, sin dependencias de npm. JS vanilla con el patrón actual (`window.App.<ns>` por archivo, orden de `<script>` fijo).
- Python 3 estándar para el script de importación (sin pip).
- Textos de UI en castellano.
- El servidor del Ministerio rechaza peticiones sin User-Agent de navegador.

## Decisiones

### Datos

- Carpeta `data/` con tres archivos generados: `preguntas.json`, `casos.json`, `meta.json`. El antiguo `questions.json` desaparece **(decisión del implementador)**.
- `preguntas.json`: mismo esquema que hoy (`topic, code, question, options[{key,text}], answer, norma`).
- `casos.json`: `topic, code, scenario[]` (párrafos del enunciado, en orden), `options[{key, items[]}]` (las 8 alternativas A–H; `items` son las líneas de la alternativa con el prefijo `X)` eliminado: 3, 2 o 1 elementos), `answer` (letra), `norma`, `referencia` (string o `null`).
- `meta.json`: `{ "updated": "2026-03-26", "preguntas": 4475, "casos": 660, "sources": { "pm": url, "cm": url } }`. La fecha se deduce del nombre del ZIP (`pm_260326.zip`).
- Parser del TXT: registros separados por líneas `COD:` (no por líneas en blanco, porque los enunciados de casos las contienen). Una línea que no empieza por etiqueta se concatena al campo anterior (caso real: `1F03040`, opción B partida en dos líneas). Códigos duplicados dentro de casos: se conserva el primero y se avisa por stderr.
- Clave única de un ítem en almacenamiento local: `"<kind>:<code>"` con `kind` ∈ `{test, caso}`.

### Script de importación

`python3 scripts/import_bank.py --pm <zip|url> --cm <zip|url> [--out data]`. Acepta rutas locales o URLs (descarga con User-Agent de navegador). Reescribe los tres JSON completos. Tests en `scripts/test_import_bank.py` (unittest, sin dependencias) sobre fixtures inline.

### App

- Estado: `App.state.kind` (`"test"`|`"caso"`) del conjunto activo, `App.state.CASOS` (cargado bajo demanda la primera vez que se necesite), `App.state.timeLimitMs` (`null` o 7 200 000), `App.state.source` (`"all"`|`"fallos"`).
- Pantalla de configuración: selector **Tipo** (Preguntas / Casos prácticos), **Fuente** (Todo el banco / Solo mis fallos), Modo (temas / examen completo), número, temas (se rellenan según el tipo), **Modo examen**, **Cronómetro oficial (2 h)**. En tipo caso, "examen completo" son 4 casos y el número por defecto es 4.
- Panel de inicio: tarjetas Nuevo Test, Casos Prácticos, Simulacro (200 preguntas, modo examen, cronómetro), Examen Rápido (**20** preguntas, modo examen; hoy hace 200 por error), Repasar fallos (visible si hay fallos; abre configuración con Fuente = fallos), Reanudar (si hay sesión), Historial. Pie con la fecha del banco oficial y los recuentos.
- Pantalla de pregunta: para un caso, el enunciado se pinta como párrafos y cada alternativa como una tarjeta con sus sub-respuestas etiquetadas a), b), c). El resto (navegación, rejilla, feedback con norma y referencia doctrinal) es común.
- Cronómetro: cuenta atrás en la barra inferior calculada desde `startTime`, así sobrevive a reanudar. Al llegar a cero finaliza forzosamente. Al reanudar una sesión ya expirada, se finaliza directamente.
- Finalizar con blancos: el primer clic avisa cuántas faltan y ofrece un botón "Finalizar con preguntas en blanco"; las no contestadas puntúan 0.
- Resumen: aciertos, fallos, blancos, tiempo, **puntuación oficial** (`puntos / máximo`, porcentaje, Aprobado/Suspenso de la parte con nota al pie del 60 % conjunto) y desglose por tema. Repetir fallos sigue igual.
- Historial: cada entrada guarda `kind`, `points`, `max` además de lo actual; la tabla muestra tipo y puntuación.
- Fallos acumulados: `test_cap_fallos` = `{ "<kind>:<code>": { count, last } }`. Al finalizar, los fallados suben el contador y los acertados se borran de la lista.
- Service worker `sw.js` con estrategia red-primero y caché de respaldo para todo (app y datos). Así en desarrollo siempre se ve la versión fresca y en el móvil funciona sin red.
- Las sesiones guardadas por la versión anterior (sin `kind`) se tratan como `kind = "test"`.

## Lo que queda al implementador

- Estilos concretos de las nuevas tarjetas, del cronómetro y de las alternativas de casos, respetando las variables CSS existentes.
- Nombres de IDs nuevos del DOM y organización interna de funciones, siguiendo el patrón `App.<ns>`.
- Si en modo práctica (no examen) se muestra la corrección de un caso igual que la de una pregunta: sí, con la norma y la referencia doctrinal.
