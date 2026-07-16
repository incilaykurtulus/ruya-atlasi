export type DreamAnalysis = {
  title: string;
  summary: string;
  emotionalTheme: string;
  emotionSpectrum?: Array<{ emotion: string; intensity: number }>;
  symbols: Array<{ symbol: string; meaning: string }>;
  reflection: string;
  disclaimer: string;
  demo?: boolean;
};

export type StoredDream = {
  id: string;
  deviceId: string;
  dream: string;
  mood: string;
  title: string;
  analysis: DreamAnalysis | null;
  createdAt: string;
};

export type MonthlySummary = {
  dreamCount: number;
  topSymbol: string;
  topMood: string;
  headline: string;
  narrative: string;
  pattern: string;
  reflection: string;
};
