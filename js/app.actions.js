// js/app.actions.js
(() => {
  window.App = window.App || {};

  const byId = App.dom.byId;
  const setHidden = App.dom.setHidden;
  const show = App.dom.show;

  const topicsFromBank = () => {
    const { BANK } = App.state;
    return Array.from(new Set(BANK.map((q) => q.topic))).sort();
  };

  const fillTopicsSelect = () => {
    const sel = byId("topics");
    if (!sel) return;

    sel.innerHTML = "";
    topicsFromBank().forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      sel.appendChild(opt);
    });

    if (sel.options.length > 0) sel.options[0].selected = true;
  };

  const getSelectedTopics = () => {
    const sel = byId("topics");
    if (!sel) return [];
    return Array.from(sel.selectedOptions).map((o) => o.value);
  };

  const startTest = () => {
    const modeEl = byId("mode");
    const nEl = byId("n");
    if (!modeEl || !nEl) return;

    const mode = modeEl.value;
    const n = parseInt(nEl.value || "20", 10);
    const topics = getSelectedTopics();

    let pool = [];
    if (mode === "all200") {
      pool = App.state.BANK;
      App.state.currentSet = App.utils.sample(pool, 200);
    } else {
      pool = App.state.BANK.filter((q) => topics.includes(q.topic));
      if (!pool.length) {
        const msg = byId("setupMsg");
        if (msg) msg.innerHTML = "Selecciona al menos un tema con preguntas.";
        setHidden(byId("setupMsg"), false);
        return;
      }
      App.state.currentSet = App.utils.sample(pool, Math.max(1, n));
    }

    // Estado del test
    App.state.idx = 0;
    App.state.userSelected = null;

    App.state.answers = new Array(App.state.currentSet.length).fill(null);
    App.state.results = new Array(App.state.currentSet.length).fill(null);

    App.state.startTime = Date.now();
    App.state.endTime = null;

    setHidden(byId("setupMsg"), true);
    saveCurrentState();
    App.render.renderQuestion();
  };

  const applyAnswer = () => {
    const { currentSet, idx, userSelected } = App.state;
    const q = currentSet[idx];
    if (!q) return;

    if (!userSelected) {
      const qMsg = byId("qMsg");
      if (qMsg) qMsg.innerHTML = "<b>Selecciona una respuesta antes de aplicar.</b>";
      setHidden(byId("qMsg"), false);
      return;
    }

    const isCorrect = userSelected === q.answer;

    App.state.answers[idx] = { selected: userSelected, correct: isCorrect };
    App.state.results[idx] = { question: q, user: userSelected, correct: isCorrect };

    saveCurrentState();
    App.render.renderFeedback();
  };

  const nextQuestion = () => {
    if (App.state.idx < App.state.currentSet.length - 1) {
      App.state.idx += 1;
      App.render.renderQuestion();
    } else {
      App.state.endTime = Date.now();
      clearCurrentState();
      addToHistory();
      App.render.renderSummary();
    }
  };

  const skipQuestion = () => {
    if (App.state.idx < App.state.currentSet.length - 1) {
      App.state.idx += 1;
      App.render.renderQuestion();
    } else {
      App.state.endTime = Date.now();
      App.render.renderSummary();
    }
  };

  const jumpToQuestion = (newIndex) => {
    if (!Number.isFinite(newIndex)) return;
    if (newIndex < 0 || newIndex >= App.state.currentSet.length) return;
    App.state.idx = newIndex;
    saveCurrentState();
    App.render.renderQuestion();
  };

  const exitToSetup = () => {
    App.state.currentSet = [];
    App.state.idx = 0;
    App.state.userSelected = null;
    setHidden(byId("setupMsg"), true);
    clearCurrentState();
    App.render.renderHistoryTable();
    show("screen-setup");
  };

  const reviewWrongQuestions = () => {
    const wrongQs = App.state.results
      .filter((r) => r && !r.correct)
      .map((r) => r.question);

    App.state.currentSet = wrongQs;
    App.state.idx = 0;
    App.state.userSelected = null;

    if (wrongQs.length === 0) {
      const msg = byId("setupMsg");
      if (msg) msg.innerHTML = "No hay preguntas incorrectas 🎉";
      setHidden(byId("setupMsg"), false);
      show("screen-setup");
      return;
    }

    // Modo “repetir fallos”
    App.state.answers = new Array(wrongQs.length).fill(null);
    App.state.results = new Array(wrongQs.length).fill(null);

    App.render.renderQuestion();
  };

  const viewCorrectionFromSummary = () => {
    const sel = byId("sumJumpSelect");
    if (!sel) return;

    const i = Number(sel.value);
    if (Number.isNaN(i)) return;

    App.state.idx = i;
    App.render.renderFeedback();
  };

  const saveCurrentState = () => {
    const { currentSet, idx, answers, results, startTime } = App.state;
    if (!currentSet || currentSet.length === 0) return;
    App.utils.storage.set("session", { currentSet, idx, answers, results, startTime });
  };

  const clearCurrentState = () => {
    App.utils.storage.remove("session");
  };

  const loadSession = () => {
    const session = App.utils.storage.get("session");
    if (!session) return;

    App.state.currentSet = session.currentSet;
    App.state.idx = session.idx;
    App.state.answers = session.answers;
    App.state.results = session.results;
    App.state.startTime = session.startTime;
    App.state.endTime = null;

    App.render.renderQuestion();
  };

  const addToHistory = () => {
    const { startTime, endTime, answers } = App.state;
    const answered = answers.filter((a) => a !== null);
    const correct = answered.filter((a) => a.correct).length;
    const wrong = answered.filter((a) => !a.correct).length;
    const skipped = answers.length - answered.length;

    const entry = {
      date: new Date().toISOString(),
      duration: endTime - startTime,
      total: answers.length,
      correct,
      wrong,
      skipped,
    };

    const history = App.utils.storage.get("history") || [];
    history.unshift(entry);
    App.utils.storage.set("history", history.slice(0, 50)); // Guardar últimos 50
    App.render.renderHistoryTable();
  };

  const clearHistory = () => {
    App.utils.storage.remove("history");
    App.render.renderHistoryTable();
  };

  App.actions = {
    fillTopicsSelect,
    startTest,
    applyAnswer,
    nextQuestion,
    skipQuestion,
    jumpToQuestion,
    exitToSetup,
    reviewWrongQuestions,
    viewCorrectionFromSummary,
    saveCurrentState,
    clearCurrentState,
    loadSession,
    addToHistory,
    clearHistory,
  };
})();
