let BANK = [];
let currentSet = [];
let idx = 0;
let userSelected = null;

const $ = (id) => document.getElementById(id);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample(arr, n) {
  if (arr.length <= n) return shuffle(arr);
  return shuffle(arr).slice(0, n);
}

function show(id) {
  ["screen-setup", "screen-question", "screen-feedback"].forEach(s => $(s).classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function setHidden(el, hidden) {
  el.classList.toggle("hidden", hidden);
}

function topicsFromBank() {
  return Array.from(new Set(BANK.map(q => q.topic))).sort();
}

function fillTopicsSelect() {
  const sel = $("topics");
  sel.innerHTML = "";
  topicsFromBank().forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    sel.appendChild(opt);
  });
  if (sel.options.length > 0) sel.options[0].selected = true;
}

function getSelectedTopics() {
  const sel = $("topics");
  return Array.from(sel.selectedOptions).map(o => o.value);
}

// Enlace a nota POR NORMA (norma_id)
function noteHref(q) {
  const id = (q.norma_id && String(q.norma_id).trim()) ? String(q.norma_id).trim() : "sin-norma";
  const t = encodeURIComponent(q.norma || "");
  return `note.html?id=${encodeURIComponent(id)}&t=${t}`;
}

function renderQuestion() {
  const q = currentSet[idx];
  userSelected = null;

  $("qTitle").textContent = `Pregunta — ${q.topic}`;
  $("qMeta").innerHTML = q.code ? `<span class="code">COD: ${q.code}</span>` : "";
  $("qCounter").textContent = `${idx + 1} / ${currentSet.length}`;

  $("qText").innerHTML = `<div style="white-space:normal;"><b>PREGUNTA:</b> ${q.question}</div>`;

  // opciones
  const box = $("qOptions");
  box.innerHTML = "";

  // defensa: si vinieran sin opciones
  if (!q.options || !q.options.length) {
    $("qMsg").innerHTML = "<b>Esta pregunta no tiene opciones detectadas.</b>";
    setHidden($("qMsg"), false);
  } else {
    setHidden($("qMsg"), true);
  }

  (q.options || []).forEach(o => {
    const row = document.createElement("label");
    row.className = "opt";
    row.innerHTML = `
      <input type="radio" name="ans" value="${o.key}">
      <div><b>${o.key}:</b> ${o.text}</div>
    `;
    row.querySelector("input").addEventListener("change", (e) => {
      userSelected = e.target.value;
      setHidden($("qMsg"), true);
    });
    box.appendChild(row);
  });

  setHidden($("hintBox"), true);
  show("screen-question");
}

function renderFeedback() {
  const q = currentSet[idx];

  $("fTitle").textContent = `Corrección — ${q.topic}`;
  $("fMeta").innerHTML = q.code ? `<span class="code">COD: ${q.code}</span>` : "";
  $("fText").innerHTML = `<div style="white-space:normal;"><b>PREGUNTA:</b> ${q.question}</div>`;

  const box = $("fOptions");
  box.innerHTML = "";

  (q.options || []).forEach(o => {
    const row = document.createElement("div");
    row.className = "opt";

    const isCorrect = q.answer && (o.key === q.answer);
    const isUser = userSelected && (o.key === userSelected);

    if (isCorrect) row.classList.add("correct");
    else if (isUser) row.classList.add("wrong");

    let badge = "";
    if (isCorrect && isUser) badge = " ✅ (Tu selección y correcta)";
    else if (isCorrect) badge = " ✅ (Correcta)";
    else if (isUser) badge = " ❌ (Tu selección)";

    row.innerHTML = `<div style="white-space:normal;"><b>${o.key}:</b> ${o.text} <b>${badge}</b></div>`;
    box.appendChild(row);
  });

  // NORMA + link a nota (por norma_id)
  const norma = (q.norma || "").trim();
  const link = noteHref(q);

  $("fNorma").innerHTML = `
    <div>${norma ? `<b>NORMA:</b> ${norma}` : "No hay NORMA para esta pregunta."}</div>
    <div style="margin-top:8px;">
      <a href="${link}">${norma ? "Ver/editar nota" : "Crear nota"}</a>
    </div>
  `;
  setHidden($("fNorma"), false);

  show("screen-feedback");
}

function startTest() {
  const mode = $("mode").value;
  const n = parseInt($("n").value || "20", 10);
  const topics = getSelectedTopics();

  let pool = [];

  if (mode === "all200") {
    pool = BANK;
    currentSet = sample(pool, 200);
  } else {
    pool = BANK.filter(q => topics.includes(q.topic));
    if (!pool.length) {
      $("setupMsg").innerHTML = "Selecciona al menos un tema con preguntas.";
      setHidden($("setupMsg"), false);
      return;
    }
    currentSet = sample(pool, Math.max(1, n));
  }

  idx = 0;
  setHidden($("setupMsg"), true);
  renderQuestion();
}

function exitToSetup() {
  currentSet = [];
  idx = 0;
  userSelected = null;
  setHidden($("setupMsg"), true);
  show("screen-setup");
}

function nextQuestion() {
  if (idx < currentSet.length - 1) {
    idx += 1;
    renderQuestion();
  } else {
    $("setupMsg").innerHTML = "Has terminado el test. ✅";
    setHidden($("setupMsg"), false);
    show("screen-setup");
  }
}

// Eventos UI
$("mode").addEventListener("change", () => {
  const isAll = $("mode").value === "all200";
  $("nWrap").style.display = isAll ? "none" : "block";
});

$("startBtn").addEventListener("click", startTest);

$("hintBtn").addEventListener("click", () => {
  const q = currentSet[idx];
  const norma = (q.norma || "").trim();
  const link = noteHref(q);

  if (norma) {
    $("hintBox").innerHTML = `
      <div><b>NORMA:</b> ${norma}</div>
      <div style="margin-top:8px;">
        <a href="${link}">Ver/editar nota</a>
      </div>
    `;
  } else {
    $("hintBox").innerHTML = `
      <div>No hay NORMA para esta pregunta.</div>
      <div style="margin-top:8px;">
        <a href="${link}">Crear nota</a>
      </div>
    `;
  }
  setHidden($("hintBox"), false);
});

$("applyBtn").addEventListener("click", () => {
  if (!userSelected) {
    $("qMsg").innerHTML = "<b>Selecciona una respuesta antes de aplicar.</b>";
    setHidden($("qMsg"), false);
    return;
  }
  renderFeedback();
});

$("exitBtn1").addEventListener("click", exitToSetup);
$("exitBtn2").addEventListener("click", exitToSetup);
$("nextBtn").addEventListener("click", nextQuestion);

// Carga del banco
(async function init() {
  try {
    const res = await fetch("questions.json", { cache: "no-store" });
    BANK = await res.json();

    $("status").textContent = `Banco cargado: ${BANK.length} preguntas.`;
    fillTopicsSelect();
    show("screen-setup");
  } catch (e) {
    console.error(e);
    $("status").textContent = "Error cargando questions.json. Asegúrate de que está en el mismo directorio del repo.";
  }
})();
