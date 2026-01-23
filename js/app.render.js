// js/app.render.js
(() => {
  window.App = window.App || {};

  const byId = App.dom.byId;
  const setHidden = App.dom.setHidden;
  const show = App.dom.show;

  const renderJumpSelect = (selectId) => {
    const { currentSet, idx, answers } = App.state;
    const sel = byId(selectId);
    if (!sel) return;

    sel.innerHTML = "";

    currentSet.forEach((_, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);

      const a = answers[i]; // null | {selected, correct}
      if (!a) {
        opt.textContent = `Pregunta ${i + 1} — sin responder`;
      } else if (a.correct) {
        opt.textContent = `Pregunta ${i + 1} — ✅`;
        opt.style.color = "green";
      } else {
        opt.textContent = `Pregunta ${i + 1} — ❌`;
        opt.style.color = "red";
      }

      if (i === idx) opt.selected = true;
      sel.appendChild(opt);
    });
  };

  const renderQuestion = () => {
    const { currentSet, idx, answers } = App.state;
    const q = currentSet[idx];
    if (!q) return;

    // Recuperar selección guardada si existe
    App.state.userSelected = answers[idx]?.selected ?? null;

    byId("qTitle").textContent = `Pregunta — ${q.topic}`;
    byId("qMeta").innerHTML = q.code ? `<span class="code">COD: ${q.code}</span>` : "";
    byId("qCounter").textContent = `${idx + 1} / ${currentSet.length}`;

    renderJumpSelect("jumpSelect");

    byId("qText").innerHTML = `<div style="white-space:normal;"><b>PREGUNTA:</b> ${q.question}</div>`;

    const box = byId("qOptions");
    box.innerHTML = "";

    q.options.forEach((o) => {
      const row = document.createElement("label");
      row.className = "opt";
      row.innerHTML = `
        <input type="radio" name="ans" value="${o.key}">
        <div><b>${o.key}:</b> ${o.text}</div>
      `;

      const input = row.querySelector("input");

      // Marcar si ya estaba seleccionada
      if (App.state.userSelected === o.key) input.checked = true;

      input.addEventListener("change", (e) => {
        App.state.userSelected = e.target.value;
        setHidden(byId("qMsg"), true);
      });

      box.appendChild(row);
    });

    setHidden(byId("hintBox"), true);
    setHidden(byId("qMsg"), true);

    show("screen-question");
  };

  const renderFeedback = () => {
    const { currentSet, idx, answers } = App.state;
    const q = currentSet[idx];
    if (!q) return;

    const saved = answers[idx];
    if (!saved) return; // renderFeedback debe venir tras "Aplicar"

    const selected = saved.selected;

    byId("fTitle").textContent = `Corrección — ${q.topic}`;
    byId("fMeta").innerHTML = q.code ? `<span class="code">COD: ${q.code}</span>` : "";
    byId("fText").innerHTML = `<div style="white-space:normal;"><b>PREGUNTA:</b> ${q.question}</div>`;

    const box = byId("fOptions");
    box.innerHTML = "";

    q.options.forEach((o) => {
      const row = document.createElement("div");
      row.className = "opt";

      const optionIsCorrect = q.answer && (o.key === q.answer);
      const optionIsUser = selected && (o.key === selected);

      if (optionIsCorrect) row.classList.add("correct");
      else if (optionIsUser) row.classList.add("wrong");

      let badge = "";
      if (optionIsCorrect && optionIsUser) badge = " ✅ (Tu selección y correcta)";
      else if (optionIsCorrect) badge = " ✅ (Correcta)";
      else if (optionIsUser) badge = " ❌ (Tu selección)";

      row.innerHTML = `<div style="white-space:normal;"><b>${o.key}:</b> ${o.text} <b>${badge}</b></div>`;
      box.appendChild(row);
    });

    const norma = q.norma || "";
    if (norma.trim()) {
      byId("fNorma").innerHTML = `<b>NORMA:</b> ${norma}`;
      setHidden(byId("fNorma"), false);
    } else {
      setHidden(byId("fNorma"), true);
    }

    show("screen-feedback");
  };

  const renderSummary = () => {
    const { startTime, endTime, answers, currentSet } = App.state;
    const { minutes, seconds } = App.utils.formatDurationMs(endTime - startTime);

    const answered = answers.filter((a) => a !== null);
    const correct = answered.filter((a) => a.correct).length;
    const wrong = answered.filter((a) => !a.correct).length;
    const skipped = answers.length - answered.length;

    byId("sumTime").textContent = `⏱️ Tiempo: ${minutes}m ${seconds}s`;
    byId("sumCorrect").textContent = `✅ Correctas: ${correct}`;
    byId("sumWrong").textContent = `❌ Incorrectas: ${wrong}`;

    const sumSkipped = byId("sumSkipped");
    if (sumSkipped) sumSkipped.textContent = `⏭️ Sin responder: ${skipped}`;

    // Selector coloreado en el resumen
    if (byId("sumJumpSelect")) {
      renderJumpSelect("sumJumpSelect");
    }

    if (!currentSet.length) return;

    show("screen-summary");
  };

  App.render = { renderQuestion, renderFeedback, renderSummary, renderJumpSelect };
})();
