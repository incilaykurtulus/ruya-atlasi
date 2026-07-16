import { createClient } from "@supabase/supabase-js";

const authConfig = () => ({
  url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  key: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
});

export async function getSupabaseUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const { url, key } = authConfig();
  if (!token || !url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}

export async function canAccessDreamOwner(request: Request, deviceId: string) {
  if (!deviceId.startsWith("user-")) return true;
  const user = await getSupabaseUser(request);
  return Boolean(user && deviceId === `user-${user.id}`);
}

export function getPublicSupabaseConfig() {
  return authConfig();
}
