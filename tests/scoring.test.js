const test = require("node:test");
const assert = require("node:assert/strict");
const scoring = require("../js/app.scoring.js");

test("test scoring: +1 per correct, -1/3 per wrong, blank 0", () => {
  const r = scoring.score("test", [{ selected: "A", correct: true }, { selected: "B", correct: false }, null]);
  assert.equal(r.points.toFixed(4), (1 - 1 / 3).toFixed(4));
  assert.equal(r.max, 3);
  assert.equal(r.correct, 1);
  assert.equal(r.wrong, 1);
  assert.equal(r.blank, 1);
});

test("caso scoring: +50 per correct, -50/3 per wrong, pass at 50%", () => {
  const r = scoring.score("caso", [{ correct: true }, { correct: true }, { correct: false }, null]);
  assert.equal(r.max, 200);
  assert.equal(r.points.toFixed(2), (100 - 50 / 3).toFixed(2));
  assert.equal(r.pct, 41.7);
  assert.equal(r.passed, false);
});

test("exactly 50% passes", () => {
  const r = scoring.score("test", [{ correct: true }, null]);
  assert.equal(r.pct, 50);
  assert.equal(r.passed, true);
});

test("all blank gives zero and no NaN", () => {
  const r = scoring.score("test", [null, null]);
  assert.equal(r.points, 0);
  assert.equal(r.pct, 0);
  assert.equal(r.passed, false);
  const b = scoring.topicBreakdown([{ topic: "A" }, { topic: "A" }], [null, null]);
  assert.deepEqual(b, [{ topic: "A", total: 2, correct: 0, wrong: 0, blank: 2 }]);
});

test("empty answer list does not divide by zero", () => {
  const r = scoring.score("test", []);
  assert.equal(r.max, 0);
  assert.equal(r.pct, 0);
  assert.equal(r.passed, false);
});

test("points never below zero", () => {
  assert.equal(scoring.score("test", [{ correct: false }]).points, 0);
});

test("topicBreakdown groups and sorts by topic", () => {
  const items = [{ topic: "B. x" }, { topic: "A. y" }, { topic: "B. x" }];
  const answers = [{ correct: true }, { correct: false }, null];
  assert.deepEqual(scoring.topicBreakdown(items, answers), [
    { topic: "A. y", total: 1, correct: 0, wrong: 1, blank: 0 },
    { topic: "B. x", total: 2, correct: 1, wrong: 0, blank: 1 },
  ]);
});

test("itemKey namespaces by kind", () => {
  assert.equal(scoring.itemKey("caso", "1A02001"), "caso:1A02001");
  assert.equal(scoring.itemKey("test", "1A02001"), "test:1A02001");
});

test("TIME_LIMIT_MS is two hours", () => {
  assert.equal(scoring.TIME_LIMIT_MS, 7200000);
});
