# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Single-page multiple-choice quiz app ("Test Capacitació") for exam practice. Vanilla HTML/CSS/JS, no framework, no build step, no package manager, no tests. UI strings are in Spanish; keep new UI text in Spanish.

## Domain: Spanish road-haulage "competencia profesional" exam

The app trains for the Spanish certificate of professional competence for road transport (Ministerio de Transportes). The project's scope is the **mercancías** (goods) variant only, not viajeros (passengers). Official page: https://www.transportes.gob.es/transporte-terrestre/examenes-y-formacion/competencia-profesional

The real exam has two parts, each with a 2-hour limit:
1. **Preguntas**: 200 multiple-choice questions, 4 options each. This is what `questions.json` and the "200 de todo" mode model.
2. **Casos prácticos**: 4 practical cases, each with 8 alternative answer sets (A–H). Each case is a long scenario followed by several sub-questions (typically 3); each of the 8 alternatives is a bundle of one answer per sub-question, and exactly one bundle is correct. **Not yet in the repo**; adding it is the main planned feature. It needs its own data model (8 compound options, a multi-paragraph scenario, `SOLUCION: RESPUESTA X`, `NORMA`, optional `REFERENCIA DOCTRINAL`) and probably its own UI, since the current question screen assumes short single-line options.

### Official sources (mercancías)

The ministry publishes both banks per topic as HTML pages and as a ZIP of plain-text files. The ZIPs are the easiest thing to parse; the site blocks generic fetchers, so request with a browser User-Agent.

| Content | HTML index | ZIP (as of 2026-04-08 update) |
|---|---|---|
| Preguntas | `.../competencia-profesional/preguntas-mercancias` | `https://cdn.transportes.gob.es/portal-web-transportes/transporte-terrestre/examenes-competencia/pm_260326.zip` |
| Casos prácticos | `.../competencia-profesional/casos-practicos-mercancias` | `https://cdn.transportes.gob.es/portal-web-transportes/transporte-terrestre/examenes-competencia/cm_260326.zip` |

Change logs for each update are PDFs linked from the main page (`cambios_preguntas_<date>.pdf`, `cambios_casos_<date>.pdf`). The ZIP file names carry the publication date (`260326` = 2026-03-26), so expect the URLs to change on every revision.

Each ZIP holds one UTF-8 `.txt` per topic (`pm1A.txt` … `pm1H.txt`, `cm1A.txt` … `cm1H.txt`). Topics A–H and their names match the `topic` values already in `questions.json`. Records are separated by blank lines, fields are `LABEL: value` lines:

```
# pm (preguntas)                    # cm (casos prácticos)
COD: 1A01001                        COD: 1A02001
PREGUNTA: ...                       PREGUNTA:            (multi-paragraph, blank-line separated)
A: ...                              RESPUESTA A:
B: ...                              A) ...  B) ...  C) ...   (one line per sub-question)
C: ...                              ... RESPUESTA B: … RESPUESTA H:
D: ...                              SOLUCION: RESPUESTA B
SOLUCION: B                         NORMA: ...
NORMA: ...                          REFERENCIA DOCTRINAL: ...   (optional)
```

Codes are `1` + topic letter + 5 digits; the `1` prefix is the mercancías bank. The casos ZIP contains ~660 cases (A:154, B:66, C:140, D:86, E:148, F:44, G:16, H:6).

### Bank freshness

`questions.json` was generated from an earlier revision. Compared with the 2026-03-26 bank it is missing 3 questions (`1B01160`, `1B02302`, `1C04168`), has 5 questions whose correct answer changed (`1C03086`, `1E10124`, `1G01011`, `1G01022`, `1G01038`) and ~1,250 with wording tweaks in question text, options or `norma`. There is no import script in the repo; if you write one, parse the ZIP `.txt` format above and regenerate the whole file rather than patching.

## Running

There is nothing to build. The app loads `questions.json` via `fetch()`, so opening `index.html` directly from `file://` fails in Chromium browsers (the README's "just open index.html" only works in Firefox). Serve the directory over HTTP:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

To check the question bank is valid JSON and count entries:

```bash
python3 -c "import json; print(len(json.load(open('questions.json'))))"
```

## Architecture

### Script load order and the `App` namespace

Every file in `js/` is an IIFE that attaches one object to the global `window.App`. There are no modules or imports; cross-file references resolve at call time through `App.<ns>.<fn>`. `index.html` loads the scripts in a fixed order that must be preserved because later files capture `App.dom.byId` etc. at load time:

```
app.state.js  → App.state   (single mutable state object)
app.utils.js  → App.utils   (shuffle/sample, duration formatting, localStorage wrapper)
app.dom.js    → App.dom     (byId, setHidden, show)
app.render.js → App.render  (renderQuestion, renderSummary, renderHistoryTable, nav grid modal)
app.actions.js→ App.actions (test lifecycle, navigation between screens, persistence)
app.events.js → App.events  (bindEvents: one-time listeners for static buttons)
app.init.js   → bootstraps: bindEvents → fetch questions.json → fillTopicsSelect → initDashboard
```

A new file must be added to the `<script>` list in `index.html` in a position after everything it depends on.

### Screens

All screens are `<div>`s in `index.html` (`screen-home`, `screen-setup`, `screen-history`, `screen-question`, `screen-summary`) toggled with the `hidden` class. There are two toggling mechanisms in use: `App.dom.show(id)` hides only setup/question/summary (its list still contains the removed `screen-feedback`), while `App.actions.initDashboard`, `goToSetup`, `goToHistory` toggle screens individually with `setHidden`. When adding a screen, update both paths or you will get two screens visible at once. The header icons `homeLink`/`exitLink` and the sticky `bottomNav` are also toggled per screen.

### Test state model

`App.state.currentSet` is the array of question objects for the active test. `answers[i]` and `results[i]` are parallel arrays indexed by question position: `null` means unanswered, otherwise `{selected, correct}` and `{question, user, correct}` respectively. `userSelected` is the transient (unsaved) radio choice for the current question; it is cleared on jump.

Modes:
- `themes` (Modo 1): filter `BANK` by selected topics, sample `n`.
- `all200` (Modo 2): sample 200 from the whole bank.
- `isExamMode` flag (orthogonal to the above): when true, feedback and the hint button are suppressed until `finishTest`; when false, feedback renders inline immediately after `applyAnswer`.
- "Examen Rápido" on the dashboard is just `startTest` with mode forced to `all200` and exam mode on.

`finishTest` refuses to finish until every question is answered.

### Rendering

`App.render.renderQuestion()` is the single re-render point for the question screen. It rebuilds the options, main action button, progress bar, inline feedback and bottom nav from `App.state` each time. Dynamic elements get handlers via `el.onclick = ...` (assignment, not `addEventListener`) specifically so re-renders don't stack listeners; follow the same pattern for anything re-rendered. The main button (`mainActionBtn`) changes label and handler depending on whether the current question is answered and whether it is the last one.

### Persistence

`App.utils.storage` wraps `localStorage` with the key prefix `test_cap_`. Two keys:
- `session`: the in-progress test (`currentSet, idx, answers, results, startTime, isExamMode`). Written by `saveCurrentState()` after every answer/navigation, removed on finish. Its presence drives the "Reanudar" card on the dashboard.
- `history`: last 50 finished tests (`date, duration, total, correct, wrong, skipped`).

Changing the shape of `App.state` means handling old `session` blobs in `loadSession`.

### Question bank

`questions.json` (~3.4 MB, ~4.5k entries) is an array of:

```json
{ "topic": "A. Elementos de Derecho civil", "code": "1A01001",
  "question": "...", "options": [{"key": "A", "text": "..."}, ...],
  "answer": "B", "norma": "RD 1211/1990, art. 6" }
```

`answer` is the option `key`, compared by string equality. `norma` (legal reference) doubles as the hint text and the post-answer explanation. Topic list in the setup screen is derived from distinct `topic` values, sorted. Question and option text are injected with `innerHTML`, so the bank is trusted content.
