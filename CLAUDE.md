# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Single-page quiz app ("Test Capacitació") for the Spanish road-haulage professional-competence exam. Vanilla HTML/CSS/JS, no framework, no build step, no npm dependencies. The only tooling is Python 3 (stdlib) for the data import script and Node for unit tests of pure modules. UI strings are in Spanish; keep new UI text in Spanish.

## Domain: Spanish road-haulage "competencia profesional" exam

The app trains for the certificate of professional competence for road transport issued under RD 1211/1990 (Ministerio de Transportes). Scope is the **mercancías** (goods) variant only, not viajeros. Official page: https://www.transportes.gob.es/transporte-terrestre/examenes-y-formacion/competencia-profesional

The real exam has two parts, 2 hours each (RD 1211/1990, Anexo II, apdos. 7–8):
1. **Preguntas**: 200 multiple-choice questions, 4 options. Scoring: +1 correct, −1/3 wrong, 0 blank, max 200.
2. **Casos prácticos**: 4 practical cases, each a long scenario with 8 alternative answer bundles (A–H); each bundle holds one answer per sub-question (1–3). Scoring: +50 correct, −50/3 wrong, max 200.
Each part passes at 50 % of its max; the exam also requires 60 % of the combined total. The app models each part separately and only mentions the 60 % rule as text.

### Official sources and import

The ministry publishes both banks per topic as HTML and as ZIPs of plain-text files. The site refuses generic User-Agents. ZIP names carry the publication date (`pm_260326.zip` = 2026-03-26) and change on every revision; the current links are on the "Preguntas mercancías" / "Casos prácticos mercancías" pages, with change-log PDFs on the main page.

```bash
python3 scripts/import_bank.py --pm <pm_*.zip or URL> --cm <cm_*.zip or URL> [--out data]
```

Regenerates `data/preguntas.json`, `data/casos.json`, `data/meta.json` from scratch (never patch them by hand). Parser rules worth knowing: records split on `^COD:` lines (case scenarios contain blank lines, so blank-line splitting breaks); a line without a label continues the previous field (real case: `1F03040`); `SOLUCION: RESPUESTA B` → `"B"`; duplicated case codes keep the first record and warn (the 2026-03 ZIP has `1A02074` twice, identical). Topic names come from the file letter (`pm1A.txt` → `A. Elementos de Derecho civil`).

Question codes are **not unique across banks**: 650 of 659 cases share a code with a question. Anything keyed by code must namespace by kind via `App.scoring.itemKey(kind, code)` → `"test:1A02044"` / `"caso:1A02001"`.

## Commands

```bash
python3 -m http.server 8000                   # serve (fetch() fails on file:// in Chromium)
python3 -I -m unittest discover -s scripts    # import-script tests (scripts/test_import_bank.py)
node --test                                   # tests/*.test.js (bare command; Node 25 rejects a dir arg)
```

There are no UI tests in the repo. Verify UI changes in a browser; the question/case flows, timer, summary and fallos are all exercised from the home dashboard.

## Architecture

### Script load order and the `App` namespace

Every file in `js/` is an IIFE attaching one namespace to `window.App`; cross-file calls resolve at call time through `App.<ns>.<fn>`. `index.html` loads them in this order, which must be preserved (later files capture `App.dom.byId` at load time):

```
app.state.js   → App.state    single mutable state object
app.utils.js   → App.utils    shuffle/sample, duration, localStorage wrapper (prefix test_cap_)
app.dom.js     → App.dom      byId, setHidden, show
app.scoring.js → App.scoring  PURE: score(kind, answers), topicBreakdown(items, answers), itemKey, TIME_LIMIT_MS
                              (also module.exports for Node; keep it DOM-free)
app.render.js  → App.render   renderQuestion, renderTimer, renderSummary, renderHistoryTable, renderBankMeta, nav grid
app.actions.js → App.actions  test lifecycle, setup/dashboard navigation, timer, persistence, fallos
app.events.js  → App.events   bindEvents: one-time listeners for static buttons
app.init.js    → registers sw.js, bindEvents, loads data/preguntas.json + data/meta.json, initDashboard
```

`data/casos.json` (~2 MB) is loaded lazily by `App.actions.ensureCasosLoaded()` the first time the casos setup or a casos test is opened. `App.actions.bankFor(kind)` returns the right array.

### Items: questions vs cases

A test's `App.state.currentSet` holds either questions or cases; `App.state.kind` (`"test"` | `"caso"`) says which. Renderers detect a case by `Array.isArray(item.scenario)`.

```json
// data/preguntas.json entry
{ "topic": "A. Elementos de Derecho civil", "code": "1A01001", "question": "...",
  "options": [{"key": "A", "text": "..."}, ...4], "answer": "B", "norma": "RD 1211/1990, art. 6" }
// data/casos.json entry
{ "topic": "...", "code": "1A02001", "scenario": ["párrafo", ...],
  "options": [{"key": "A", "items": ["resp. a)", "resp. b)", "resp. c)"]}, ...8],
  "answer": "B", "norma": "...", "referencia": "..." | null }
```

`answer` is an option key compared by string equality. `norma` doubles as hint and post-answer explanation; `referencia` (doctrinal reference, rare) is appended to the feedback. Text is injected with `innerHTML`, so the bank is trusted content.

### Screens

All screens are `<div>`s in `index.html` toggled with the `hidden` class (`screen-home`, `screen-setup`, `screen-history`, `screen-question`, `screen-summary`). Two toggling paths coexist: `App.dom.show(id)` hides only setup/question/summary, while `initDashboard`, `goToSetup`, `goToHistory` toggle screens individually with `setHidden`. A new screen must be handled in both. The generic rule is `.hidden:not(.bottom-nav) { display:none !important }`; the bottom nav hides by sliding instead.

Setup form controls carry `autocomplete="off"` on purpose: Chromium restores select state across reloads otherwise, which desynchronises the form from the app's defaults.

### Entry points and test configuration

Every way of starting a test goes through `App.actions.startTest(opts)`, which reads the setup form and lets `opts` override it: `{kind, source ("all"|"fallos"), mode ("themes"|"all"), n, topics (array | null = all), examMode, timer}`. Dashboard cards are presets: Nuevo Test → setup `{kind:"test", source:"all"}`; Casos Prácticos → setup `{kind:"caso", source:"all", n:4}`; Repasar fallos → setup `{source:"fallos"}`; Examen Rápido → `startTest` with 20 questions, exam mode, no timer; Simulacro → 200 questions, exam mode, 2 h timer. `mode:"all"` means 200 questions or 4 cases.

`goToSetup(preset)` applies synchronous defaults (labels, `n`) before awaiting the casos load so user input is never overwritten; `startBtn` is disabled while casos load. Keep that ordering if you touch it.

### Test state, timer, finishing

`answers[i]` / `results[i]` are parallel arrays indexed by position (`null` = blank). `userSelected` is the transient radio choice; it is cleared on next/skip/jump (a stale value used to be submitted on a fresh question).

`isExamMode` defers feedback and hides the hint. `timeLimitMs` (`null` or 7 200 000) drives a countdown computed from `startTime` on every tick, so it survives resume; `startTimer()` is called from `renderQuestion`, `stopTimer()` from `renderSummary`/`initDashboard`/`finishTest`. Expiry calls `finishTest(true)`; `loadSession` on an already-expired session finishes immediately.

`finishTest(force)`: with blanks and `force !== true` it shows a warning plus a "Finalizar con ... en blanco" button; the strict `=== true` check exists because DOM handlers pass an `event`. Always call it as `() => finishTest()` from listeners. On finish: `updateFallos`, `addToHistory`, `renderSummary`.

### Rendering

`App.render.renderQuestion()` is the single re-render point for the question screen and rebuilds options, main button, progress bar, inline feedback, bottom nav and timer from state. Dynamic elements get handlers via `el.onclick = ...` (assignment, not `addEventListener`) so re-renders don't stack listeners; follow that pattern. Case alternatives render as `.opt.caso` with an `<ol class="opt-items">` (lower-alpha) when they have more than one item.

### Persistence (`localStorage`, prefix `test_cap_`)

- `session`: in-progress test `{currentSet, idx, answers, results, startTime, isExamMode, kind, source, timeLimitMs}`; saved on every answer/navigation, removed on finish; drives the "Reanudar" card. Old sessions without `kind` load as test / no timer.
- `history`: last 50 finished tests `{date, duration, kind, total, correct, wrong, skipped, points, max, pct}`; old entries without `kind`/`points` render as "Test" with no points.
- `fallos`: `{ "<kind>:<code>": {count, last} }`; a wrong answer increments, a correct one deletes the key. Feeds `source:"fallos"` and the dashboard counter.

### Offline

`sw.js` is a network-first, cache-fallback service worker for same-origin GETs (cache `tc-v1`). There is no precache or manual versioning: online always gets fresh files, offline gets the last copy. If you change caching strategy, remember the first page load is not yet controlled by the worker.
