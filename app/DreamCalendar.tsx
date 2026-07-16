"use client";

import { useMemo, useState } from "react";
import type { MonthlySummary, StoredDream } from "./dream-types";

const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const weekDays = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const localDateKey = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function DreamCalendar({ entries, deviceId, accessToken, onOpen }: { entries: StoredDream[]; deviceId: string; accessToken?: string; onOpen: (entry: StoredDream) => void }) {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState("");
  const [tab, setTab] = useState<"calendar" | "summary">("calendar");
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
  const monthEntries = useMemo(() => entries.filter((entry) => localDateKey(entry.createdAt).startsWith(monthKey)), [entries, monthKey]);
  const entriesByDay = useMemo(() => {
    const result = new Map<string, StoredDream[]>();
    for (const entry of monthEntries) {
      const key = localDateKey(entry.createdAt);
      result.set(key, [...(result.get(key) || []), entry]);
    }
    return result;
  }, [monthEntries]);

  const firstWeekday = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: Array<number | null> = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);

  function changeMonth(delta: number) {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    setSelectedDay("");
    setSummary(null);
    setSummaryError("");
  }

  async function createSummary(refresh = false) {
    if (!deviceId || !monthEntries.length) return;
    setSummaryLoading(true);
    setSummaryError("");
    try {
      const response = await fetch("/api/monthly-summary", { method: "POST", headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: JSON.stringify({ deviceId, month: monthKey, refresh }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Aylık özet hazırlanamadı.");
      setSummary(data);
    } catch (caught) {
      setSummaryError(caught instanceof Error ? caught.message : "Aylık özet hazırlanamadı.");
    } finally {
      setSummaryLoading(false);
    }
  }

  const dayEntries = selectedDay ? entriesByDay.get(selectedDay) || [] : [];
  const isCurrentMonth = cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth();

  return (
    <section className="calendar-page" aria-labelledby="calendar-title">
      <header className="calendar-hero">
        <span className="section-label">RÜYA DEFTERİ</span>
        <h1 id="calendar-title">Gecelerinin <em>haritası</em></h1>
        <p>Her yorum otomatik olarak gününe kaydolur. Geçmiş rüyalarına dön, tekrar eden sembolleri ve duyguları keşfet.</p>
      </header>

      <div className="calendar-shell">
        <div className="calendar-tabs" role="tablist" aria-label="Rüya defteri bölümleri">
          <button type="button" className={tab === "calendar" ? "active" : ""} onClick={() => setTab("calendar")}>▦ Takvim</button>
          <button type="button" className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")}>✦ Aylık AI Özeti</button>
        </div>

        <div className="month-navigation">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Önceki ay">←</button>
          <div><strong>{monthNames[cursor.getMonth()]} {cursor.getFullYear()}</strong><span>{monthEntries.length} rüya kaydı</span></div>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Sonraki ay">→</button>
        </div>

        {tab === "calendar" ? (
          <>
            <div className="calendar-grid">
              {weekDays.map((day) => <div className="weekday" key={day}>{day}</div>)}
              {cells.map((day, index) => {
                if (!day) return <div className="calendar-day empty" key={`empty-${index}`} />;
                const key = `${monthKey}-${String(day).padStart(2, "0")}`;
                const count = entriesByDay.get(key)?.length || 0;
                const today = key === localDateKey(now.toISOString());
                return (
                  <button type="button" className={`calendar-day${count ? " has-dream" : ""}${today ? " today" : ""}${selectedDay === key ? " selected" : ""}`} onClick={() => setSelectedDay(key)} key={key}>
                    <span>{day}</span>{count > 0 && <><i>☾</i><small>{count}</small></>}
                  </button>
                );
              })}
            </div>
            <div className="day-drawer">
              {selectedDay ? (
                dayEntries.length ? <><div className="drawer-title"><span>☾</span><div><strong>{new Date(`${selectedDay}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</strong><small>{dayEntries.length} kayıt</small></div></div><div className="day-entry-list">{dayEntries.map((entry) => <button type="button" onClick={() => onOpen(entry)} key={entry.id}><span>{entry.mood || "Rüya"}</span><strong>{entry.title}</strong><p>{entry.dream}</p><small>Yorumu aç →</small></button>)}</div></> : <div className="empty-day"><span>☾</span><p>Bu güne ait rüya kaydı yok.</p></div>
              ) : <div className="empty-day"><span>✦</span><p>Rüyalarını görmek için takvimden bir gün seç.</p></div>}
            </div>
          </>
        ) : (
          <div className="monthly-summary-panel">
            {monthEntries.length === 0 ? <div className="empty-summary"><span>☾</span><h2>Bu ay henüz sessiz</h2><p>İlk rüyanı yorumladığında aylık özetin burada oluşacak.</p></div> : summary ? (
              <>
                <div className="summary-stats">
                  <article><span>RÜYA SAYISI</span><strong>{summary.dreamCount}</strong><small>{isCurrentMonth ? "bu ay şimdiye kadar" : "bu ay"}</small></article>
                  <article><span>EN SIK SEMBOL</span><strong>{summary.topSymbol}</strong><small>tekrarlayan imge</small></article>
                  <article><span>BASKIN DUYGU</span><strong>{summary.topMood}</strong><small>ayın duygusal tonu</small></article>
                </div>
                <div className="ai-month-card"><span className="section-label">AYININ RÜYA PORTRESİ</span><h2>{summary.headline}</h2><p>{summary.narrative}</p><div><strong>Tekrarlayan tema</strong><p>{summary.pattern}</p></div><blockquote>“{summary.reflection}”</blockquote><button type="button" onClick={() => createSummary(true)} disabled={summaryLoading}>↻ Özeti yenile</button></div>
              </>
            ) : <div className="summary-cta"><span>✦</span><h2>{monthNames[cursor.getMonth()]} ayının izlerini keşfet</h2><p>{monthEntries.length} rüya kaydındaki sembolleri ve duyguları yapay zekâ birlikte incelesin.</p><button type="button" onClick={() => createSummary()} disabled={summaryLoading}>{summaryLoading ? "Özet hazırlanıyor..." : "Aylık AI özetini oluştur"}</button>{summaryError && <p className="summary-error" role="alert">{summaryError}</p>}</div>}
          </div>
        )}
      </div>
    </section>
  );
}
