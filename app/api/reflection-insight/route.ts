type ReflectionInsight = {
  meaning: string;
  advice: string;
  affirmation: string;
  disclaimer: string;
  demo?: boolean;
};

const disclaimer = "Bu değerlendirme kişisel farkındalık içindir; profesyonel psikolojik destek veya tıbbi tavsiye yerine geçmez.";

function demoInsight(answer: string): ReflectionInsight {
  const shortAnswer = answer.length > 120 ? `${answer.slice(0, 117)}…` : answer;
  return {
    meaning: `Yanıtındaki “${shortAnswer}” ifadesi, rüyadaki temanın günlük hayatındaki bir duyguya temas ettiğini düşündürüyor olabilir. Buradaki asıl ipucu, olayın kendisinden çok sende bıraktığı his olabilir.`,
    advice: "Bugün bu duyguyu değiştirmeye çalışmadan birkaç dakika gözlemle. Ardından kontrol edebildiğin en küçük adımı seçip bunu kısa bir not olarak rüya günlüğüne ekleyebilirsin.",
    affirmation: "Hislerimi yargılamadan dinleyebilir ve bana iyi gelen küçük adımı seçebilirim.",
    disclaimer,
    demo: true,
  };
}

function cleanJson(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
}

function parseInsight(text: string): ReflectionInsight {
  const parsed = JSON.parse(cleanJson(text)) as Partial<ReflectionInsight>;
  if (!parsed.meaning || !parsed.advice || !parsed.affirmation) throw new Error("Invalid insight shape");
  return {
    meaning: String(parsed.meaning).slice(0, 900),
    advice: String(parsed.advice).slice(0, 700),
    affirmation: String(parsed.affirmation).slice(0, 300),
    disclaimer,
  };
}

export async function POST(request: Request) {
  try {
    const authorization = await authorizeAiRequest(request, { action: "reflection", userLimit: 40, ipLimit: 80 });
    if (authorization.response) return authorization.response;
    const parsed = await readJsonRequest<Record<string, unknown>>(request, 32_768);
    if (parsed.response) return parsed.response;
    const body = parsed.data;
    const dream = typeof body.dream === "string" ? body.dream.trim().slice(0, 3000) : "";
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 700) : "";
    const answer = typeof body.answer === "string" ? body.answer.trim().slice(0, 1500) : "";
    const summary = typeof body.summary === "string" ? body.summary.trim().slice(0, 1200) : "";
    const emotionalTheme = typeof body.emotionalTheme === "string" ? body.emotionalTheme.trim().slice(0, 120) : "";

    if (answer.length < 3) return Response.json({ error: "Duygu ve düşüncelerini birkaç kelimeyle anlatmalısın." }, { status: 400 });
    if (!dream || !question) return Response.json({ error: "Rüya değerlendirmesi eksik görünüyor." }, { status: 400 });

    const prompt = `Sen şefkatli, temkinli ve sembolik düşünen bir kişisel farkındalık rehberisin. Türkçe yaz. Aşağıdaki rüya, rüya yorumu, düşünme sorusu ve kullanıcının kendi yanıtını birlikte değerlendir. Kehanet, teşhis veya kesin gerçek sunma. Kullanıcının sözlerini abartmadan yansıt; rüyada olmayan ayrıntıları uydurma. Kısa ama kişiye dönük bir olası anlam, bugün uygulanabilecek küçük ve güvenli bir öneri ve tek cümlelik bir güçlendirici ifade üret. Eğer yanıtta kendine veya başkasına zarar verme niyeti seziliyorsa sıradan tavsiye verme; kişiyi hemen güvendiği birine ve yerel acil yardım hizmetlerine ulaşmaya teşvik et. Yalnızca geçerli JSON döndür, markdown kullanma.

Şema: {"meaning":"2-3 cümlelik olasılıklı kişisel anlam","advice":"2-3 cümlelik küçük ve uygulanabilir öneri","affirmation":"tek cümlelik güçlendirici ifade"}

Rüya: ${dream}
Önceki yorum: ${summary}
Baskın tema: ${emotionalTheme}
Kendine sor sorusu: ${question}
Kullanıcının cevabı: ${answer}`;

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.65 },
        }),
      });
      if (!response.ok) return Response.json({ error: "Kişisel değerlendirme şu anda oluşturulamadı." }, { status: 502 });
      const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = data.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text ?? "").join("").trim() ?? "";
      return Response.json(parseInsight(text));
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json(demoInsight(answer));

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5-mini", input: prompt }),
    });
    if (!response.ok) return Response.json({ error: "Kişisel değerlendirme şu anda oluşturulamadı." }, { status: 502 });
    const data = await response.json() as { output?: Array<{ content?: Array<{ text?: string }> }> };
    const text = data.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("").trim() ?? "";
    return Response.json(parseInsight(text));
  } catch {
    return Response.json({ error: "Yanıtın değerlendirilirken beklenmedik bir sorun oluştu." }, { status: 500 });
  }
}
import { authorizeAiRequest, readJsonRequest } from "../../security";
