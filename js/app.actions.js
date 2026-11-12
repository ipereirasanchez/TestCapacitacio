// js/app.actions.js
(() => {
  window.App = window.App || {};

  const byId = App.dom.byId;
  const setHidden = App.dom.setHidden;
  const show = App.dom.show;

  const topicsFromBank = (kind) =>
    Array.from(new Set(bankFor(kind).map((q) => q.topic))).sort();

  const fillTopicsSelect = (kind = "test") => {
    const sel = byId("topics");
    if (!sel) return;

    sel.innerHTML = "";
    topicsFromBank(kind).forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      sel.appendChild(opt);
    });

    if (sel.options.length > 0) sel.options[0].selected = true;
  };

  /* ---------- Bancos ---------- */
  let casosPromise = null;
  // Carga data/casos.json una sola vez; devuelve siempre la misma promesa.
  const ensureCasosLoaded = () => {
    if (App.state.CASOS.length) return Promise.resolve();
    if (!casosPromise) {
      casosPromise = fetch(new URL("data/casos.json", document.baseURI).toString(), { cache: "no-store" })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status} al cargar data/casos.json`);
          return res.json();
        })
        .then((data) => { App.state.CASOS = data; })
        .catch((e) => { casosPromise = null; throw e; });
    }
    return casosPromise;
  };

  const bankFor = (kind) => (kind === "caso" ? App.state.CASOS : App.state.BANK);

  /* ---------- Dashboard Navigation ---------- */
  const initDashboard = () => {
    stopTimer();
    // Check session for Resume
    const hasSession = !!App.utils.storage.get("session");
    const resumeCard = byId("btnDashResume");
    setHidden(resumeCard, !hasSession);

    // Reset UI
    setHidden(byId("screen-home"), false);
    setHidden(byId("screen-setup"), true);
    setHidden(byId("screen-question"), true);
    setHidden(byId("screen-summary"), true);
    setHidden(byId("screen-history"), true);
    setHidden(byId("bottomNav"), true);
    setHidden(byId("prog-wrap"), true);
    setHidden(byId("homeLink"), true); // Home link hidden on home
    setHidden(byId("exitLink"), true);

    // Tarjeta "Repasar fallos"
    const nTest = getFallosCodes("test").length;
    const nCaso = getFallosCodes("caso").length;
    setHidden(byId("btnDashFallos"), nTest + nCaso === 0);
    const fc = byId("fallosCount");
    if (fc) fc.textContent = `${nTest} preguntas · ${nCaso} casos`;

    App.state.idx = 0;
  };

  // Ajusta el formulario de configuración al tipo elegido (temas, número por defecto, textos).
  const applySetupKind = async (kind) => {
    const isCaso = kind === "caso";

    // Ajustes síncronos primero: lo que el usuario toque después no se pisa.
    const nLabel = byId("nLabel");
    if (nLabel) nLabel.textContent = isCaso ? "Número de casos" : "Número de preguntas";
    const nEl = byId("n");
    if (nEl) nEl.value = isCaso ? 4 : 20;
    const hint = byId("modeHint");
    if (hint) hint.textContent = isCaso
      ? "“Examen completo” toma 4 casos de todos los temas, como la prueba oficial."
      : "“Examen completo” toma 200 preguntas de todos los temas, como la prueba oficial.";

    const startBtn = byId("startBtn");
    if (isCaso && !App.state.CASOS.length) {
      if (startBtn) startBtn.disabled = true;
      fillTopicsSelect(kind); // vacío mientras carga
      try { await ensureCasosLoaded(); }
      catch (e) { console.error(e); showSetupMsg("No se han podido cargar los casos prácticos."); return; }
      finally { if (startBtn) startBtn.disabled = false; }
      // Si cambió de tipo mientras cargaba, no tocar su formulario.
      if (byId("bankKind")?.value !== kind) return;
    }
    fillTopicsSelect(kind);
  };

  const showSetupMsg = (html) => {
    const msg = byId("setupMsg");
    if (msg) { msg.innerHTML = html; setHidden(msg, false); }
  };

  // preset: { kind?, source?, n? }
  const goToSetup = async (preset = {}) => {
    setHidden(byId("screen-home"), true);
    setHidden(byId("screen-setup"), false);
    setHidden(byId("homeLink"), false); // Can go home from setup
    setHidden(byId("setupMsg"), true);

    const kindEl = byId("bankKind");
    const srcEl = byId("source");
    if (preset.kind && kindEl) kindEl.value = preset.kind;
    if (preset.source && srcEl) srcEl.value = preset.source;
    // La parte síncrona de applySetupKind corre ya; el preset de n va antes de
    // esperar la carga para no pisar lo que el usuario escriba mientras tanto.
    const loading = applySetupKind(kindEl ? kindEl.value : "test");
    if (preset.n && byId("n")) byId("n").value = preset.n;
    setHidden(byId("nWrap"), byId("mode")?.value === "all");
    await loading;
    // Con "Solo mis fallos" se repasan todos los temas: seleccionar todos.
    if (srcEl && srcEl.value === "fallos") selectAllTopics();
  };

  const selectAllTopics = () => {
    const sel = byId("topics");
    if (sel) Array.from(sel.options).forEach((o) => { o.selected = true; });
  };

  // Duración efectiva del test: con cronómetro nunca supera el límite
  // (una sesión reanudada tras expirar no debe contar el tiempo de reloj).
  const elapsedMs = () => {
    const { startTime, endTime, timeLimitMs } = App.state;
    const raw = (endTime || Date.now()) - (startTime || Date.now());
    return timeLimitMs ? Math.min(raw, timeLimitMs) : raw;
  };

  const goToHistory = () => {
    setHidden(byId("screen-home"), true);
    setHidden(byId("screen-history"), false);
    setHidden(byId("homeLink"), false);
    App.render.renderHistoryTable();
  };

  // Examen Rápido: 20 preguntas de todos los temas, sin cronómetro. La tarjeta abre
  // un selector de modo: estudio (corrección tras cada pregunta) o examen (al final).
  const openQuickMode = () => byId("quickModeModal")?.classList.add("active");
  const closeQuickMode = () => byId("quickModeModal")?.classList.remove("active");

  const startQuickExam = (examMode) => {
    closeQuickMode();
    return startTest({ kind: "test", source: "all", mode: "themes", n: 20, topics: null, examMode: examMode === true, timer: false });
  };

  // Simulacro: la primera prueba oficial completa (200 preguntas, 2 h, corrección al final).
  const startSimulacro = () =>
    startTest({ kind: "test", source: "all", mode: "all", examMode: true, timer: true });

  // Códigos guardados como fallados para un tipo ("test" | "caso").
  const getFallosCodes = (kind) => {
    const fallos = App.utils.storage.get("fallos") || {};
    const prefix = `${kind}:`;
    return Object.keys(fallos).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
  };

  /* ---------- Actions ---------- */
  const getSelectedTopics = () => {
    const sel = byId("topics");
    if (!sel) return [];
    return Array.from(sel.selectedOptions).map((o) => o.value);
  };

  // opts sobrescribe lo leído del formulario:
  // { kind, source, mode ("themes"|"all"), n, topics (array | null = todos), examMode, timer }
  const startTest = async (opts = {}) => {
    const cfg = Object.assign({
      kind: byId("bankKind")?.value || "test",
      source: byId("source")?.value || "all",
      mode: byId("mode")?.value || "themes",
      n: parseInt(byId("n")?.value || "20", 10),
      topics: getSelectedTopics(),
      examMode: !!byId("examMode")?.checked,
      timer: !!byId("timerMode")?.checked,
    }, opts);

    if (cfg.kind === "caso") {
      try { await ensureCasosLoaded(); }
      catch (e) { console.error(e); await goToSetup(); showSetupMsg("No se han podido cargar los casos prácticos."); return; }
    }

    const noun = cfg.kind === "caso" ? "casos" : "preguntas";
    let pool = bankFor(cfg.kind);
    if (cfg.source === "fallos") {
      const codes = new Set(getFallosCodes(cfg.kind));
      pool = pool.filter((q) => codes.has(q.code));
    }
    if (cfg.mode === "themes" && cfg.topics !== null) {
      if (!cfg.topics.length) { showSetupMsg("Selecciona al menos un tema."); return; }
      pool = pool.filter((q) => cfg.topics.includes(q.topic));
    }
    if (!pool.length) {
      if (byId("screen-setup").classList.contains("hidden")) await goToSetup();
      showSetupMsg(`No hay ${noun} con esos filtros.`);
      return;
    }

    const size = cfg.mode === "all"
      ? (cfg.kind === "caso" ? 4 : 200)
      : Math.max(1, Number.isFinite(cfg.n) ? cfg.n : 1);
    App.state.currentSet = App.utils.sample(pool, size);

    // Estado del test
    App.state.kind = cfg.kind;
    App.state.source = cfg.source;
    App.state.timeLimitMs = cfg.timer ? App.scoring.TIME_LIMIT_MS : null;
    App.state.idx = 0;
    App.state.userSelected = null;

    App.state.answers = new Array(App.state.currentSet.length).fill(null);
    App.state.results = new Array(App.state.currentSet.length).fill(null);

    App.state.startTime = Date.now();
    App.state.endTime = null;
    App.state.isExamMode = !!cfg.examMode;

    saveCurrentState();

    // UI Update
    setHidden(byId("screen-setup"), true);
    setHidden(byId("screen-home"), true);
    setHidden(byId("exitLink"), false); // Enable exit
    setHidden(byId("homeLink"), true); // No home loop during test
    App.render.renderQuestion();
  };

  const applyAnswer = () => {
    const { currentSet, idx, userSelected } = App.state;
    const q = currentSet[idx];
    if (!q) return;

    if (!userSelected) {
      showTestMsg("<b>Selecciona una respuesta antes de aplicar.</b>");
      return;
    }

    const isCorrect = userSelected === q.answer;

    App.state.answers[idx] = { selected: userSelected, correct: isCorrect };
    App.state.results[idx] = { question: q, user: userSelected, correct: isCorrect };

    saveCurrentState();

    // En modo examen, avanzar directo
    if (App.state.isExamMode) {
      if (idx >= currentSet.length - 1) {
        App.render.renderQuestion();
      } else {
        nextQuestion();
      }
    } else {
      // En modo práctica, re-renderizar para mostrar feedback inline + cambiar botón a "Siguiente"
      App.render.renderQuestion();
      byId("inlineFeedback")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  };

  const showTestMsg = (html) => {
    const qMsg = byId("qMsg");
    if (qMsg) { qMsg.innerHTML = html; setHidden(qMsg, false); }
    // fMsg is deprecated in new layout but kept safe
  };

  const nextQuestion = () => {
    if (App.state.idx < App.state.currentSet.length - 1) {
      App.state.idx += 1;
      App.state.userSelected = null; // no arrastrar la selección a la siguiente pregunta
      saveCurrentState();
      App.render.renderQuestion();
    } else {
      showTestMsg("<b>Estás en la última pregunta.</b> Usa el botón 'Finalizar test' para terminar.");
    }
  };

  const skipQuestion = () => {
    if (App.state.idx < App.state.currentSet.length - 1) {
      App.state.idx += 1;
      App.state.userSelected = null;
      saveCurrentState();
      App.render.renderQuestion();
    } else {
      showTestMsg("<b>Estás en la última pregunta.</b> Usa el botón 'Finalizar test' para terminar.");
    }
  };

  // force === true salta la advertencia de preguntas en blanco (botón "Finalizar igualmente"
  // o fin del cronómetro). Se compara con `true` para ignorar un `event` pasado por error.
  const finishTest = (force = false) => {
    const { answers, currentSet } = App.state;
    const blank = answers.filter((a) => a === null).length;
    const noun = App.state.kind === "caso" ? "casos" : "preguntas";

    if (blank > 0 && force !== true) {
      showTestMsg(
        `<b>Faltan ${blank} ${noun} sin responder.</b> Puedes seguir contestando o finalizar dejándolas en blanco (puntúan 0).` +
        `<div style="margin-top:10px;"><button id="finishAnywayBtn" class="danger">Finalizar con ${noun} en blanco</button></div>`
      );
      const btn = byId("finishAnywayBtn");
      if (btn) btn.onclick = () => finishTest(true);
      return;
    }

    stopTimer();
    App.state.endTime = Date.now();
    clearCurrentState();
    updateFallos(App.state.kind, App.state.results);
    addToHistory();
    App.render.renderSummary();
  };

  // Fallos acumulados entre sesiones: { "<kind>:<code>": { count, last } }.
  // Un fallo incrementa el contador; un acierto borra la entrada.
  const updateFallos = (kind, results) => {
    const fallos = App.utils.storage.get("fallos") || {};
    const now = new Date().toISOString();
    (results || []).forEach((r) => {
      if (!r || !r.question) return;
      const key = App.scoring.itemKey(kind, r.question.code);
      if (r.correct) delete fallos[key];
      else fallos[key] = { count: ((fallos[key] && fallos[key].count) || 0) + 1, last: now };
    });
    App.utils.storage.set("fallos", fallos);
  };

  /* ---------- Cronómetro ---------- */
  let timerId = null;

  const remainingMs = () => {
    const { timeLimitMs, startTime } = App.state;
    if (!timeLimitMs || !startTime) return null;
    return startTime + timeLimitMs - Date.now();
  };

  const tick = () => {
    const r = remainingMs();
    App.render.renderTimer(r);
    if (r !== null && r <= 0) {
      stopTimer();
      finishTest(true);
    }
  };

  const startTimer = () => {
    if (!App.state.timeLimitMs) { App.render.renderTimer(null); return; }
    if (timerId) return;
    tick();
    if (timerId === null && remainingMs() > 0) timerId = setInterval(tick, 1000);
  };

  const stopTimer = () => {
    if (timerId) clearInterval(timerId);
    timerId = null;
  };

  const jumpToQuestion = (newIndex) => {
    if (!Number.isFinite(newIndex)) return;
    if (newIndex < 0 || newIndex >= App.state.currentSet.length) return;
    App.state.idx = newIndex;
    App.state.userSelected = null; // Reset temp selection when jumping
    saveCurrentState();
    App.render.renderQuestion();
  };

  const exitToSetup = () => {
    // Now mostly used as "Exit to Dashboard"
    initDashboard();
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

    // Modo “repetir fallos”: mismo tipo, sin cronómetro, tiempo desde ahora
    App.state.answers = new Array(wrongQs.length).fill(null);
    App.state.results = new Array(wrongQs.length).fill(null);
    App.state.timeLimitMs = null;
    App.state.startTime = Date.now();
    App.state.endTime = null;
    saveCurrentState();

    App.render.renderQuestion();
  };

  const viewCorrectionFromSummary = () => {
    // Deprecated? Summary now integrated
  };

  const saveCurrentState = () => {
    const { currentSet, idx, answers, results, startTime, isExamMode, kind, source, timeLimitMs } = App.state;
    if (!currentSet || currentSet.length === 0) return;
    App.utils.storage.set("session", { currentSet, idx, answers, results, startTime, isExamMode, kind, source, timeLimitMs });
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
    App.state.isExamMode = session.isExamMode || false;
    // Sesiones guardadas por versiones anteriores: test, banco completo, sin cronómetro.
    App.state.kind = session.kind || "test";
    App.state.source = session.source || "all";
    App.state.timeLimitMs = session.timeLimitMs ?? null;
    App.state.endTime = null;

    // UI Update for Test
    setHidden(byId("screen-home"), true);
    setHidden(byId("screen-setup"), true);
    setHidden(byId("homeLink"), true);
    setHidden(byId("exitLink"), false);

    // Sesión con cronómetro ya agotado: se corrige directamente.
    const r = remainingMs();
    if (r !== null && r <= 0) { finishTest(true); return; }

    App.render.renderQuestion();
  };

  const addToHistory = () => {
    const { answers, kind } = App.state;
    const sc = App.scoring.score(kind, answers);

    const entry = {
      date: new Date().toISOString(),
      duration: elapsedMs(),
      kind,
      total: answers.length,
      correct: sc.correct,
      wrong: sc.wrong,
      skipped: sc.blank,
      points: sc.points,
      max: sc.max,
      pct: sc.pct,
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
    ensureCasosLoaded,
    bankFor,
    fillTopicsSelect,
    startTest,
    applyAnswer,
    nextQuestion,
    skipQuestion,
    jumpToQuestion,
    exitToSetup,
    reviewWrongQuestions,
    saveCurrentState,
    clearCurrentState,
    loadSession,
    addToHistory,
    clearHistory,
    finishTest,
    updateFallos,
    startTimer,
    stopTimer,
    initDashboard,
    goToSetup,
    applySetupKind,
    selectAllTopics,
    elapsedMs,
    goToHistory,
    startQuickExam,
    openQuickMode,
    closeQuickMode,
    startSimulacro,
    getFallosCodes
  };
})();
