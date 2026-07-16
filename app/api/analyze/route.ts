type DreamResult = {
  title: string;
  summary: string;
  emotionalTheme: string;
  emotionSpectrum?: Array<{ emotion: string; intensity: number }>;
  symbols: Array<{ symbol: string; meaning: string }>;
  reflection: string;
  disclaimer: string;
};

const disclaimer = "Bu yorum kişisel farkındalık ve eğlence amaçlıdır; tıbbi ya da psikolojik değerlendirme yerine geçmez.";

function demoAnalysis(dream: string): DreamResult & { demo: true } {
  const normalized = dream.toLocaleLowerCase("tr-TR");
  const catalog = [
    { keys: ["su", "deniz", "nehir", "yağmur"], symbol: "Su", meaning: "Duygusal derinliği, değişimi ve iç dünyanda hareket eden hisleri temsil edebilir." },
    { keys: ["kapı", "anahtar", "pencere"], symbol: "Eşik", meaning: "Yeni bir ihtimale yaklaşmayı, karar vermeyi veya hayatında açılan bir geçişi düşündürebilir." },
    { keys: ["kuş", "uç", "kanat"], symbol: "Uçuş", meaning: "Özgürleşme, daha geniş bir bakış açısı kazanma ya da sınırları aşma arzusuyla ilişkili olabilir." },
    { keys: ["orman", "ağaç", "yol"], symbol: "Orman ve yol", meaning: "Belirsizlik içinde yön arayışını ve henüz keşfedilmemiş içsel alanları simgeleyebilir." },
    { keys: ["ev", "oda", "merdiven"], symbol: "Ev", meaning: "Kendilik algını, güven ihtiyacını ve zihninin farklı katmanlarını yansıtabilir." },
    { keys: ["ay", "gece", "yıldız"], symbol: "Gece göğü", meaning: "Sezgilerine kulak verme, bilinmeyenle kalabilme ve sessiz bir farkındalık dönemini çağrıştırabilir." },
  ];
  const matched = catalog.filter((item) => item.keys.some((key) => normalized.includes(key)));
  const symbols = [...matched, ...catalog.filter((item) => !matched.includes(item))].slice(0, 3);
  return {
    title: "Bir eşiğin kıyısında",
    summary: "Bu rüya, iç dünyanda beliren bir değişim ihtiyacını ve bu değişime yaklaşırken hissettiğin merakla belirsizliği aynı sahnede buluşturuyor olabilir.",
    emotionalTheme: normalized.includes("kork") ? "Belirsizlikle yüzleşme" : "Merak ve içsel arayış",
    emotionSpectrum: normalized.includes("kork")
      ? [{ emotion: "Korku", intensity: 82 }, { emotion: "Merak", intensity: 67 }, { emotion: "Umut", intensity: 43 }]
      : [{ emotion: "Merak", intensity: 86 }, { emotion: "Huzur", intensity: 61 }, { emotion: "Belirsizlik", intensity: 48 }],
    symbols: symbols.map(({ symbol, meaning }) => ({ symbol, meaning })),
    reflection: "Hayatımda şu an beni hem heyecanlandıran hem de yönümü sorgulatan hangi yeni kapı var?",
    disclaimer,
    demo: true,
  };
}

function extractText(data: { output?: Array<{ content?: Array<{ text?: string }> }> }) {
  return data.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("").trim() ?? "";
}

function cleanJson(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
}

function parseAnalysis(text: string) {
  const parsed = JSON.parse(cleanJson(text)) as DreamResult;
  if (!parsed.title || !parsed.summary || !Array.isArray(parsed.symbols)) throw new Error("Invalid analysis shape");
  if (Array.isArray(parsed.emotionSpectrum)) {
    parsed.emotionSpectrum = parsed.emotionSpectrum
      .filter((item) => item && typeof item.emotion === "string")
      .slice(0, 5)
      .map((item) => ({ emotion: item.emotion.slice(0, 40), intensity: Math.max(10, Math.min(100, Number(item.intensity) || 50)) }));
  }
  parsed.disclaimer = parsed.disclaimer || disclaimer;
  return parsed;
}

export async function POST(request: Request) {
  try {
    const authorization = await authorizeAiRequest(request, { action: "dream-analysis", userLimit: 30, ipLimit: 60 });
    if (authorization.response) return authorization.response;
    const parsed = await readJsonRequest<{ dream?: unknown; mood?: unknown }>(request, 16_384);
    if (parsed.response) return parsed.response;
    const body = parsed.data;
    const dream = typeof body.dream === "string" ? body.dream.trim() : "";
    const mood = typeof body.mood === "string" ? body.mood.trim().slice(0, 30) : "";
    if (dream.length < 3) return Response.json({ error: "Rüya metni en az 3 karakter olmalı." }, { status: 400 });
    if (dream.length > 3000) return Response.json({ error: "Rüya metni 3000 karakteri geçemez." }, { status: 400 });

    const prompt = `Sen dikkatli, şefkatli ve sembolik düşünen bir rüya yorumcususun. Rüyaları kehanet, teşhis veya kesin gerçek olarak sunma. Türkçe yanıt ver. Aşağıdaki rüyayı duygular, imgeler ve kişinin kendi yaşamıyla kurabileceği olası bağlantılar açısından yorumla. Kullanıcının seçtiği duygu varsa yoruma doğal biçimde dahil et ama bu duyguyu kesin bir gerçek gibi sunma. Kısa rüyalarda olmayan ayrıntıları uydurma. Tam olarak 3 önemli sembol seç. Her sembolü rüyadaki bağlamla ilişkilendir. Rüyada hissedilen 3 ila 5 farklı duyguyu belirle ve her biri için 10-100 arasında göreli bir yoğunluk ver. Yalnızca geçerli JSON döndür; markdown kullanma. Şema: {"title":"kısa şiirsel başlık","summary":"3-4 cümle bütünsel ve kişiye dönük yorum","emotionalTheme":"kısa baskın duygu veya tema","emotionSpectrum":[{"emotion":"duygu adı","intensity":85}],"symbols":[{"symbol":"sembol adı","meaning":"2 cümlelik olasılıklı ve nazik yorum"}],"reflection":"kişinin kendine sorabileceği tek güçlü soru","disclaimer":"${disclaimer}"}\n\nKullanıcının seçtiği duygu: ${mood || "Belirtilmedi"}\n\nRüya:\n${dream}`;

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
        }),
      });

      if (!response.ok) {
        const invalidKey = response.status === 400 || response.status === 403;
        return Response.json({ error: invalidKey ? "Gemini API anahtarı geçersiz görünüyor." : "Yapay zekâ servisine şu anda ulaşılamıyor." }, { status: 502 });
      }

      const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = data.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text ?? "").join("").trim() ?? "";
      return Response.json(parseAnalysis(text));
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return Response.json(demoAnalysis(dream));

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5-mini", input: prompt }),
    });

    if (!response.ok) {
      const status = response.status;
      return Response.json({ error: status === 401 ? "API anahtarı geçersiz görünüyor." : "Yapay zekâ servisine şu anda ulaşılamıyor." }, { status: 502 });
    }

    const data = await response.json() as { output?: Array<{ content?: Array<{ text?: string }> }> };
    return Response.json(parseAnalysis(extractText(data)));
  } catch {
    return Response.json({ error: "Rüya yorumlanırken beklenmedik bir sorun oluştu." }, { status: 500 });
  }
}
import { authorizeAiRequest, readJsonRequest } from "../../security";
