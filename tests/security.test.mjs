import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("protects user-owned dreams and authenticated AI requests", async () => {
  const [page, auth, security, analyze, reflection, dreams] = await Promise.all([
    source("app/page.tsx"),
    source("app/supabase-auth.ts"),
    source("app/security.ts"),
    source("app/api/analyze/route.ts"),
    source("app/api/reflection-insight/route.ts"),
    source("app/api/dreams/route.ts"),
  ]);

  assert.doesNotMatch(auth, /if\s*\(!deviceId\.startsWith\("user-"\)\)\s*return true/);
  assert.match(auth, /deviceId === `user-\$\{user\.id\}`/);
  assert.match(page, /Authorization: `Bearer \$\{account\.accessToken\}`/);
  assert.doesNotMatch(page, /\/api\/dreams\/claim/);
  assert.match(security, /status:\s*429/);
  assert.match(security, /CF-Connecting-IP/);
  assert.match(security, /status:\s*413/);
  assert.match(security, /content-type/);
  assert.match(analyze, /authorizeAiRequest/);
  assert.match(reflection, /authorizeAiRequest/);
  assert.match(dreams, /action: "dream-read"/);
  assert.match(dreams, /action: "dream-write"/);
  assert.match(dreams, /status: 403/);
});

test("adds browser security headers and keeps secrets out of source", async () => {
  const [worker, gitignore, wrangler] = await Promise.all([
    source("worker/index.ts"),
    source(".gitignore"),
    source("wrangler.cloudflare.jsonc"),
  ]);

  assert.match(worker, /Content-Security-Policy/);
  assert.match(worker, /frame-ancestors 'none'/);
  assert.match(worker, /X-Content-Type-Options/);
  assert.match(worker, /Referrer-Policy/);
  assert.match(worker, /Permissions-Policy/);
  assert.match(gitignore, /\.env\*/);
  assert.doesNotMatch(wrangler, /GEMINI_API_KEY|OPENAI_API_KEY|SUPABASE_SERVICE_ROLE/);
  await access(new URL("public/mascot/ruya-rehberi.png", root));
});
