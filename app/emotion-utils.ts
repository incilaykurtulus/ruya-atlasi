export type EmotionIntensity = { emotion: string; intensity: number };

export function normalizeEmotionPercentages(items: EmotionIntensity[]): EmotionIntensity[] {
  const cleaned = items
    .filter((item) => item && typeof item.emotion === "string" && item.emotion.trim())
    .slice(0, 5)
    .map((item) => ({
      emotion: item.emotion.trim().slice(0, 40),
      intensity: Number.isFinite(Number(item.intensity)) ? Math.max(0, Number(item.intensity)) : 0,
    }));

  if (!cleaned.length) return [];
  const suppliedTotal = cleaned.reduce((sum, item) => sum + item.intensity, 0);
  const weights = suppliedTotal > 0 ? cleaned.map((item) => item.intensity) : cleaned.map(() => 1);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  const exact = weights.map((value) => (value / weightTotal) * 100);
  const rounded = exact.map(Math.floor);
  let remainder = 100 - rounded.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - rounded[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let index = 0; remainder > 0; index += 1, remainder -= 1) {
    rounded[order[index % order.length].index] += 1;
  }

  return cleaned.map((item, index) => ({ ...item, intensity: rounded[index] }));
}
