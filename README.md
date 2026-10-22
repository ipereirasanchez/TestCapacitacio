# Test Capacitació

Aplicación web para preparar el examen de **competencia profesional para el transporte de mercancías por carretera** (Ministerio de Transportes). Sin frameworks ni dependencias: HTML, CSS y JavaScript.

Banco oficial de preguntas y casos prácticos publicado por el Ministerio:
https://www.transportes.gob.es/transporte-terrestre/examenes-y-formacion/competencia-profesional

## Qué incluye

- **Preguntas tipo test** (primera prueba del examen): 4 opciones, 8 temas (A–H).
- **Casos prácticos** (segunda prueba): enunciado largo y 8 alternativas de respuesta compuesta.
- **Modos**: por temas con el número que quieras, o *examen completo* (200 preguntas / 4 casos).
- **Examen Rápido** (20 preguntas, corrección al final) y **Simulacro** (200 preguntas, 2 horas, corrección al final).
- **Modo examen** opcional (sin corrección hasta el final) y **cronómetro oficial** de 2 h que corrige al agotarse.
- Se puede **finalizar con preguntas en blanco**, como en el examen real.
- **Puntuación oficial** en el resumen (RD 1211/1990, Anexo II): acierto +1, fallo −1/3, blanco 0 en el test; acierto +50, fallo −50/3 en los casos. La parte se supera con el 50 %. Desglose por tema.
- **Repasar fallos**: las preguntas y casos fallados se acumulan entre sesiones hasta que los aciertas.
- Reanudar el test en curso, historial de resultados y uso **sin conexión** tras la primera carga (service worker).

## Uso

La app carga los datos con `fetch`, así que hay que servir la carpeta por HTTP (abrir `index.html` directamente falla en Chrome):

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Actualizar el banco oficial

El Ministerio revisa el banco periódicamente. Para regenerar los datos desde los ZIP oficiales (preguntas `pm_AAMMDD.zip` y casos `cm_AAMMDD.zip`, enlazados en las páginas "Preguntas mercancías" y "Casos prácticos mercancías"):

```bash
python3 scripts/import_bank.py \
  --pm https://cdn.transportes.gob.es/portal-web-transportes/transporte-terrestre/examenes-competencia/pm_260326.zip \
  --cm https://cdn.transportes.gob.es/portal-web-transportes/transporte-terrestre/examenes-competencia/cm_260326.zip
```

Acepta rutas locales o URLs y reescribe `data/preguntas.json`, `data/casos.json` y `data/meta.json`. La fecha del banco se muestra en el pie de la pantalla de inicio.

## Tests

```bash
python3 -I -m unittest discover -s scripts   # parser del banco
node --test                                   # puntuación oficial
```
