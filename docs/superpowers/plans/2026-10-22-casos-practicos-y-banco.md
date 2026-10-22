# Plan de implementación: banco oficial 2026, casos prácticos y simulacro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regenerar el banco de preguntas desde los ZIP oficiales, añadir los casos prácticos como segundo tipo de ítem, y acercar la práctica al examen real (baremo oficial, cronómetro, blancos, fallos acumulados, uso offline).

**Architecture:** Un script Python convierte los TXT oficiales en `data/*.json`. La app sigue el patrón `window.App.<ns>` con scripts en orden fijo; se añade un módulo puro `app.scoring.js` (testeable con Node) y se generaliza `renderQuestion` para ítems de tipo caso. El estado y la sesión guardada ganan `kind`, `source` y `timeLimitMs`.

**Tech Stack:** HTML/CSS/JS vanilla, Python 3.13 (stdlib), Node 25 solo para `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-22-casos-practicos-y-banco-design.md`

## Global Constraints

- Sin dependencias npm ni pip. Nada de bundlers.
- Cada archivo JS es una IIFE que cuelga un namespace de `window.App`; el orden de `<script>` en `index.html` es: state, utils, dom, scoring, render, actions, events, init.
- Textos de UI en castellano.
- Clave de ítem en `localStorage`: `"<kind>:<code>"`, `kind` ∈ `{test, caso}`.
- Baremo: test `+1 / −1/3` por ítem, máximo `n`; caso `+50 / −50/3`, máximo `50·n`; blanco `0`; aprobado de la parte si `pct ≥ 50`.
- Cronómetro oficial: `7200000` ms, calculado desde `App.state.startTime`.
- Peticiones al Ministerio con `User-Agent` de navegador.

## Review Focus

1. Enunciado de caso con líneas en blanco intermedias: el registro no debe cortarse (test en Task 1).
2. Opción partida en dos líneas (`1F03040`): el texto de la opción debe quedar completo (test en Task 1).
3. Código duplicado dentro de `cm`: se conserva el primero, se avisa (test en Task 1).
4. Sesión guardada por la versión antigua sin `kind`/`timeLimitMs`: debe reanudarse como test sin cronómetro (verificación manual en Task 9).
5. Resumen con todo en blanco: puntuación `0`, sin división por cero en el desglose (test en Task 2).

---

### Task 1: Script de importación y banco regenerado

**Files:**
- Create: `scripts/import_bank.py`
- Create: `scripts/test_import_bank.py`
- Create: `data/preguntas.json`, `data/casos.json`, `data/meta.json` (generados)
- Delete: `questions.json`
- Modify: `js/app.init.js` (ruta de carga)

**Interfaces:**
- Produces: `parse_preguntas(text: str, topic: str) -> list[dict]`, `parse_casos(text: str, topic: str) -> list[dict]`, `TOPICS: dict[str, str]` (letra → nombre oficial), `date_from_zip_name(name: str) -> str` (`"pm_260326.zip"` → `"2026-03-26"`), `main(argv) -> int`.
- Esquemas JSON como en la spec (sección Datos).

- [ ] **Step 1: Tests que fallan**

```python
class ParsePreguntas(unittest.TestCase):
    def test_basic_record(self):
        qs = parse_preguntas(PM_SAMPLE, "A. Elementos de Derecho civil")
        self.assertEqual(qs[0]["code"], "1A01001")
        self.assertEqual([o["key"] for o in qs[0]["options"]], ["A","B","C","D"])
        self.assertEqual(qs[0]["answer"], "B")
        self.assertEqual(qs[0]["norma"], "RD 1211/1990, art. 6")
    def test_continuation_line_joins_previous_field(self):
        # PM_SPLIT contiene "B: \nSi, si se trata de pruebas o ensayos de investigación."
        q = parse_preguntas(PM_SPLIT, "F. Acceso a los mercados")[0]
        self.assertEqual(q["options"][1]["text"], "Si, si se trata de pruebas o ensayos de investigación.")

class ParseCasos(unittest.TestCase):
    def test_scenario_keeps_paragraphs_across_blank_lines(self):
        c = parse_casos(CM_SAMPLE, "A. Elementos de Derecho civil")[0]
        self.assertEqual(len(c["scenario"]), 5)       # CM_SAMPLE tiene 5 párrafos
        self.assertEqual(c["answer"], "B")
        self.assertEqual(len(c["options"]), 8)
        self.assertEqual(c["options"][0]["items"][0], "No, el transportista debe responder frente al cargador del contrato de la adecuación de los medios materiales aportados.")
        self.assertEqual(len(c["options"][0]["items"]), 3)
        self.assertIsNone(c["referencia"])
    def test_single_line_alternative_and_referencia(self):
        c = parse_casos(CM_SINGLE, "B. Elementos de Derecho mercantil")[0]
        self.assertEqual(c["options"][4]["items"], ["15.333,33 euros a cada uno de los tres socios."])
        self.assertEqual(c["referencia"], "Código de buenas prácticas, IRU")
    def test_duplicate_code_keeps_first(self):
        cs = parse_casos(CM_SAMPLE + "\n" + CM_SAMPLE, "A. Elementos de Derecho civil")
        self.assertEqual(len(cs), 1)

class Misc(unittest.TestCase):
    def test_date_from_zip_name(self):
        self.assertEqual(date_from_zip_name("pm_260326.zip"), "2026-03-26")
```

- [ ] **Step 2: Ejecutar y ver que falla**

Run: `python3 -I -m unittest scripts.test_import_bank -v`
Expected: `ImportError` / `ModuleNotFoundError` for `import_bank`.

- [ ] **Step 3: Implementar `scripts/import_bank.py`**

Reglas: dividir por `(?m)^(?=COD:)`; etiquetas PM `COD|PREGUNTA|A|B|C|D|SOLUCION|NORMA`; etiquetas CM `COD|PREGUNTA|RESPUESTA [A-H]|SOLUCION|NORMA|REFERENCIA DOCTRINAL`; línea sin etiqueta → en PM se concatena con espacio al último campo; en CM dentro de `PREGUNTA` cada línea no vacía es un párrafo, dentro de `RESPUESTA X` cada línea no vacía es un item con `^[A-Z]\)\s*` eliminado. `SOLUCION: RESPUESTA B` → `"B"`. Nombre de topic por letra del archivo (`pm1A.txt` → `A`), tabla `TOPICS`. `main` acepta `--pm`, `--cm` (ruta o URL, descarga con `urllib.request` y UA de navegador a un `tempfile`), `--out` (default `data`); escribe JSON con `ensure_ascii=False, indent=1`.

- [ ] **Step 4: Tests en verde**

Run: `python3 -I -m unittest scripts.test_import_bank -v`
Expected: `OK`.

- [ ] **Step 5: Generar el banco real y reconectar la app**

Run: `python3 -I scripts/import_bank.py --pm <scratch>/dl/pm/pm_260326.zip --cm <scratch>/dl/cm/cm_260326.zip --out data`
Expected: stdout con `preguntas: 4475  casos: 660` y un aviso de código duplicado en stderr.
Then: `git rm questions.json`; en `js/app.init.js` cambiar la URL a `data/preguntas.json`; el mensaje de error pasa a nombrar `data/preguntas.json`.
Verify: `python3 -I -c "import json;print(len(json.load(open('data/preguntas.json'))),len(json.load(open('data/casos.json'))))"` → `4475 660`.

- [ ] **Step 6: Commit**

```bash
git add scripts data js/app.init.js .gitignore CLAUDE.md docs
git rm -q --cached questions.json 2>/dev/null; git commit -m "feat: import official 2026-03 bank and practical cases via script"
```

### Task 2: Módulo de puntuación oficial

**Files:**
- Create: `js/app.scoring.js`
- Create: `tests/scoring.test.js`
- Modify: `index.html` (añadir `<script src="js/app.scoring.js">` tras `app.dom.js`)

**Interfaces:**
- Produces: `App.scoring.score(kind, answers) -> {correct, wrong, blank, points, max, pct, passed}` con `answers` como en `App.state.answers` (`null | {selected, correct}`); `App.scoring.topicBreakdown(items, answers) -> [{topic, total, correct, wrong, blank}]` ordenado por `topic`; `App.scoring.itemKey(kind, code) -> string`; `App.scoring.TIME_LIMIT_MS = 7200000`.
- El archivo exporta también con `module.exports` cuando `module` existe, para Node.

- [ ] **Step 1: Test que falla**

```js
const test = require('node:test'); const assert = require('node:assert/strict');
const scoring = require('../js/app.scoring.js');
test('test scoring: +1, -1/3, blank 0', () => {
  const r = scoring.score('test', [{selected:'A',correct:true},{selected:'B',correct:false},null]);
  assert.equal(r.points.toFixed(4), (1 - 1/3).toFixed(4)); assert.equal(r.max, 3); assert.equal(r.blank, 1);
});
test('caso scoring: +50, -50/3, pass at 50%', () => {
  const r = scoring.score('caso', [{correct:true},{correct:true},{correct:false},null]);
  assert.equal(r.max, 200); assert.equal(r.points.toFixed(2), (100 - 50/3).toFixed(2)); assert.equal(r.passed, false);
});
test('all blank gives zero and no NaN', () => {
  const r = scoring.score('test', [null, null]); assert.equal(r.points, 0); assert.equal(r.pct, 0); assert.equal(r.passed, false);
  const b = scoring.topicBreakdown([{topic:'A'},{topic:'A'}], [null,null]); assert.deepEqual(b, [{topic:'A', total:2, correct:0, wrong:0, blank:2}]);
});
test('points never below zero', () => { assert.equal(scoring.score('test', [{correct:false}]).points, 0); });
test('itemKey namespaces by kind', () => { assert.equal(scoring.itemKey('caso','1A02001'), 'caso:1A02001'); });
```

- [ ] **Step 2: Run** `node --test tests/` → FAIL (cannot find module).
- [ ] **Step 3: Implementar `js/app.scoring.js`** con la forma `(function (root) { ...; if (typeof module !== "undefined") module.exports = scoring; root.App = root.App || {}; root.App.scoring = scoring; })(typeof window !== "undefined" ? window : globalThis);`. `pct` redondeado a 1 decimal; `points` acotado a `≥ 0`.
- [ ] **Step 4: Run** `node --test tests/` → todos PASS.
- [ ] **Step 5: Commit** `git add js/app.scoring.js tests index.html && git commit -m "feat: official exam scoring module"`.

### Task 3: Estado, carga de datos y pie de inicio

**Files:**
- Modify: `js/app.state.js`, `js/app.init.js`, `js/app.actions.js`, `index.html`

**Interfaces:**
- Produces: `App.state.kind = "test"`, `App.state.source = "all"`, `App.state.timeLimitMs = null`, `App.state.CASOS = []`, `App.state.META = null`; `App.actions.ensureCasosLoaded() -> Promise<void>` (fetch `data/casos.json` una sola vez); `App.actions.bankFor(kind) -> array` (BANK o CASOS).
- `index.html`: `<p id="bankMeta" class="muted">` al pie de `screen-home`.

- [ ] **Step 1:** Añadir campos al estado. En `init`, cargar en paralelo `data/preguntas.json` y `data/meta.json` (`Promise.all`); si `meta` carga, `bankMeta.textContent = "Banco oficial del DD/MM/AAAA · N preguntas · M casos"` con la fecha formateada a partir de `meta.updated`.
- [ ] **Step 2:** Implementar `ensureCasosLoaded` y `bankFor`.
- [ ] **Step 3: Verificar** sirviendo con `python3 -m http.server 8000` y abriendo la home: el pie muestra `Banco oficial del 26/03/2026 · 4475 preguntas · 660 casos`; consola sin errores.
- [ ] **Step 4: Commit** `git commit -am "feat: load bank metadata and lazy practical cases"`.

### Task 4: Configuración por tipo/fuente y nuevas tarjetas de inicio

**Files:**
- Modify: `index.html` (setup + dashboard), `js/app.actions.js`, `js/app.events.js`, `style.css`

**Interfaces:**
- DOM nuevo: `#bankKind` (select `test|caso`), `#source` (select `all|fallos`), `#timerMode` (checkbox), tarjetas `#btnDashCasos`, `#btnDashSimulacro`, `#btnDashFallos` (con `<span id="fallosCount">`).
- Produces: `App.actions.startTest(opts?)` donde `opts = {kind, mode, n, topics, examMode, timer, source}` sobrescribe lo leído del formulario; `App.actions.getFallosCodes(kind) -> string[]` (lee `test_cap_fallos`); `App.actions.fillTopicsSelect(kind)`; `App.actions.goToSetup(preset?)` con `preset = {kind?, source?, n?}`.

- [ ] **Step 1:** HTML del setup: Tipo, Fuente, Modo (opciones renombradas: `themes` = "Por temas", `all` = "Examen completo (200 preguntas / 4 casos)"), N, Temas, Modo examen, Cronómetro oficial. Tarjetas nuevas en el dashboard; `btnDashFallos` oculto por defecto.
- [ ] **Step 2:** `startTest` async: `kind` → `await ensureCasosLoaded()` si `caso`; pool = `bankFor(kind)` filtrado por `source === "fallos"` (códigos en fallos) y por temas si `mode === "themes"`; tamaño `all` = 200 para test, 4 para caso; `App.state.kind/source/timeLimitMs` fijados; `isExamMode` del formulario u `opts`. Mensaje en `setupMsg` si el pool queda vacío ("No hay casos/preguntas con esos filtros.").
- [ ] **Step 3:** `startQuickExam` → `startTest({kind:"test", mode:"themes", n:20, topics: todos, examMode:true, timer:false, source:"all"})`. `btnDashSimulacro` → `startTest({kind:"test", mode:"all", examMode:true, timer:true, source:"all"})`. `btnDashCasos` → `goToSetup({kind:"caso", n:4})`. `btnDashFallos` → `goToSetup({source:"fallos"})`. Cambio de `#bankKind` → `fillTopicsSelect(kind)` y `n` por defecto (20 / 4). `initDashboard` actualiza `fallosCount` y oculta la tarjeta si no hay fallos.
- [ ] **Step 4:** `saveCurrentState`/`loadSession` incluyen `kind`, `source`, `timeLimitMs` (al cargar: `kind || "test"`, `timeLimitMs ?? null`).
- [ ] **Step 5: Verificar** en navegador: Examen Rápido arranca con indicador `Pregunta 1 / 20`; Casos Prácticos abre configuración con tipo caso y temas de casos; Simulacro arranca `1 / 200`.
- [ ] **Step 6: Commit** `git commit -am "feat: setup by item kind and source, simulacro and quick exam fix"`.

### Task 5: Render de casos prácticos

**Files:**
- Modify: `js/app.render.js`, `style.css`, `js/app.events.js` (pista)

**Interfaces:**
- Un ítem es caso si `Array.isArray(item.scenario)`. `renderQuestion` usa `item.scenario`/`item.options[].items` en ese caso.
- CSS: `.scenario p`, `.opt.caso`, `.opt-items`, `.opt-items li`.

- [ ] **Step 1:** En `renderQuestion`: título `Caso N — topic` o `Pregunta N — topic`; `qText` = párrafos `<p>` para casos; cada opción: `<b>A</b>` + lista `<ol class="opt-items">` con `items` (si `items.length === 1`, texto plano). Letras a), b), c) vía CSS `list-style: lower-alpha`.
- [ ] **Step 2:** `renderInlineFeedback`: añadir línea `Referencia doctrinal: …` cuando `q.referencia`. Pista (`hintBtn`): mismo `norma`.
- [ ] **Step 3:** Estilos: alternativas de caso en columna, radio alineado arriba, párrafos con `margin: 0 0 10px`.
- [ ] **Step 4: Verificar** en navegador con un test de 2 casos en modo práctica: enunciado con párrafos, 8 alternativas con sub-respuestas, corrección con norma y referencia; en modo examen sin colores hasta finalizar.
- [ ] **Step 5: Commit** `git commit -am "feat: render practical cases"`.

### Task 6: Cronómetro y finalizar con blancos

**Files:**
- Modify: `js/app.actions.js`, `js/app.render.js`, `index.html` (`<div id="navTimer">` dentro de `.nav-center`), `style.css`

**Interfaces:**
- Produces: `App.actions.finishTest(force = false)`; `App.actions.startTimer()`, `App.actions.stopTimer()`; `App.render.renderTimer(remainingMs)`.

- [ ] **Step 1:** `finishTest(force)`: si quedan blancos y `!force` → `qMsg` con texto `Faltan N sin responder.` y botón `<button id="finishAnywayBtn" class="danger">Finalizar con preguntas en blanco</button>` cuyo click llama `finishTest(true)`. El resto como hoy. `finishBtn`/`finishGridBtn`/botón principal llaman `finishTest()` sin argumentos (ojo: no pasar el `event` como `force`).
- [ ] **Step 2:** Timer: `startTimer` crea un `setInterval` de 1 s si `timeLimitMs`; calcula `remaining = startTime + timeLimitMs - Date.now()`; `renderTimer` pinta `H:MM:SS`; a `≤ 0` → `stopTimer()` y `finishTest(true)`. `renderQuestion` llama `startTimer()`; `renderSummary` e `initDashboard` llaman `stopTimer()`. `loadSession` con sesión expirada → `finishTest(true)` directamente.
- [ ] **Step 3:** Estilo: `#navTimer` pequeño bajo el indicador; clase `warn` cuando quedan < 5 min.
- [ ] **Step 4: Verificar** en navegador: Simulacro muestra `1:59:5x` y baja; finalizar con blancos muestra aviso y segundo botón; tras recargar y Reanudar el contador continúa (no se reinicia).
- [ ] **Step 5: Commit** `git commit -am "feat: official 2h timer and finishing with blanks"`.

### Task 7: Resumen con baremo, desglose por tema, historial y fallos acumulados

**Files:**
- Modify: `js/app.render.js`, `js/app.actions.js`, `index.html` (`screen-summary`), `style.css`

**Interfaces:**
- DOM: `#sumBlank`, `#sumScore`, `#sumVerdict`, `#sumTopics` (tabla), tabla de historial con columnas Fecha, Tipo, Nota, Puntos.
- Produces: `App.actions.updateFallos(kind, results)`; entradas de historial `{date, duration, kind, total, correct, wrong, skipped, points, max, pct}`.

- [ ] **Step 1:** `renderSummary`: usa `App.scoring.score(kind, answers)`; `sumScore` = `Puntuación oficial: 142,3 / 200 (71,2 %)` con `toLocaleString("es-ES")`; `sumVerdict` = `Parte superada (≥ 50 %)` / `Parte no superada`; nota al pie fija: `El examen exige además el 60 % del total sumando las dos pruebas.`; `sumTopics` tabla con `topicBreakdown`.
- [ ] **Step 2:** `addToHistory` guarda los campos nuevos; `renderHistoryTable` muestra Tipo (`Test`/`Casos`) y Puntos (`points/max`); entradas antiguas sin `kind` se muestran como `Test` y sin puntos.
- [ ] **Step 3:** `updateFallos(kind, results)`: para cada resultado no nulo, clave `itemKey(kind, code)`; fallo → `count+1, last = ISO`; acierto → borrar clave. Llamado desde `finishTest` antes de `renderSummary`. `reviewWrongQuestions` conserva `kind`.
- [ ] **Step 4: Verificar** en navegador: terminar un test de 5 con 3 aciertos, 1 fallo, 1 blanco → `2,7 / 5 (53,3 %)`, parte superada, desglose por tema con 1 fila por tema; la home muestra `Repasar fallos (1)`; repasar fallos y acertarla la elimina.
- [ ] **Step 5: Commit** `git commit -am "feat: official score summary, topic breakdown, cumulative mistakes"`.

### Task 8: Service worker, README y CLAUDE.md

**Files:**
- Create: `sw.js`
- Modify: `js/app.init.js` (registro), `README.md`, `CLAUDE.md`

- [ ] **Step 1:** `sw.js`: `install` → `skipWaiting`; `activate` → `clients.claim`; `fetch` (solo `GET` mismo origen) → `fetch(req)` y clona a caché `tc-v1`; en fallo → `caches.match(req)`. Registro en `init` si `"serviceWorker" in navigator`, dentro de `try/catch`.
- [ ] **Step 2:** README: descripción breve en castellano de los modos, el baremo, cómo servir en local y cómo actualizar el banco (`scripts/import_bank.py` con las URLs oficiales). CLAUDE.md: carpeta `data/`, nuevo módulo `app.scoring.js`, orden de scripts, comandos de test (`python3 -I -m unittest scripts.test_import_bank`, `node --test tests/`), sección de frescura actualizada (banco al día a 2026-03-26), claves de `localStorage` (`session`, `history`, `fallos`), campos nuevos de sesión.
- [ ] **Step 3: Verificar** que el SW se registra (consola sin errores; en Application > Service Workers aparece activo) y que la app carga sin red tras una primera carga.
- [ ] **Step 4: Commit** `git commit -am "feat: offline service worker; docs for new data pipeline"`.

### Task 9: Verificación final en navegador

- [ ] Servir `python3 -m http.server 8000` y recorrer: home → Nuevo Test (temas, 5 preguntas, práctica) → resumen; Casos Prácticos (2 casos, examen) → finalizar con un blanco → resumen; Simulacro arranca con cronómetro; Reanudar tras recarga mantiene el cronómetro; Historial muestra tipo y puntos; sesión antigua simulada (`localStorage.setItem("test_cap_session", JSON.stringify({currentSet:[...2 preguntas], idx:0, answers:[null,null], results:[null,null], startTime:Date.now()}))`) se reanuda como test sin cronómetro.
- [ ] `node --test tests/` y `python3 -I -m unittest scripts.test_import_bank` en verde.
- [ ] Informar al propietario: rama, commits, cómo fusionar.
