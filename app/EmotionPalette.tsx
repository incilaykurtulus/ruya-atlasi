import type { CSSProperties } from "react";
import type { DreamAnalysis } from "./dream-types";
import { normalizeEmotionPercentages } from "./emotion-utils";

const colorFamilies = [
  { keys: ["aşk", "sevgi", "tutku"], colors: ["#ff5c8a", "#ff8fab", "#ffc2d1", "#ff758f"] },
  { keys: ["huzur", "sakin", "dingin"], colors: ["#57cc99", "#80ed99", "#b7e4c7", "#48cae4"] },
  { keys: ["korku", "kaygı", "endişe"], colors: ["#3c096c", "#5a189a", "#7b2cbf", "#9d4edd"] },
  { keys: ["merak", "arayış", "keşif"], colors: ["#7b61ff", "#9b87f5", "#c4b5fd", "#64dfdf"] },
  { keys: ["hüzün", "üzüntü", "yalnız"], colors: ["#4361ee", "#4895ef", "#4cc9f0", "#577590"] },
  { keys: ["neşe", "mutluluk", "umut"], colors: ["#ffd166", "#ffb703", "#fb8500", "#ffe29a"] },
  { keys: ["şaşk", "belirsiz"], colors: ["#f72585", "#b5179e", "#7209b7", "#4cc9f0"] },
  { keys: ["öfke", "kızgın"], colors: ["#d90429", "#ef233c", "#ff595e", "#ff924c"] },
];

const fallbackColors = ["#7964dd", "#a287ee", "#c4b5fd", "#e7c78a"];
const nodePositions = [
  { x: "78%", y: "22%" },
  { x: "82%", y: "72%" },
  { x: "23%", y: "78%" },
  { x: "17%", y: "29%" },
  { x: "50%", y: "10%" },
];

function colorsFor(emotion: string) {
  const normalized = emotion.toLocaleLowerCase("tr-TR");
  return colorFamilies.find((family) => family.keys.some((key) => normalized.includes(key)))?.colors || fallbackColors;
}

export default function EmotionPalette({ analysis, mood }: { analysis: DreamAnalysis; mood: string }) {
  const fallback = [
    { emotion: analysis.emotionalTheme || "Sezgi", intensity: 82 },
    ...(mood && !analysis.emotionalTheme.toLocaleLowerCase("tr-TR").includes(mood.toLocaleLowerCase("tr-TR")) ? [{ emotion: mood, intensity: 64 }] : []),
    { emotion: "Bilinçaltı", intensity: 42 },
  ];
  const emotions = normalizeEmotionPercentages(analysis.emotionSpectrum?.length ? analysis.emotionSpectrum : fallback);
  const allColors = emotions.flatMap((item) => colorsFor(item.emotion).slice(0, 3));
  const dominant = [...emotions].sort((a, b) => b.intensity - a.intensity)[0];
  const spectrum = `conic-gradient(from 210deg, ${allColors.join(",")})`;

  return (
    <article className="emotion-palette-card" aria-label="Rüyanın duygu renk paleti">
      <div className="palette-heading">
        <div>
          <span className="result-label">RÜYANIN DUYGU PALETİ</span>
          <h3>Hislerinin renk haritası</h3>
          <p>Rüyandaki duygular tek bir renk yerine, birbirine bağlanan canlı bir gece haritasına dönüşüyor.</p>
        </div>
        <span className="palette-signature"><i /> Duygusal imza · {allColors.length} ton</span>
      </div>

      <div className="emotion-constellation" style={{ "--spectrum": spectrum } as CSSProperties} aria-label="Duyguların görsel yoğunluk haritası">
        <span className="constellation-stars" aria-hidden="true" />
        <span className="constellation-ring ring-outer" aria-hidden="true" />
        <span className="constellation-ring ring-inner" aria-hidden="true" />
        <span className="constellation-ray ray-one" aria-hidden="true" />
        <span className="constellation-ray ray-two" aria-hidden="true" />
        <span className="constellation-ray ray-three" aria-hidden="true" />

        <div className="emotion-core" aria-label={`Baskın duygu ${dominant?.emotion || "Sezgi"}, yüzde ${dominant?.intensity || 0}`}>
          <span className="emotion-core-glass" aria-hidden="true" />
          <strong>%{Math.round(dominant?.intensity || 0)}</strong>
          <small>Baskın duygu</small>
          <b>{dominant?.emotion || "Sezgi"}</b>
        </div>

        {emotions.map((item, index) => {
          const colors = colorsFor(item.emotion);
          const position = nodePositions[index];
          return (
            <span
              className="constellation-node"
              key={`${item.emotion}-${index}`}
              style={{
                "--node-x": position.x,
                "--node-y": position.y,
                "--node-color": colors[0],
                "--node-glow": colors[1],
                "--node-scale": Math.max(0.72, item.intensity / 100),
              } as CSSProperties}
            >
              <i aria-hidden="true" />
              <span><b>{item.emotion}</b><small>%{Math.round(item.intensity)}</small></span>
            </span>
          );
        })}
      </div>

      <div className="emotion-meter-list">
        {emotions.map((item, index) => {
          const intensity = Math.max(0, Math.min(100, item.intensity));
          const colors = colorsFor(item.emotion);
          return (
            <div className="emotion-meter" key={`${item.emotion}-${index}`}>
              <div className="meter-label"><strong>{item.emotion}</strong><span>%{intensity}</span></div>
              <div className="meter-track"><span style={{ width: `${intensity}%`, background: `linear-gradient(90deg, ${colors.join(",")})` }} /></div>
              <div className="shade-row" aria-label={`${item.emotion} renk tonları`}>
                {colors.map((color) => <i key={color} style={{ background: color }} />)}
              </div>
            </div>
          );
        })}
      </div>
      <small className="palette-note">Duyguların yüzdeleri toplamda tam %100 olacak şekilde dağıtılır; bu dağılım kesin bir ölçüm değil, rüya anlatındaki duygusal ipuçlarının görsel karşılığıdır.</small>
    </article>
  );
}
