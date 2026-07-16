import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { dreams, monthlySummaries } from "../../../../db/schema";
import { getSupabaseUser } from "../../../supabase-auth";

export async function POST(request: Request) {
  try {
    const user = await getSupabaseUser(request);
    if (!user) return Response.json({ error: "Oturum doğrulanamadı." }, { status: 401 });
    const body = await request.json() as { deviceId?: unknown };
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(deviceId) || deviceId.startsWith("user-")) return Response.json({ error: "Cihaz kaydı geçersiz." }, { status: 400 });

    const db = getDb();
    await db.update(dreams).set({ deviceId: `user-${user.id}` }).where(eq(dreams.deviceId, deviceId));
    await db.delete(monthlySummaries).where(eq(monthlySummaries.deviceId, deviceId));
    return Response.json({ ok: true, ownerId: `user-${user.id}` });
  } catch {
    return Response.json({ error: "Rüyalar hesaba aktarılamadı." }, { status: 500 });
  }
}
