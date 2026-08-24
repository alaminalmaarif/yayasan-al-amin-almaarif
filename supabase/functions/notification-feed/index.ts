import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const allowedTopics = new Set(["kb", "ra", "tpq", "mdt", "pesantren", "mts", "ma"]);

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const unit = String(new URL(req.url).searchParams.get("unit") || "").toLowerCase();
  if (unit && !allowedTopics.has(unit)) return json({ error: "Unit notifikasi tidak valid." }, 400);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await supabase.from("notifications")
      .select("id,title,body,topic,sent_at")
      .in("topic", unit ? ["all", unit] : ["all"])
      .order("sent_at", { ascending: false }).limit(100);
    if (error) throw error;
    return json({ notifications: data || [] });
  } catch (error) {
    console.error(error);
    return json({ error: "Riwayat notifikasi tidak dapat dimuat." }, 500);
  }
});
