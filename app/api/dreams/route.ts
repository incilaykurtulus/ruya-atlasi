import { and, desc, eq, gte, lt } from "drizzle-orm";
import { getDb } from "../../../db";
import { dreams } from "../../../db/schema";
import { canAccessDreamOwner } from "../../supabase-auth";

const validDeviceId = (value: string) => /^[a-zA-Z0-9-]{16,80}$/.test(value);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId") || "";
    const month = searchParams.get("month") || "";
    if (!validDeviceId(deviceId)) return Response.json({ error: "Geçersiz cihaz kimliği." }, { status: 400 });
    if (!(await canAccessDreamOwner(request, deviceId))) return Response.json({ error: "Bu rüya defterine erişim iznin yok." }, { status: 401 });

    const db = getDb();
    const conditions = [eq(dreams.deviceId, deviceId)];
    if (/^\d{4}-\d{2}$/.test(month)) {
      const [year, monthNumber] = month.split("-").map(Number);
      const start = new Date(Date.UTC(year, monthNumber - 1, 1)).toISOString();
      const end = new Date(Date.UTC(year, monthNumber, 1)).toISOString();
      conditions.push(gte(dreams.createdAt, start), lt(dreams.createdAt, end));
    }
    const rows = await db.select().from(dreams).where(and(...conditions)).orderBy(desc(dreams.createdAt)).limit(240);
    return Response.json(rows.map((row) => ({ ...row, analysis: row.analysis ? JSON.parse(row.analysis) : null })));
  } catch {
    return Response.json({ error: "Rüya defteri şu anda açılamıyor." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id.slice(0, 80) : "";
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    const dream = typeof body.dream === "string" ? body.dream.trim().slice(0, 3000) : "";
    const mood = typeof body.mood === "string" ? body.mood.trim().slice(0, 40) : "";
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "Rüya Kaydı";
    const createdAt = typeof body.createdAt === "string" && !Number.isNaN(Date.parse(body.createdAt)) ? body.createdAt : new Date().toISOString();
    const analysis = JSON.stringify(body.analysis || {}).slice(0, 12000);
    if (!id || !validDeviceId(deviceId) || dream.length < 3) return Response.json({ error: "Rüya kaydı eksik." }, { status: 400 });
    if (!(await canAccessDreamOwner(request, deviceId))) return Response.json({ error: "Oturum doğrulanamadı." }, { status: 401 });

    const db = getDb();
    await db.insert(dreams).values({ id, deviceId, dream, mood, title, analysis, createdAt }).onConflictDoNothing();
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json({ error: "Rüya kaydedilemedi." }, { status: 500 });
  }
}
