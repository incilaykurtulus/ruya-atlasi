import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEmotionPercentages } from "../app/emotion-utils.ts";

test("normalizes dream emotion scores to exactly one hundred percent", () => {
  const result = normalizeEmotionPercentages([
    { emotion: "Huzur", intensity: 75 },
    { emotion: "Merak", intensity: 65 },
    { emotion: "Belirsizlik", intensity: 50 },
    { emotion: "Özgürlük", intensity: 80 },
  ]);

  assert.equal(result.reduce((sum, item) => sum + item.intensity, 0), 100);
  assert.deepEqual(result.map((item) => item.intensity), [28, 24, 18, 30]);
});

test("splits missing scores evenly and still totals one hundred", () => {
  const result = normalizeEmotionPercentages([
    { emotion: "Huzur", intensity: 0 },
    { emotion: "Merak", intensity: Number.NaN },
    { emotion: "Umut", intensity: 0 },
  ]);

  assert.equal(result.reduce((sum, item) => sum + item.intensity, 0), 100);
  assert.deepEqual(result.map((item) => item.intensity), [34, 33, 33]);
});
