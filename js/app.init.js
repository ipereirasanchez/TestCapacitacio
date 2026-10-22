// js/app.init.js
(() => {
  window.App = window.App || {};

  (async function init() {
    // 0) Service worker para uso sin conexión (red primero, caché de respaldo)
    if ("serviceWorker" in navigator) {
      try {
        navigator.serviceWorker.register(new URL("sw.js", document.baseURI).toString()).catch((e) => console.warn("SW:", e));
      } catch (e) { console.warn("SW:", e); }
    }

    // 1) Conectar eventos
    App.events.bindEvents();

    // 2) Cargar banco de preguntas y metadatos (los casos se cargan al usarlos)
    try {
      const load = async (file, required) => {
        const url = new URL(file, document.baseURI);
        const res = await fetch(url.toString(), { cache: "no-store" });
        if (!res.ok) {
          if (required) throw new Error(`HTTP ${res.status} al cargar ${file}`);
          return null;
        }
        return res.json();
      };
      const [bank, meta] = await Promise.all([
        load("data/preguntas.json", true),
        load("data/meta.json", false).catch(() => null),
      ]);
      App.state.BANK = bank;
      App.state.META = meta;

      const status = App.dom.byId("status");
      if (status) status.textContent = `Banco cargado: ${App.state.BANK.length} preguntas.`;
      App.render.renderBankMeta();

      App.actions.fillTopicsSelect("test");
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
