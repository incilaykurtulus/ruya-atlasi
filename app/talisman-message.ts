import type { StoredDream } from "./dream-types";

const messages = [
  "Bugün cevap aramadan önce içinde beliren ilk duyguyu dinle. En sessiz his, çoğu zaman en dürüst olanıdır.",
  "Her şeyi hemen anlamlandırmak zorunda değilsin. Bazı işaretler, ancak onlara biraz alan bıraktığında görünür olur.",
  "Bugün küçük bir ayrıntıya dikkat et; zihnin sana büyük cevapları bazen sıradan görünen anların içine saklar.",
  "Kendine karşı yumuşak ol. İç dünyandaki değişim, acele ettirildiğinde değil güvende hissettiğinde derinleşir.",
  "Sana ağır gelen bir düşünceyi bugün tek cümleyle yaz. Adını koyduğun şey, üzerindeki gücünü biraz kaybeder.",
  "Sezgini susturmak yerine ona merakla yaklaş. Bugün içinden gelen ilk sakin yön, sana iyi bir başlangıç gösterebilir.",
  "Geçmişten gelen bir duyguyu bugünün gerçeği sanma. Şimdi bulunduğun yere bak ve kendine yeni bir seçim hakkı tanı.",
  "Bugün bir şeyi çözmek yerine yalnızca fark etmeyi dene. Farkındalık da başlı başına bir ilerlemedir.",
];

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

export function getDailyTalismanMessage(dateKey: string, history: StoredDream[]) {
  const latestDream = history[0];
  const latestEmotion = latestDream?.analysis?.emotionSpectrum
    ?.slice()
    .sort((left, right) => right.intensity - left.intensity)[0]?.emotion;
  const feeling = latestEmotion || latestDream?.mood;
  const symbol = latestDream?.analysis?.symbols?.[0]?.symbol;
  const baseMessage = messages[hash(dateKey || "tılsım") % messages.length];

  if (feeling && symbol) {
    return `${baseMessage} Son rüyandaki ${symbol.toLocaleLowerCase("tr-TR")} sembolü ve ${feeling.toLocaleLowerCase("tr-TR")} duygusu bugün sana eşlik eden iki küçük ipucu olabilir.`;
  }
  if (feeling) {
    return `${baseMessage} Son rüyanda öne çıkan ${feeling.toLocaleLowerCase("tr-TR")} duygusuna bugün yargılamadan biraz yer aç.`;
  }
  return baseMessage;
}

