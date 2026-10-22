// js/app.init.js
(() => {
  window.App = window.App || {};

  (async function init() {
    // 1) Conectar eventos
    App.events.bindEvents();

    // 2) Cargar banco de preguntas
    try {
      const url = new URL("data/preguntas.json", document.baseURI);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} al cargar data/preguntas.json`);

      App.state.BANK = await res.json();

      const status = App.dom.byId("status");
      if (status) status.textContent = `Banco cargado: ${App.state.BANK.length} preguntas.`;

      App.actions.fillTopicsSelect();
      App.render.renderHistoryTable();

      // 3) Iniciar en Dashboard
      // La lógica de mostrar botón reanudar ya está en initDashboard
      App.actions.initDashboard();

    } catch (e) {
      console.error(e);
      const status = App.dom.byId("status");
      if (status) status.textContent = "Error cargando data/preguntas.json. Sirve la carpeta por HTTP (p. ej. python3 -m http.server).";
    }
  })();
})();
