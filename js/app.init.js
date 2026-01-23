// js/app.init.js
(() => {
  window.App = window.App || {};

  (async function init() {
    // 1) Conectar eventos (asegúrate de que app.events.js carga sin errores)
    App.events.bindEvents();

    // 2) Cargar banco de preguntas
    try {
      const url = new URL("questions.json", document.baseURI);

      // Logs temporales (puedes borrarlos luego)
      console.log("BASE:", document.baseURI);
      console.log("QUESTIONS URL:", url.toString());

      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} al cargar questions.json`);

      App.state.BANK = await res.json();

      const status = App.dom.byId("status");
      if (status) status.textContent = `Banco cargado: ${App.state.BANK.length} preguntas.`;

      App.actions.fillTopicsSelect();
      App.render.renderHistoryTable();

      // Detectar sesión guardada
      const session = App.utils.storage.get("session");
      if (session) {
        App.dom.setHidden(App.dom.byId("resumeBtn"), false);
      }

      App.dom.show("screen-setup");
    } catch (e) {
      console.error(e);
      const status = App.dom.byId("status");
      if (status) status.textContent = "Error cargando questions.json. Asegúrate de que está en el mismo directorio.";
    }
  })();
})();
