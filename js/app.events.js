// js/app.events.js
(() => {
  const byId = App.dom.byId;

  const bindEvents = () => {
    // Setup
    const startBtn = byId("startBtn");
    if (startBtn) startBtn.addEventListener("click", App.actions.startTest);

    const modeSel = byId("mode");
    if (modeSel) modeSel.addEventListener("change", (e) => {
      App.dom.setHidden(byId("nWrap"), e.target.value === "all200");
    });

    // Question Actions (Delegate if needed, but IDs are static now)
    // We use a shared Main Action Button now in renderQuestion, but binding locally 
    // inside render is safer for dynamic context, however global buttons need global binding.
    // So we don't need to bind it here.

    const finishBtn = byId("finishBtn");
    if (finishBtn) finishBtn.addEventListener("click", App.actions.finishTest);

    // Exit Buttons
    const exitBtn1 = byId("exitBtn1"); // Legacy support if element remains
    if (exitBtn1) exitBtn1.addEventListener("click", App.actions.exitToSetup);

    const exitLink = byId("exitLink"); // new header exit icon
    if (exitLink) exitLink.addEventListener("click", App.actions.exitToSetup);

    // Hints
    const hintBtn = byId("hintBtn");
    if (hintBtn) hintBtn.addEventListener("click", () => {
      // Simple toggle logic or Action
      const box = byId("hintBox");
      const q = App.state.currentSet[App.state.idx];
      if (box && q) {
        box.innerHTML = `<b>Pista:</b> ${q.norma || "No hay norma específica."}`;
        App.dom.setHidden(box, false);
      }
    });

    // Summary Actions
    const backBtn = byId("backBtn");
    if (backBtn) backBtn.addEventListener("click", App.actions.exitToSetup);

    const reviewBtn = byId("reviewBtn");
    if (reviewBtn) reviewBtn.addEventListener("click", App.actions.reviewWrongQuestions);

    // Grid Modal
    const closeGridBtn = byId("closeGridBtn");
    if (closeGridBtn) closeGridBtn.addEventListener("click", App.render.closeNavGrid);

    const finishGridBtn = byId("finishGridBtn");
    if (finishGridBtn) finishGridBtn.addEventListener("click", () => {
      App.render.closeNavGrid();
      App.actions.finishTest();
    });

    // Resume Logic
    const resumeBtn = byId("resumeBtn");
    if (resumeBtn) resumeBtn.addEventListener("click", App.actions.loadSession);

    // Dashboard
    const btnDashNew = byId("btnDashNew");
    if (btnDashNew) btnDashNew.addEventListener("click", App.actions.goToSetup);

    const btnDashResume = byId("btnDashResume");
    if (btnDashResume) btnDashResume.addEventListener("click", App.actions.loadSession);

    const btnDashExam = byId("btnDashExam");
    if (btnDashExam) btnDashExam.addEventListener("click", App.actions.startQuickExam);

    const btnDashHistory = byId("btnDashHistory");
    if (btnDashHistory) btnDashHistory.addEventListener("click", App.actions.goToHistory);

    // Header & Back Buttons
    const homeLink = byId("homeLink");
    if (homeLink) homeLink.addEventListener("click", App.actions.initDashboard);

    const setupBackBtn = byId("setupBackBtn");
    if (setupBackBtn) setupBackBtn.addEventListener("click", App.actions.initDashboard);

    const historyBackBtn = byId("historyBackBtn");
    if (historyBackBtn) historyBackBtn.addEventListener("click", App.actions.initDashboard);

    const clearHistoryBtn = byId("clearHistoryBtn");
    if (clearHistoryBtn) clearHistoryBtn.addEventListener("click", App.actions.clearHistory);
  };

  App.events = { bindEvents };
})();
