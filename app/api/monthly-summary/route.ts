import { and, eq, gte, lt } from "drizzle-orm";
import { getDb } from "../../../db";
import { dreams, monthlySummaries } from "../../../db/schema";
import type { DreamAnalysis, MonthlySummary } from "../../dream-types";
import { canAccessDreamOwner } from "../../supabase-auth";

const mostCommon = (values: string[], fallback: string) => {
  const counts = new Map<string, { label: string; count: number }>();
  for (const value of values.filter(Boolean)) {
    const key = value.toLocaleLowerCase("tr-TR");
    const current = counts.get(key);
    counts.set(key, { label: value, count: (current?.count || 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)[0]?.label || fallback;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as { deviceId?: unknown; month?: unknown; refresh?: unknown };
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    const month = typeof body.month === "string" ? body.month : "";
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(deviceId) || !/^\d{4}-\d{2}$/.test(month)) return Response.json({ error: "Özet isteği geçersiz." }, { status: 400 });
    if (!(await canAccessDreamOwner(request, deviceId))) return Response.json({ error: "Oturum doğrulanamadı." }, { status: 401 });

    const [year, monthNumber] = month.split("-").map(Number);
    const start = new Date(Date.UTC(year, monthNumber - 1, 1)).toISOString();
    const end = new Date(Date.UTC(year, monthNumber, 1)).toISOString();
    const db = getDb();
    const rows = await db.select().from(dreams).where(and(eq(dreams.deviceId, deviceId), gte(dreams.createdAt, start), lt(dreams.createdAt, end)));
    if (!rows.length) return Response.json({ error: "Bu ay için henüz rüya kaydı yok." }, { status: 400 });

    const cached = await db.select().from(monthlySummaries).where(eq(monthlySummaries.id, `${deviceId}:${month}`)).limit(1);
    if (!body.refresh && cached[0]?.entryCount === rows.length) return Response.json(JSON.parse(cached[0].summary));

    const analyses = rows.map((row) => JSON.parse(row.analysis || "{}") as Partial<DreamAnalysis>);
    const symbols = analyses.flatMap((analysis) => analysis.symbols?.map((item) => item.symbol) || []);
    const moods = rows.map((row, index) => row.mood || analyses[index]?.emotionalTheme || "").filter(Boolean);
    const topSymbol = mostCommon(symbols, "Belirgin sembol yok");
    const topMood = mostCommon(moods, "Belirgin duygu yok");
    const base = { dreamCount: rows.length, topSymbol, topMood };

    let ai = { headline: `${rows.length} rüyalık bir ay`, narrative: `Bu ay ${rows.length} rüya kaydettin. En sık görülen sembol ${topSymbol}, en baskın duygu ise ${topMood}.`, pattern: "Rüyaların bu ayki ortak yönlerini kendi yaşamındaki gelişmelerle birlikte düşünmek faydalı olabilir.", reflection: "Bu ayın rüyaları sana en çok hangi ihtiyacını hatırlatıyor?" };
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const prompt = `Aşağıdaki aylık rüya günlüğü istatistiklerinden Türkçe, nazik ve kesin hüküm vermeyen bir aylık özet oluştur. Yalnızca geçerli JSON döndür. Şema: {"headline":"kısa başlık","narrative":"3 cümlelik özet","pattern":"tekrarlayan tema hakkında 1-2 cümle","reflection":"tek düşündürücü soru"}. İstatistikler: ${JSON.stringify({ ...base, entries: rows.map((row, index) => ({ title: row.title, mood: row.mood, symbols: analyses[index]?.symbols?.map((item) => item.symbol) || [] })) })}`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || "gemini-3.1-flash-lite")}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: .55 } }) });
      if (response.ok) {
        const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const text = data.candidates?.flatMap((candidate) => candidate.content?.parts || []).map((part) => part.text || "").join("").replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        if (text) ai = { ...ai, ...JSON.parse(text) };
      }
    }

    const result: MonthlySummary = { ...base, ...ai };
    await db.insert(monthlySummaries).values({ id: `${deviceId}:${month}`, deviceId, month, entryCount: rows.length, summary: JSON.stringify(result), updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: monthlySummaries.id, set: { entryCount: rows.length, summary: JSON.stringify(result), updatedAt: new Date().toISOString() } });
    return Response.json(result);
  } catch {
    return Response.json({ error: "Aylık özet hazırlanamadı." }, { status: 500 });
  }
}
