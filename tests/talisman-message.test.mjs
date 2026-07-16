import assert from "node:assert/strict";
import test from "node:test";
import { getDailyTalismanMessage } from "../app/talisman-message.ts";

test("keeps Tılsım's message stable throughout the same day", () => {
  const first = getDailyTalismanMessage("2026-07-16", []);
  const second = getDailyTalismanMessage("2026-07-16", []);
  assert.equal(first, second);
  assert.ok(first.length > 30);
});

test("personalizes the daily message with the latest dream", () => {
  const message = getDailyTalismanMessage("2026-07-16", [{
    id: "dream-1",
    deviceId: "user-1",
    dream: "Denizde yüzüyordum.",
    mood: "Merak",
    title: "Deniz",
    createdAt: "2026-07-16T08:00:00.000Z",
    analysis: {
      title: "Deniz",
      summary: "",
      emotionalTheme: "Huzur",
      emotionSpectrum: [{ emotion: "Huzur", intensity: 70 }, { emotion: "Merak", intensity: 30 }],
      symbols: [{ symbol: "Deniz", meaning: "" }],
      reflection: "",
      disclaimer: "",
    },
  }]);

  assert.match(message, /deniz sembolü/);
  assert.match(message, /huzur duygusu/);
});
