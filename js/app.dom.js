// js/app.dom.js
(() => {
  window.App = window.App || {};

  const byId = (id) => document.getElementById(id);

  const setHidden = (el, hidden) => {
    if (!el) return;
    el.classList.toggle("hidden", hidden);
  };

  const show = (screenId) => {
    const screens = ["screen-setup", "screen-question", "screen-feedback", "screen-summary"];
    screens.forEach((s) => {
      const el = byId(s);
      if (el) el.classList.add("hidden");
    });
    const target = byId(screenId);
    if (target) target.classList.remove("hidden");
  };

  App.dom = { byId, setHidden, show };
})();
