"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import AccountPanel, { type DreamAccount } from "./AccountPanel";
import DreamCalendar from "./DreamCalendar";
import EmotionPalette from "./EmotionPalette";
import type { DreamAnalysis, StoredDream } from "./dream-types";
import { getDailyTalismanMessage } from "./talisman-message";
import { getVoiceErrorMessage, isEmbeddedMobileBrowser } from "./voice-support";

const sampleDream =
  "Gece vakti ay ışığıyla aydınlanan eski bir ormanda yürüyordum. Önümde parlak mavi bir kapı belirdi. Kapıyı açınca uçsuz bucaksız bir deniz ve gökyüzünde süzülen beyaz bir kuş gördüm. Korkmuyordum ama nereye gideceğimi bilmiyordum.";

const moods = ["Merak", "Korku", "Huzur", "Hüzün", "Şaşkınlık", "Aşk"];

type SpeechResultEvent = { results: ArrayLike<{ 0: { transcript: string } }> };
type SpeechErrorEvent = { error?: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type ReflectionInsight = {
  meaning: string;
  advice: string;
  affirmation: string;
  disclaimer: string;
  demo?: boolean;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export default function Home() {
  const [dream, setDream] = useState("");
  const [analysis, setAnalysis] = useState<DreamAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mood, setMood] = useState("");
  const [history, setHistory] = useState<StoredDream[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [account, setAccount] = useState<DreamAccount | null | undefined>(undefined);
  const [view, setView] = useState<"interpret" | "calendar">("interpret");
  const [copied, setCopied] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [voiceBrowserHelp, setVoiceBrowserHelp] = useState(false);
  const [reflectionAnswer, setReflectionAnswer] = useState("");
  const [reflectionInsight, setReflectionInsight] = useState<ReflectionInsight | null>(null);
  const [reflectionLoading, setReflectionLoading] = useState(false);
  const [reflectionError, setReflectionError] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [dailyDateKey, setDailyDateKey] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDreamDiary() {
      try {
        setDailyDateKey(new Intl.DateTimeFormat("en-CA").format(new Date()));
        const existingDeviceId = window.localStorage.getItem("ruya-atlasi-device-id");
        const currentDeviceId = existingDeviceId || crypto.randomUUID();
        if (!existingDeviceId) window.localStorage.setItem("ruya-atlasi-device-id", currentDeviceId);
        if (!active) return;
        setDeviceId(currentDeviceId);

        const saved = window.localStorage.getItem("ruya-atlasi-history");
        const localItems = saved ? (JSON.parse(saved) as Array<Partial<StoredDream>>) : [];
        const migratedItems: StoredDream[] = localItems
          .filter((item) => item.dream && item.createdAt)
          .map((item) => ({
            id: item.id || crypto.randomUUID(),
            deviceId: currentDeviceId,
            dream: item.dream || "",
            mood: item.mood || "",
            title: item.title || "Rüyam",
            analysis: item.analysis || null,
            createdAt: item.createdAt || new Date().toISOString(),
          }));

        const merged = migratedItems.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        if (!active) return;
        setHistory(merged);
        window.localStorage.setItem("ruya-atlasi-history", JSON.stringify(merged));
      } catch {
        // Çevrimdışı durumda cihazdaki yedekle devam edilir.
      }
    }

    void loadDreamDiary();
    return () => { active = false; };
  }, []);

  const handleAuthChange = useCallback(async (nextAccount: DreamAccount | null) => {
    setAccount(nextAccount);
    const localDeviceId = window.localStorage.getItem("ruya-atlasi-device-id") || crypto.randomUUID();
    window.localStorage.setItem("ruya-atlasi-device-id", localDeviceId);
    const ownerId = nextAccount ? `user-${nextAccount.userId}` : localDeviceId;
    const headers: Record<string, string> = nextAccount ? { Authorization: `Bearer ${nextAccount.accessToken}` } : {};
    try {
      if (nextAccount) {
        const saved = window.localStorage.getItem("ruya-atlasi-history");
        const localEntries = saved ? (JSON.parse(saved) as StoredDream[]) : [];
        const migrationResponses = await Promise.all(localEntries.map((entry) => fetch("/api/dreams", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ ...entry, deviceId: ownerId }),
        })));
        if (migrationResponses.every((response) => response.ok)) window.localStorage.removeItem("ruya-atlasi-history");
      } else {
        const saved = window.localStorage.getItem("ruya-atlasi-history");
        setHistory(saved ? (JSON.parse(saved) as StoredDream[]) : []);
        return;
      }
      const response = await fetch(`/api/dreams?deviceId=${encodeURIComponent(ownerId)}`, { headers });
      if (!response.ok) return;
      const entries = (await response.json()) as StoredDream[];
      setHistory(entries);
    } catch {
      // Oturum yenilenirken mevcut ekran korunur.
    }
  }, []);

  async function analyzeDream(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dream.trim().length < 3) {
      setError("Rüyanı yorumlayabilmem için en az birkaç harf yazmalısın.");
      return;
    }

    setLoading(true);
    setError("");
    setAnalysis(null);
    setReflectionAnswer("");
    setReflectionInsight(null);
    setReflectionError("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${account.accessToken}` },
        body: JSON.stringify({ dream: dream.trim(), mood }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Rüya yorumlanamadı.");
      setAnalysis(data);
      const currentDeviceId = account ? `user-${account.userId}` : deviceId || window.localStorage.getItem("ruya-atlasi-device-id") || crypto.randomUUID();
      if (!deviceId) {
        setDeviceId(currentDeviceId);
        window.localStorage.setItem("ruya-atlasi-device-id", currentDeviceId);
      }
      const entry: StoredDream = {
        id: crypto.randomUUID(),
        deviceId: currentDeviceId,
        dream: dream.trim(),
        mood,
        title: data.title,
        analysis: data,
        createdAt: new Date().toISOString(),
      };
      const updatedHistory = [entry, ...history];
      setHistory(updatedHistory);
      if (!account) window.localStorage.setItem("ruya-atlasi-history", JSON.stringify(updatedHistory));
      void fetch("/api/dreams", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(account ? { Authorization: `Bearer ${account.accessToken}` } : {}) },
        body: JSON.stringify(entry),
      });
      window.setTimeout(() => {
        document.getElementById("analysis")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Beklenmedik bir sorun oluştu.");
    } finally {
      setLoading(false);
    }
  }

  function openDiaryEntry(entry: StoredDream) {
    setDream(entry.dream);
    setMood(entry.mood);
    setAnalysis(entry.analysis);
    setReflectionAnswer("");
    setReflectionInsight(null);
    setReflectionError("");
    setView("interpret");
    window.setTimeout(() => {
      document.getElementById(entry.analysis ? "analysis" : "top")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  async function copyAnalysis() {
    if (!analysis) return;
    const text = `${analysis.title}\n\n${analysis.summary}\n\n${analysis.symbols.map((item) => `${item.symbol}: ${item.meaning}`).join("\n")}\n\nKendine sor: ${analysis.reflection}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function analyzeReflection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!analysis || reflectionAnswer.trim().length < 3) {
      setReflectionError("Hislerini ve düşüncelerini birkaç kelimeyle anlatmalısın.");
      return;
    }

    setReflectionLoading(true);
    setReflectionError("");
    setReflectionInsight(null);
    try {
      const response = await fetch("/api/reflection-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${account.accessToken}` },
        body: JSON.stringify({
          dream: dream.trim(),
          question: analysis.reflection,
          answer: reflectionAnswer.trim(),
          summary: analysis.summary,
          emotionalTheme: analysis.emotionalTheme,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Yanıtın değerlendirilemedi.");
      setReflectionInsight(data);
      window.setTimeout(() => document.getElementById("reflection-insight")?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    } catch (caught) {
      setReflectionError(caught instanceof Error ? caught.message : "Beklenmedik bir sorun oluştu.");
    } finally {
      setReflectionLoading(false);
    }
  }

  function toggleVoiceInput() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    if (isEmbeddedMobileBrowser(window.navigator.userAgent)) {
      setVoiceError("WhatsApp içindeki tarayıcı sesli anlatımı desteklemiyor. Sağ üstteki menüden ‘Safari'de Aç’ seçeneğini kullan.");
      setVoiceBrowserHelp(true);
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError("Bu tarayıcı sesli anlatımı desteklemiyor. Sayfayı Safari veya Chrome'da açabilirsin.");
      setVoiceBrowserHelp(true);
      return;
    }

    const recognition = new Recognition();
    const startingDream = dream.trim();
    recognition.lang = "tr-TR";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const spoken = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ").trim();
      setDream(`${startingDream}${startingDream && spoken ? " " : ""}${spoken}`.slice(0, 3000));
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted") setVoiceError(getVoiceErrorMessage(event.error || "unknown"));
      setVoiceBrowserHelp(event.error === "network" || event.error === "service-not-allowed");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setVoiceError("");
    setVoiceBrowserHelp(false);
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      setVoiceBrowserHelp(true);
      setVoiceError(getVoiceErrorMessage("unknown"));
    }
  }

  if (!account) return <AccountPanel gate onAuthChange={handleAuthChange} />;

  return (
    <main>
      <div className="sky-art" aria-hidden="true" />
      <div className="sky" aria-hidden="true">
        <span className="star-field star-field-far" />
        <span className="star-field star-field-near" />
        <span className="aurora aurora-one" />
        <span className="aurora aurora-two" />
        <span className="nebula nebula-one" />
        <span className="nebula nebula-two" />
        <span className="meteor meteor-one" />
        <span className="meteor meteor-two" />
        <span className="meteor meteor-three" />
        <span className="star star-one" />
        <span className="star star-two" />
        <span className="star star-three" />
        <span className="star star-four" />
        <span className="glow glow-one" />
        <span className="glow glow-two" />
        <span className="edge-crescent edge-crescent-left">☽</span>
        <span className="edge-crescent edge-crescent-right">☾</span>
        <span className="edge-spark edge-spark-left">✦</span>
        <span className="edge-spark edge-spark-right">✧</span>
      </div>

      <nav className="nav" aria-label="Ana menü">
        <button className="brand brand-button" type="button" onClick={() => setView("interpret")} aria-label="Rüya Atlası ana sayfa">
          <span className="brand-mark">☾</span>
          <span className="brand-text">Rüya Atlası</span>
        </button>
        <div className="nav-tools">
          <div className="nav-actions" aria-label="Sayfalar">
            <button type="button" className={view === "interpret" ? "nav-tab active" : "nav-tab"} onClick={() => setView("interpret")}><b aria-hidden="true">✦</b> <span className="nav-label">Rüya Yorumu</span></button>
            <button type="button" className={view === "calendar" ? "nav-tab active" : "nav-tab"} onClick={() => setView("calendar")}><b aria-hidden="true">▦</b> <span className="nav-label">Rüya Takvimi</span> <span className="nav-count">{history.length}</span></button>
          </div>
          <AccountPanel onAuthChange={handleAuthChange} />
        </div>
      </nav>

      {view === "interpret" ? (
      <>
      <section className="hero" id="top">
        <div className="eyebrow"><span>✦</span> Bilinçaltının dilini keşfet</div>
        <h1>Rüyaların sana<br /><em>ne anlatıyor?</em></h1>
        <p className="hero-copy">
          Rüyanı hatırladığın gibi yaz. Yapay zekâ; duyguları, sembolleri ve olası anlamları
          nazik, kişisel bir bakışla yorumlasın.
        </p>

        <form className="dream-card" onSubmit={analyzeDream}>
          <div className="card-heading">
            <div>
              <span className="card-kicker">RÜYA GÜNLÜĞÜ</span>
              <h2>Bu gece ne gördün?</h2>
            </div>
            <span className="moon-orbit" aria-hidden="true"><span>☾</span></span>
          </div>

          <label className="sr-only" htmlFor="dream">Rüyanı anlat</label>
          <div className="dream-input-wrap">
            <textarea
              id="dream"
              value={dream}
              onChange={(event) => setDream(event.target.value.slice(0, 3000))}
              placeholder="Rüyanda nerede olduğunu, kimleri gördüğünü, neler hissettiğini ve aklında kalan sembolleri anlat..."
              rows={8}
              disabled={loading}
            />
            <button type="button" className={listening ? "voice-button listening" : "voice-button"} onClick={toggleVoiceInput} aria-pressed={listening} disabled={loading}>
              <span className="mic-icon">{listening ? "■" : "●"}</span>
              {listening ? "Dinlemeyi bitir" : "Sesli anlat"}
            </button>
          </div>
          {voiceError && (
            <div className="voice-error" role="alert">
              <span>{voiceError}</span>
              {voiceBrowserHelp && (
                <button type="button" onClick={async () => {
                  await navigator.clipboard.writeText(window.location.href);
                  setVoiceError("Bağlantı kopyalandı. Safari veya Chrome'a yapıştırarak sesli anlatımı kullanabilirsin.");
                  setVoiceBrowserHelp(false);
                }}>Bağlantıyı kopyala</button>
              )}
            </div>
          )}

          <fieldset className="mood-fieldset" disabled={loading}>
            <legend>Rüyada en çok ne hissettin? <span>İsteğe bağlı</span></legend>
            <div className="mood-list">
              {moods.map((item) => (
                <button
                  type="button"
                  className={mood === item ? "mood-chip active" : "mood-chip"}
                  aria-pressed={mood === item}
                  onClick={() => setMood(mood === item ? "" : item)}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="form-meta">
            <button type="button" className="sample-button" onClick={() => { setDream(sampleDream); setError(""); }} disabled={loading}>
              ✦ Örnek rüyayı kullan
            </button>
            <span>{dream.length} / 3000</span>
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          <button className="analyze-button" type="submit" disabled={loading || dream.trim().length < 3}>
            {loading ? <><span className="spinner" /> Rüyan yorumlanıyor...</> : <><span>✦</span> Rüyamı Analiz Et <span className="arrow">→</span></>}
          </button>
          <p className="privacy-note"><span>◈</span> Rüyan yalnızca bu yorumu oluşturmak için kullanılır.</p>
        </form>

        {history.length > 0 && (
          <aside className="history-strip" aria-label="Son rüyaların">
            <div className="history-heading"><span>☾</span><strong>Son rüyaların</strong><small>Bu cihazda saklanır</small></div>
            <div className="history-list">
              {history.slice(0, 3).map((item) => (
                <button type="button" key={item.id} onClick={() => openDiaryEntry(item)}>
                  <strong>{item.title}</strong><span>{item.dream}</span>
                </button>
              ))}
            </div>
          </aside>
        )}
      </section>

      <section className="how-it-works" aria-labelledby="how-title">
        <div className="section-label">NASIL ÇALIŞIR?</div>
        <h2 id="how-title">Üç adımda rüyanın izinde</h2>
        <div className="steps">
          <article><span className="step-number">01</span><div className="step-icon">✎</div><h3>Hatırla ve anlat</h3><p>Detayları kusursuz yazman gerekmez. Aklında kalanları özgürce aktar.</p></article>
          <article><span className="step-number">02</span><div className="step-icon">✦</div><h3>Semboller çözülsün</h3><p>Yapay zekâ tekrar eden imgeleri, duyguları ve temaları birlikte inceler.</p></article>
          <article><span className="step-number">03</span><div className="step-icon">☾</div><h3>Kendine yaklaş</h3><p>Kesin yargılar yerine düşünmene yardımcı olacak kişisel bir yorum alırsın.</p></article>
        </div>
      </section>

      {analysis && (
        <section className="analysis-section" id="analysis" aria-live="polite">
          <div className="analysis-header">
            <span className="section-label">RÜYA YORUMUN</span>
            <h2>{analysis.title}</h2>
            <p>{analysis.summary}</p>
            <button type="button" className="copy-button" onClick={copyAnalysis}>{copied ? "✓ Kopyalandı" : "⧉ Yorumu kopyala"}</button>
            {analysis.demo && <span className="demo-badge">Demo analiz · API anahtarı bekleniyor</span>}
          </div>

          <div className="insight-grid">
            <article className="emotion-card">
              <span className="result-icon">◐</span>
              <div><span className="result-label">Baskın duygu</span><h3>{analysis.emotionalTheme}</h3></div>
            </article>
            {analysis.symbols.map((item, index) => (
              <article className="symbol-card" key={`${item.symbol}-${index}`}>
                <span className="symbol-index">0{index + 1}</span>
                <h3>{item.symbol}</h3>
                <p>{item.meaning}</p>
              </article>
            ))}
          </div>

          <article className="reflection-card">
            <span className="quote-mark">“</span>
            <div className="reflection-content">
              <span className="result-label">Kendine sor</span>
              <p>{analysis.reflection}</p>
              <form className="reflection-followup" onSubmit={analyzeReflection}>
                <label htmlFor="reflection-answer">Bu soru sende ne hissettirdi?</label>
                <textarea
                  id="reflection-answer"
                  value={reflectionAnswer}
                  onChange={(event) => setReflectionAnswer(event.target.value.slice(0, 1500))}
                  placeholder="Aklından geçenleri, hislerini ve bu sorunun hayatındaki karşılığını özgürce yaz…"
                  rows={4}
                />
                <div className="reflection-form-footer">
                  <small>{reflectionAnswer.length}/1500 · Yanıtın yalnızca bu değerlendirme için kullanılır.</small>
                  <button type="submit" disabled={reflectionLoading || reflectionAnswer.trim().length < 3}>
                    {reflectionLoading ? <><span className="spinner" /> Düşüncelerim yorumlanıyor…</> : <>✦ Yanıtımı yorumla</>}
                  </button>
                </div>
                {reflectionError && <p className="reflection-error">{reflectionError}</p>}
              </form>

              {reflectionInsight && (
                <section className="reflection-insight" id="reflection-insight" aria-live="polite">
                  <div className="reflection-insight-heading"><span>☾</span><div><small>YANITINDAN GELEN İÇGÖRÜ</small><h3>Sözlerinin sana anlattığı</h3></div></div>
                  <div className="reflection-insight-grid">
                    <article><span>OLASI ANLAM</span><p>{reflectionInsight.meaning}</p></article>
                    <article><span>KÜÇÜK BİR ADIM</span><p>{reflectionInsight.advice}</p></article>
                  </div>
                  <blockquote>“{reflectionInsight.affirmation}”</blockquote>
                  <small className="reflection-insight-note">{reflectionInsight.disclaimer}</small>
                </section>
              )}
            </div>
          </article>

          <EmotionPalette analysis={analysis} mood={mood} />

          <p className="disclaimer">{analysis.disclaimer}</p>
        </section>
      )}
      </>
      ) : (
        <DreamCalendar entries={history} deviceId={account ? `user-${account.userId}` : deviceId} accessToken={account?.accessToken || ""} onOpen={openDiaryEntry} />
      )}

      <aside className={guideOpen ? "dream-guide open" : "dream-guide"} aria-label="Rüya Rehberi">
        {guideOpen && (
          <div className="dream-guide-panel">
            <button type="button" className="dream-guide-close" onClick={() => setGuideOpen(false)} aria-label="Rüya Rehberini kapat">×</button>
            <span className="result-label">RÜYA REHBERİ</span>
            <h2>Merhaba, ben Tılsım ☾</h2>
            <section className="talisman-daily-message" aria-label="Tılsım'ın günlük mesajı">
              <span><i aria-hidden="true">✦</i> BUGÜNÜN MESAJI</span>
              <p>“{getDailyTalismanMessage(dailyDateKey, history)}”</p>
            </section>
            <p className="dream-guide-intro">Rüyanı yorumlarken ayrıntıları kusursuz hatırlaman gerekmez. Mekânı, kişileri ve sende kalan en güçlü duyguyu yazman yeterli.</p>
            <div className="dream-guide-tips">
              <span><i>01</i> Aklında kalan sembolü söyle</span>
              <span><i>02</i> Rüyadaki baskın duyguyu seç</span>
              <span><i>03</i> Yoruma verdiğin cevabı da düşün</span>
            </div>
            <div className="dream-guide-actions">
              <button type="button" onClick={() => { setView("interpret"); setGuideOpen(false); window.setTimeout(() => { document.getElementById("top")?.scrollIntoView({ behavior: "smooth" }); document.getElementById("dream")?.focus(); }, 80); }}>✦ Rüyamı yaz</button>
              <button type="button" onClick={() => { setView("calendar"); setGuideOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>▦ Takvimim</button>
            </div>
          </div>
        )}
        <button
          type="button"
          className="dream-guide-mascot"
          onClick={() => setGuideOpen((current) => !current)}
          aria-expanded={guideOpen}
          aria-label={guideOpen ? "Rüya Rehberini kapat" : "Rüya Rehberini aç"}
        >
          <span className="dream-guide-pulse" aria-hidden="true" />
          <span className="dream-guide-spark dream-guide-spark-one" aria-hidden="true">✦</span>
          <span className="dream-guide-spark dream-guide-spark-two" aria-hidden="true">✧</span>
          <span className="dream-guide-spark dream-guide-spark-three" aria-hidden="true">·</span>
          <img src="/mascot/ruya-rehberi.png" alt="Tılsım, Rüya Atlası rehberi" />
          {!guideOpen && <span className="dream-guide-bubble">Bir ipucu ister misin?</span>}
        </button>
      </aside>

      <footer>
        <a className="brand" href="#top"><span className="brand-mark">☾</span><span>Rüya Atlası</span></a>
        <div className="footer-copy">
          <p>Rüyalar kehanet değil, kendimize açılan pencerelerdir.</p>
          <span>Created by İncilay Kurtuluş</span>
        </div>
      </footer>
    </main>
  );
}
