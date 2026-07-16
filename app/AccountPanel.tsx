"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type DreamAccount = { userId: string; email: string; accessToken: string };

function authErrorMessage(error: { message: string; code?: string }) {
  if (error.code === "otp_disabled") return "Bu e-posta ile kayıtlı bir hesap bulunamadı. Adresi kontrol et veya önce Kayıt ol sekmesinden hesap oluştur.";
  if (error.code === "over_email_send_rate_limit") return "Çok kısa sürede fazla bağlantı istendi. Birkaç dakika bekleyip tekrar dene.";
  if (error.code === "email_not_confirmed") return "Önce e-postana gönderilen doğrulama bağlantısına tıklamalısın.";
  if (error.message === "Invalid login credentials") return "E-posta veya şifre hatalı.";
  return error.message;
}

export default function AccountPanel({ onAuthChange, gate = false }: { onAuthChange: (account: DreamAccount | null) => void; gate?: boolean }) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const recoveryModeRef = useRef(false);
  const [canResetPassword, setCanResetPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    void fetch("/api/auth-config").then((response) => response.json()).then(async (config) => {
      if (!active) return;
      if (!config.enabled) {
        setConfigured(false);
        setReady(true);
        return;
      }
      const remembered = window.localStorage.getItem("ruya-remember-device") !== "false";
      setRememberDevice(remembered);
      const recoveryLink = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") === "recovery"
        || new URL(window.location.href).searchParams.get("type") === "recovery";
      if (recoveryLink) {
        recoveryModeRef.current = true;
        setRecoveryMode(true);
      }
      const storage = {
        getItem(key: string) {
          return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
        },
        setItem(key: string, value: string) {
          const shouldRemember = window.localStorage.getItem("ruya-remember-device") !== "false";
          const target = shouldRemember ? window.localStorage : window.sessionStorage;
          const other = shouldRemember ? window.sessionStorage : window.localStorage;
          target.setItem(key, value);
          other.removeItem(key);
        },
        removeItem(key: string) {
          window.localStorage.removeItem(key);
          window.sessionStorage.removeItem(key);
        },
      };
      const supabase = createClient(config.url, config.key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage },
      });
      setClient(supabase);
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session && !recoveryLink) {
        setAccountEmail(data.session.user.email || "Hesabım");
        onAuthChange({ userId: data.session.user.id, email: data.session.user.email || "", accessToken: data.session.access_token });
      } else {
        onAuthChange(null);
      }
      const listener = supabase.auth.onAuthStateChange((authEvent, session) => {
        if (authEvent === "PASSWORD_RECOVERY") {
          recoveryModeRef.current = true;
          setRecoveryMode(true);
          setReady(true);
          return;
        }
        setAccountEmail(session?.user.email || "");
        if (recoveryModeRef.current && session) return;
        onAuthChange(session ? { userId: session.user.id, email: session.user.email || "", accessToken: session.access_token } : null);
      });
      unsubscribe = () => listener.data.subscription.unsubscribe();
      setReady(true);
    }).catch(() => { setConfigured(false); setReady(true); });
    return () => { active = false; unsubscribe?.(); };
  }, [onAuthChange]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || password.length < 6) return;
    setLoading(true);
    setMessage("");
    setCanResetPassword(false);
    try {
      const result = mode === "signup"
        ? await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } })
        : await client.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) {
        setMessage(authErrorMessage(result.error));
        setCanResetPassword(mode === "signin" && (result.error.code === "invalid_credentials" || result.error.message === "Invalid login credentials"));
      }
      else if (mode === "signup" && !result.data.session) setMessage("Doğrulama bağlantısı e-posta adresine gönderildi. E-postanı onayladıktan sonra giriş yapabilirsin.");
      else {
        setOpen(false);
        setEmail("");
        setPassword("");
      }
    } catch {
      setMessage("Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.");
    }
    setLoading(false);
  }

  async function requestPasswordReset() {
    if (!client || !email.trim()) {
      setMessage("Yeni şifre bağlantısı için önce e-posta adresini yaz.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
      setMessage(error ? authErrorMessage(error) : "Yeni şifre bağlantısı e-postana gönderildi. Bağlantıya tıklayınca yeni şifreni belirleyebilirsin.");
    } catch {
      setMessage("Yeni şifre bağlantısı gönderilemedi. İnternetini kontrol edip tekrar dene.");
    }
    setLoading(false);
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || password.length < 6) {
      setMessage("Yeni şifren en az 6 karakter olmalı.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Yazdığın şifreler birbiriyle aynı değil.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const { data, error } = await client.auth.updateUser({ password });
      if (error) setMessage(authErrorMessage(error));
      else {
        const { data: sessionData } = await client.auth.getSession();
        window.history.replaceState({}, "", window.location.pathname);
        recoveryModeRef.current = false;
        setRecoveryMode(false);
        setPassword("");
        setConfirmPassword("");
        if (data.user && sessionData.session) onAuthChange({ userId: data.user.id, email: data.user.email || "", accessToken: sessionData.session.access_token });
      }
    } catch {
      setMessage("Şifre yenilenemedi. Bağlantıyı yeniden açıp tekrar dene.");
    }
    setLoading(false);
  }

  async function sendMagicLink() {
    if (!client || !email.trim()) {
      setMessage("Önce e-posta adresini yaz.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const { error } = await client.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
      });
      setMessage(error ? authErrorMessage(error) : "Giriş bağlantısı e-postana gönderildi. Bağlantıya tıklayınca hesabın açılacak.");
    } catch {
      setMessage("Giriş bağlantısı gönderilemedi. İnternetini kontrol edip tekrar dene.");
    }
    setLoading(false);
  }

  function changeRememberDevice(checked: boolean) {
    setRememberDevice(checked);
    window.localStorage.setItem("ruya-remember-device", String(checked));
  }

  async function signOut() {
    await client?.auth.signOut();
    setOpen(false);
  }

  const recoveryForm = (
    <>
      <span className="account-moon">☾</span>
      <span className="section-label">YENİ ŞİFRE</span>
      <h1 id="account-title">Yeni şifreni oluştur</h1>
      <p className="account-intro">Hesabın için hatırlayabileceğin güçlü bir şifre belirle.</p>
      <form onSubmit={updatePassword} className="account-form recovery-form">
        <label>Yeni şifre<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={6} required placeholder="En az 6 karakter" /></label>
        <label>Yeni şifre tekrar<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={6} required placeholder="Şifreni tekrar yaz" /></label>
        {message && <p className="account-message" role="status">{message}</p>}
        <button className="account-submit" type="submit" disabled={loading || !client}>{loading ? "Şifren yenileniyor..." : "Yeni şifremi kaydet"}</button>
      </form>
      <small className="account-privacy">Şifren yenilendikten sonra rüya defterin otomatik olarak açılır.</small>
    </>
  );

  const authForm = (
    <>
      <span className="account-moon">☾</span>
      <span className="section-label">RÜYA HESABI</span>
      <h1 id="account-title">{mode === "signin" ? "Gecelerine geri dön" : "Rüyalarını yanında taşı"}</h1>
      <p className="account-intro">{mode === "signin" ? "Rüya günlüğünü açmak için hesabına giriş yap." : "Ücretsiz hesap oluştur; rüyaların telefon ve bilgisayar arasında seninle gelsin."}</p>
      <div className="account-tabs"><button type="button" className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setMessage(""); setCanResetPassword(false); }}>Giriş yap</button><button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setMessage(""); setCanResetPassword(false); }}>Kayıt ol</button></div>
      <form onSubmit={submit} className="account-form">
        <label>E-posta<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="ornek@email.com" /></label>
        <label>Şifre<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} required placeholder="En az 6 karakter" /></label>
        {mode === "signin" && <label className="remember-option"><input type="checkbox" checked={rememberDevice} onChange={(event) => changeRememberDevice(event.target.checked)} /><span><strong>Bu cihazda açık kalsın</strong><small>Bu cihazı kullandığında tekrar şifre istemez.</small></span></label>}
        {message && <p className="account-message" role="status">{message}</p>}
        {mode === "signin" && canResetPassword && <button className="reset-password-button" type="button" disabled={loading || !client} onClick={requestPasswordReset}>Anahtar Yeni şifre bağlantısı gönder</button>}
        <button className="account-submit" type="submit" disabled={loading || !client}>{loading ? "Bekle..." : mode === "signin" ? "Hesabıma gir" : "Hesabımı oluştur"}</button>
        {mode === "signin" && <><div className="auth-divider"><span>veya</span></div><button className="magic-link-button" type="button" disabled={loading || !client} onClick={sendMagicLink}>✉ E-postama giriş bağlantısı gönder</button></>}
      </form>
      <small className="account-privacy">Şifren cihazda saklanmaz. Açık kalmayı seçersen yalnızca güvenli oturum bilgisi hatırlanır.</small>
    </>
  );

  if (gate) {
    return (
      <main className="auth-gate-page">
        <div className="sky-art" aria-hidden="true" />
        <div className="auth-gate-brand"><span>☾</span> Rüya Atlası</div>
        <section className="auth-gate-card" aria-labelledby="account-title">
          {!ready ? <div className="auth-loading"><span className="spinner" /><p>Rüya defterin hazırlanıyor...</p></div> : !configured ? <div className="auth-loading"><span>☾</span><p>Hesap bağlantısı şu anda kullanılamıyor.</p></div> : recoveryMode ? recoveryForm : authForm}
        </section>
        <p className="auth-gate-foot">Rüyaların yalnızca sana ait, kişisel bir günlükte saklanır.</p>
      </main>
    );
  }

  if (!ready || !configured) return <button type="button" className="account-button muted">♙ <span>Hesap</span></button>;

  return (
    <>
      <button type="button" className="account-button signed" onClick={() => setOpen(true)}><span className="account-icon">✓</span><span>{accountEmail.split("@")[0] || "Hesabım"}</span></button>
      {open && createPortal(
        <div className="account-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
            <button type="button" className="modal-close" onClick={() => setOpen(false)} aria-label="Kapat">×</button>
            <span className="account-moon">☾</span>
            <div className="account-profile"><span className="section-label">RÜYA HESABIN</span><h2 id="profile-title">Rüyaların seninle</h2><p>{accountEmail}</p><small>Başka bir cihazda aynı hesapla giriş yaptığında rüya takvimin açılır.</small><button type="button" className="account-submit secondary" onClick={signOut}>Çıkış yap</button></div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
