// js/app.events.js
(() => {
  window.App = window.App || {};

  const byId = App.dom.byId;

  const bindEvents = () => {
    const modeEl = byId("mode");
    if (modeEl) {
      modeEl.addEventListener("change", () => {
        const isAll = modeEl.value === "all200";
        const nWrap = byId("nWrap");
        if (nWrap) nWrap.style.display = isAll ? "none" : "block";
      });
    }

    const startBtn = byId("startBtn");
    if (startBtn) startBtn.addEventListener("click", App.actions.startTest);

    const hintBtn = byId("hintBtn");
    if (hintBtn) {
      hintBtn.addEventListener("click", () => {
        const q = App.state.currentSet[App.state.idx];
        const norma = q?.norma || "";
        const hintBox = byId("hintBox");
        if (!hintBox) return;

        if (norma.trim()) hintBox.innerHTML = `<b>NORMA:</b> ${norma}`;
        else hintBox.innerHTML = "No hay NORMA para esta pregunta.";

        App.dom.setHidden(hintBox, false);
      });
    }

    const applyBtn = byId("applyBtn");
    if (applyBtn) applyBtn.addEventListener("click", App.actions.applyAnswer);

    const skipBtn = byId("skipBtn");
    if (skipBtn) skipBtn.addEventListener("click", App.actions.skipQuestion);

    const exitBtn1 = byId("exitBtn1");
    if (exitBtn1) exitBtn1.addEventListener("click", App.actions.exitToSetup);

    const exitBtn2 = byId("exitBtn2");
    if (exitBtn2) exitBtn2.addEventListener("click", App.actions.exitToSetup);

    const nextBtn = byId("nextBtn");
    if (nextBtn) nextBtn.addEventListener("click", App.actions.nextQuestion);

    const reviewBtn = byId("reviewBtn");
    if (reviewBtn) reviewBtn.addEventListener("click", App.actions.reviewWrongQuestions);

    const backBtn = byId("backBtn");
    if (backBtn) backBtn.addEventListener("click", App.actions.exitToSetup);

    const jumpSelect = byId("jumpSelect");
    if (jumpSelect) {
      jumpSelect.addEventListener("change", (e) => {
        const newIndex = Number(e.target.value);
        if (Number.isNaN(newIndex)) return;
        App.actions.jumpToQuestion(newIndex);
      });
    }

    const sumViewBtn = byId("sumViewBtn");
    if (sumViewBtn) sumViewBtn.addEventListener("click", App.actions.viewCorrectionFromSummary);
  };

  App.events = { bindEvents };
})();
