// js/app.state.js
(() => {
  window.App = window.App || {};

  App.state = {
    BANK: [],
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
  };
})();

