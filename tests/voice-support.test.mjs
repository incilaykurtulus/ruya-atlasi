import assert from "node:assert/strict";
import test from "node:test";
import { getVoiceErrorMessage, isEmbeddedMobileBrowser } from "../app/voice-support.ts";

test("detects WhatsApp and other embedded mobile browsers", () => {
  assert.equal(isEmbeddedMobileBrowser("Mozilla/5.0 WhatsApp/2.26.1"), true);
  assert.equal(isEmbeddedMobileBrowser("Mozilla/5.0 Version/18.0 Mobile Safari/604.1"), false);
});

test("explains common speech recognition failures", () => {
  assert.match(getVoiceErrorMessage("not-allowed"), /Mikrofon erişimine izin verilmedi/);
  assert.match(getVoiceErrorMessage("no-speech"), /Ses duyulamadı/);
  assert.match(getVoiceErrorMessage("network"), /Safari\/Chrome/);
});
