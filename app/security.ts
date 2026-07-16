import { env } from "cloudflare:workers";
import { getSupabaseUser } from "./supabase-auth";

type RateLimitOptions = {
  action: string;
  userLimit: number;
  ipLimit: number;
  windowSeconds?: number;
};

type JsonRequestResult<T> = { data: T; response?: never } | { data?: never; response: Response };

export async function readJsonRequest<T>(request: Request, maxBytes = 32_768): Promise<JsonRequestResult<T>> {
  const contentType = request.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.startsWith("application/json")) {
    return { response: Response.json({ error: "İstek JSON biçiminde olmalı." }, { status: 415 }) };
  }
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { response: Response.json({ error: "İstek boyutu izin verilen sınırı aşıyor." }, { status: 413 }) };
  }
  const reader = request.body?.getReader();
  if (!reader) return { response: Response.json({ error: "İstek gövdesi eksik." }, { status: 400 }) };
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { response: Response.json({ error: "İstek boyutu izin verilen sınırı aşıyor." }, { status: 413 }) };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { data: JSON.parse(new TextDecoder().decode(bytes)) as T };
  } catch {
    return { response: Response.json({ error: "Geçersiz JSON isteği." }, { status: 400 }) };
  }
}

async function fingerprint(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).slice(0, 16).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  const id = `${key}:${windowStart}`;
  const expiresAt = windowStart + windowSeconds;
  await env.DB.prepare("DELETE FROM api_rate_limits WHERE expires_at < ?").bind(now - 86400).run();
  const row = await env.DB.prepare(`
    INSERT INTO api_rate_limits (id, request_count, expires_at)
    VALUES (?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET request_count = request_count + 1
    RETURNING request_count
  `).bind(id, expiresAt).first<{ request_count: number }>();

  return {
    allowed: Number(row?.request_count || 0) <= limit,
    retryAfter: Math.max(1, expiresAt - now),
  };
}

export async function authorizeAiRequest(request: Request, options: RateLimitOptions) {
  const user = await getSupabaseUser(request);
  if (!user) {
    return { response: Response.json({ error: "Bu işlem için hesabına giriş yapmalısın." }, { status: 401 }) };
  }

  const windowSeconds = options.windowSeconds || 3600;
  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const [userKey, ipKey] = await Promise.all([fingerprint(user.id), fingerprint(ip)]);
  const userResult = await consumeRateLimit(`${options.action}:user:${userKey}`, options.userLimit, windowSeconds);
  const ipResult = await consumeRateLimit(`${options.action}:ip:${ipKey}`, options.ipLimit, windowSeconds);
  const blocked = !userResult.allowed || !ipResult.allowed;

  if (blocked) {
    const retryAfter = Math.max(userResult.retryAfter, ipResult.retryAfter);
    return {
      response: Response.json(
        { error: "Çok kısa sürede fazla istek gönderildi. Bir süre sonra tekrar deneyebilirsin." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      ),
    };
  }

  return { user };
}
