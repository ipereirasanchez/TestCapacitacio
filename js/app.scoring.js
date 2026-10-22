// js/app.scoring.js
// Baremo oficial (RD 1211/1990, Anexo II, apdo. 8):
//  - Prueba de preguntas: 1 punto por acierto, -1/3 por fallo, 0 en blanco. Máximo = nº preguntas.
//  - Prueba de casos prácticos: 50 puntos por acierto, -50/3 por fallo. Máximo = 50 · nº casos.
//  - Cada parte se supera con el 50 % de su máximo (el examen exige además el 60 % del total).
// Módulo puro: sin DOM, usable desde Node para tests.
(function (root) {
  const VALUE = { test: 1, caso: 50 };
  const TIME_LIMIT_MS = 2 * 60 * 60 * 1000;

  const round1 = (n) => Math.round(n * 10) / 10;

  const score = (kind, answers) => {
    const value = VALUE[kind] || VALUE.test;
    let correct = 0, wrong = 0, blank = 0;
    (answers || []).forEach((a) => {
      if (!a) blank += 1;
      else if (a.correct) correct += 1;
      else wrong += 1;
    });
    const max = (answers || []).length * value;
    const points = Math.max(0, correct * value - (wrong * value) / 3);
    const pct = max > 0 ? round1((points / max) * 100) : 0;
    return { correct, wrong, blank, points, max, pct, passed: max > 0 && pct >= 50 };
  };

  const topicBreakdown = (items, answers) => {
    const byTopic = new Map();
    (items || []).forEach((item, i) => {
      const t = item.topic;
      if (!byTopic.has(t)) byTopic.set(t, { topic: t, total: 0, correct: 0, wrong: 0, blank: 0 });
      const row = byTopic.get(t);
      row.total += 1;
      const a = answers ? answers[i] : null;
      if (!a) row.blank += 1;
      else if (a.correct) row.correct += 1;
      else row.wrong += 1;
    });
    return Array.from(byTopic.values()).sort((a, b) => a.topic.localeCompare(b.topic));
  };

  const itemKey = (kind, code) => `${kind}:${code}`;

  const scoring = { score, topicBreakdown, itemKey, TIME_LIMIT_MS };

  if (typeof module !== "undefined" && module.exports) module.exports = scoring;
  root.App = root.App || {};
  root.App.scoring = scoring;
})(typeof window !== "undefined" ? window : globalThis);
