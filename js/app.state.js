// js/app.state.js
(() => {
  window.App = window.App || {};

  App.state = {
    BANK: [],      // preguntas (data/preguntas.json)
    CASOS: [],     // casos prácticos (data/casos.json), cargados bajo demanda
    META: null,    // data/meta.json: { updated, preguntas, casos, sources }

    // Conjunto activo
    kind: "test",        // "test" | "caso"
    source: "all",       // "all" | "fallos"
    timeLimitMs: null,   // null | App.scoring.TIME_LIMIT_MS
    currentSet: [],
    idx: 0,

    // Por pregunta (mismo tamaño que currentSet):
    // answers[i] = null | { selected: "A", correct: true/false }
    answers: [],
    // results[i] = null | { question, user, correct }
    results: [],

    userSelected: null,

    startTime: null,
    endTime: null,
    isExamMode: false,
  };
})();

