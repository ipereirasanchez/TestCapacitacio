// js/app.render.js
(() => {
  window.App = window.App || {};

  const byId = App.dom.byId;
  const setHidden = App.dom.setHidden;
  const show = App.dom.show;

  /* ---------- Render Question (Single View) ---------- */
  const renderQuestion = () => {
    const { currentSet, idx, answers } = App.state;
    const q = currentSet[idx];
    if (!q) return;

    const isCaso = Array.isArray(q.scenario);

    // Set Meta Info
    byId("qTitle").textContent = `${isCaso ? "Caso" : "Pregunta"} ${idx + 1} — ${q.topic}`;
    byId("qMeta").innerHTML = q.code ? `<span class="code">COD: ${q.code}</span>` : "";

    // Configurar acción principal
    const mainBtn = byId("mainActionBtn");
    const finishBtn = byId("finishBtn");
    const saved = answers[idx];

    // Lógica botón principal: 
    if (saved) {
      // Si ya contestada, botón permite avanzar
      if (idx < currentSet.length - 1) {
        mainBtn.textContent = "Siguiente Pregunta";
        mainBtn.onclick = App.actions.nextQuestion;
        setHidden(finishBtn, !App.state.isExamMode);
      } else {
        mainBtn.textContent = "Finalizar Test";
        mainBtn.onclick = () => App.actions.finishTest();
        setHidden(finishBtn, true); // Main button becomes Finish
      }
      mainBtn.className = "primary";
    } else {
      // Si no contestada, botón permite comprobar
      mainBtn.textContent = "Comprobar";
      mainBtn.onclick = App.actions.applyAnswer;
      // En modo examen, mostrar botón finalizar test secundario
      setHidden(finishBtn, !App.state.isExamMode);
    }

    // Ocultar pista en modo examen //
    setHidden(byId("hintBtn"), App.state.isExamMode);

    // Renderizado Texto (un caso trae el enunciado en párrafos)
    byId("qText").innerHTML = isCaso
      ? `<div class="scenario">${q.scenario.map((p) => `<p>${p}</p>`).join("")}</div>`
      : `<div style="white-space:normal;">${q.question}</div>`;

    // Renderizado de opciones
    const optsContainer = byId("qOptions");
    optsContainer.innerHTML = "";

    q.options.forEach((optData, i) => {
      // optData es {key: 'A', text: '...'}
      // saved es { selected: 'A', correct: boolean } | null

      const isSelected = (saved && saved.selected === optData.key) || (App.state.userSelected === optData.key);
      const isCorrectAnswer = (optData.key === q.answer);

      const div = document.createElement("div");
      div.className = isCaso ? "opt caso" : "opt";

      if (saved) {
        // Ya respondida
        if (App.state.isExamMode) {
          // En modo examen, solo marcamos la seleccionada sin colores de éxito/error
          if (isSelected) div.style.borderColor = "var(--primary)";
        } else {
          // Modo práctica: Feedback visual en las opciones
          if (isCorrectAnswer) div.classList.add("correct");
          else if (isSelected) div.classList.add("wrong");
        }
        div.style.pointerEvents = "none"; // Bloquear cambios
      } else {
        // Aún no respondida
        if (isSelected) {
          div.style.borderColor = "var(--primary)";
          div.style.background = "#f5f3ff";
        }
        div.onclick = () => {
          App.state.userSelected = optData.key; // Guardamos la KEY ('A', 'B')
          App.render.renderQuestion();
        };
      }

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "qOption";
      radio.checked = isSelected;
      radio.disabled = !!saved;

      const span = document.createElement("span");
      if (isCaso) {
        // Alternativa compuesta: una respuesta por sub-pregunta (a, b, c)
        const items = optData.items || [];
        span.innerHTML = items.length > 1
          ? `<b>${optData.key}</b><ol class="opt-items">${items.map((t) => `<li>${t}</li>`).join("")}</ol>`
          : `<b>${optData.key}:</b> ${items[0] || ""}`;
      } else {
        span.innerHTML = `<b>${optData.key}:</b> ${optData.text}`;
      }

      div.appendChild(radio);
      div.appendChild(span);
      optsContainer.appendChild(div);
    });

    // Actualizar barra de progreso
    const progWrap = byId("prog-wrap");
    const pBar = byId("pBar");
    if (progWrap && pBar) {
      setHidden(progWrap, false);
      const percent = ((idx + 1) / currentSet.length) * 100;
      pBar.style.width = `${percent}%`;
    }

    // Renderizar Feedback Inline si existe respuesta y NO es modo examen
    const inlineBox = byId("inlineFeedback");
    inlineBox.innerHTML = "";
    setHidden(inlineBox, true);

    if (saved && !App.state.isExamMode) {
      renderInlineFeedback(saved, q);
    }

    setHidden(byId("hintBox"), true);
    setHidden(byId("qMsg"), true);

    show("screen-question");

    // Actualizar Navegación Inferior y cronómetro
    renderBottomNav();
    App.actions.startTimer();
  };

  /* ---------- Render Timer (cuenta atrás en la barra inferior) ---------- */
  const renderTimer = (remainingMs) => {
    const el = byId("navTimer");
    if (!el) return;
    if (remainingMs === null || remainingMs === undefined) { setHidden(el, true); return; }
    const total = Math.max(0, Math.floor(remainingMs / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    el.textContent = `⏱ ${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    el.classList.toggle("warn", remainingMs < 5 * 60 * 1000);
    setHidden(el, false);
  };

  /* ---------- Render Inline Feedback ---------- */
  const renderInlineFeedback = (saved, q) => {
    const box = byId("inlineFeedback");
    const isCorrect = saved.correct;

    box.className = `feedback-box ${isCorrect ? 'correct' : 'wrong'}`;
    box.innerHTML = `
       <div class="feedback-title">
         ${isCorrect ?
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg> Correcto` :
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Incorrecto`
      }
       </div>
       <div><b>Norma:</b> ${q.norma || "Sin explicación disponible."}</div>
       ${q.referencia ? `<div class="muted" style="margin-top:6px;"><b>Referencia doctrinal:</b> ${q.referencia}</div>` : ""}
     `;
    setHidden(box, false);
  };

  /* ---------- Render Bottom Nav ---------- */
  const renderBottomNav = () => {
    const nav = byId("bottomNav");
    setHidden(nav, false);

    const indicator = byId("navIndicator");
    indicator.textContent = `Pregunta ${App.state.idx + 1} / ${App.state.currentSet.length}`;
    (byId("navCenter") || indicator).onclick = () => openNavGrid();

    const prevBtn = byId("navPrev");
    prevBtn.onclick = () => App.actions.jumpToQuestion(App.state.idx - 1);

    // Disable Prev if first
    if (App.state.idx === 0) {
      prevBtn.style.opacity = "0.3";
      prevBtn.style.pointerEvents = "none";
    } else {
      prevBtn.style.opacity = "1";
      prevBtn.style.pointerEvents = "auto";
    }

    const nextBtn = byId("navNext");
    nextBtn.onclick = () => App.actions.jumpToQuestion(App.state.idx + 1);

    // Disable Next if last
    if (App.state.idx === App.state.currentSet.length - 1) {
      nextBtn.style.opacity = "0.3";
      nextBtn.style.pointerEvents = "none";
    } else {
      nextBtn.style.opacity = "1";
      nextBtn.style.pointerEvents = "auto";
    }
  };

  /* ---------- Render Grid Modal ---------- */
  const openNavGrid = () => {
    const modal = byId("navGridModal");
    const grid = byId("navGrid");
    grid.innerHTML = "";

    App.state.currentSet.forEach((_, i) => {
      const item = document.createElement("div");
      item.className = "grid-item";
      item.textContent = i + 1;

      const ans = App.state.answers[i];
      if (i === App.state.idx) item.classList.add("current");

      if (ans) {
        if (App.state.isExamMode) item.classList.add("answered"); // Neutral styling handled in CSS
        else item.classList.add(ans.correct ? "correct" : "wrong");
      }

      item.onclick = () => {
        App.actions.jumpToQuestion(i);
        closeNavGrid();
      };

      grid.appendChild(item);
    });

    modal.classList.add("active");
  };

  const closeNavGrid = () => {
    byId("navGridModal").classList.remove("active");
  };

  /* ---------- Render Summary ---------- */
  const fmt = (n, digits = 1) => Number(n).toLocaleString("es-ES", { maximumFractionDigits: digits });

  const renderSummary = () => {
    App.actions.stopTimer();
    setHidden(byId("bottomNav"), true); // Hide nav in summary 

    const { startTime, endTime, answers, currentSet, kind } = App.state;
    const end = endTime || Date.now();
    const { minutes, seconds } = App.utils.formatDurationMs(end - startTime);
    const isCaso = kind === "caso";

    const sc = App.scoring.score(kind, answers);

    byId("sumTitle").textContent = isCaso ? "Resumen de los casos prácticos" : "Resumen del test";
    byId("sumTime").textContent = `Tiempo total: ${minutes}m ${seconds}s`;
    byId("sumCorrect").textContent = sc.correct;
    byId("sumWrong").textContent = sc.wrong;
    byId("sumBlank").textContent = sc.blank;

    byId("sumScore").textContent = `Puntuación oficial: ${fmt(sc.points)} / ${sc.max} (${fmt(sc.pct)} %)`;
    const verdict = byId("sumVerdict");
    verdict.textContent = sc.passed ? "Parte superada (≥ 50 %)" : "Parte no superada (< 50 %)";
    verdict.className = `score-verdict ${sc.passed ? "pass" : "fail"}`;

    // Desglose por tema
    const rows = App.scoring.topicBreakdown(currentSet, answers);
    byId("sumTopics").innerHTML = `
      <table class="stats">
        <thead><tr><th>Tema</th><th class="num">Aciertos</th><th class="num">Fallos</th><th class="num">Blanco</th><th class="num">%</th></tr></thead>
        <tbody>${rows.map((r) => {
          const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
          return `<tr><td>${r.topic}</td><td class="num">${r.correct}</td><td class="num">${r.wrong}</td><td class="num">${r.blank}</td><td class="num" style="color:${pct >= 50 ? "var(--success)" : "var(--danger)"}; font-weight:700;">${pct}%</td></tr>`;
        }).join("")}</tbody>
      </table>`;

    // Ocultar barra de progreso
    setHidden(byId("prog-wrap"), true);

    if (!currentSet.length) return;

    show("screen-summary");
  };

  /* ---------- Render History ---------- */
  const renderHistoryTable = () => {
    const container = byId("historyTableContainer");
    if (!container) return;

    const history = App.utils.storage.get("history") || [];
    if (history.length === 0) {
      container.innerHTML = '<p class="muted">Aún no hay resultados registrados.</p>';
      return;
    }

    let html = `
      <table class="stats" style="margin-top:10px;">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th class="num">Nota</th>
            <th class="num">Puntos</th>
          </tr>
        </thead>
        <tbody>
    `;

    history.forEach((h) => {
      const date = new Date(h.date).toLocaleDateString();
      // Entradas antiguas (sin kind/points): se muestran como test y sin puntos.
      const kindLabel = h.kind === "caso" ? "Casos" : "Test";
      const pct = Number.isFinite(h.pct) ? h.pct : Math.round((h.correct / h.total) * 100);
      const points = Number.isFinite(h.points) ? `${fmt(h.points)} / ${h.max}` : "—";

      html += `
        <tr>
          <td>${date}</td>
          <td>${kindLabel}</td>
          <td class="num">
            <span style="color:${pct >= 50 ? 'var(--success)' : 'var(--danger)'}; font-weight:700;">${fmt(pct)}%</span>
            <span class="muted" style="font-size:0.8em">(${h.correct}/${h.total})</span>
          </td>
          <td class="num">${points}</td>
        </tr>
      `;
    });

    html += "</tbody></table>";
    container.innerHTML = html;
  };

  /* ---------- Render Bank Meta (pie de inicio) ---------- */
  const renderBankMeta = () => {
    const el = byId("bankMeta");
    const m = App.state.META;
    if (!el) return;
    if (!m) { el.textContent = ""; return; }
    const [y, mo, d] = (m.updated || "").split("-");
    const date = y ? `${d}/${mo}/${y}` : "fecha desconocida";
    el.textContent = `Banco oficial del ${date} · ${m.preguntas} preguntas · ${m.casos} casos prácticos`;
  };

  App.render = {
    renderBankMeta,
    renderQuestion,
    renderTimer,
    renderSummary,
    renderHistoryTable,
    openNavGrid,
    closeNavGrid
  };
})();
