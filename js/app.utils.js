// js/app.utils.js
(() => {
  window.App = window.App || {};

  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const sample = (arr, n) => {
    if (arr.length <= n) return shuffle(arr);
    return shuffle(arr).slice(0, n);
  };

  const formatDurationMs = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes, seconds };
  };

  const storage = {
    set: (key, val) => localStorage.setItem(`test_cap_${key}`, JSON.stringify(val)),
    get: (key) => {
      const v = localStorage.getItem(`test_cap_${key}`);
      return v ? JSON.parse(v) : null;
    },
    remove: (key) => localStorage.removeItem(`test_cap_${key}`),
  };

  App.utils = { shuffle, sample, formatDurationMs, storage };
})();
