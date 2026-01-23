// js/app.init.js
(() => {
  window.App = window.App || {};

  (async function init() {
    // 1) Conectar eventos
    App.events.bindEvents();

    // 2) Cargar banco de preguntas
    try {
      const url = new URL("questions.json", document.baseURI);
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} al cargar questions.json`);

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
      if (status) status.textContent = "Error cargando questions.json. Asegúrate de que está en el mismo directorio.";
    }
  })();
})();
