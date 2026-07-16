import { getPublicSupabaseConfig } from "../../supabase-auth";

export async function GET() {
  const { url, key } = getPublicSupabaseConfig();
  return Response.json({ enabled: Boolean(url && key), url, key });
}
