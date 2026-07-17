export function isEmbeddedMobileBrowser(userAgent: string) {
  return /(WhatsApp|FBAN|FBAV|Instagram|Line\/|Twitter|MicroMessenger)/i.test(userAgent);
}

export function getVoiceErrorMessage(errorCode: string) {
  if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
    return "Mikrofon erişimine izin verilmedi. Tarayıcı ayarlarından mikrofon iznini açıp tekrar deneyebilirsin.";
  }
  if (errorCode === "no-speech") {
    return "Ses duyulamadı. Mikrofona biraz daha yakın konuşup tekrar deneyebilirsin.";
  }
  if (errorCode === "audio-capture") {
    return "Mikrofona ulaşılamadı. Başka bir uygulamanın mikrofonu kullanmadığından emin olup tekrar dene.";
  }
  if (errorCode === "network") {
    return "Ses hizmetine bağlanılamadı. İnternet bağlantını kontrol et veya sayfayı Safari/Chrome'da aç.";
  }
  return "Sesli anlatım başlatılamadı. Sayfayı Safari veya Chrome'da açıp tekrar deneyebilirsin.";
}

