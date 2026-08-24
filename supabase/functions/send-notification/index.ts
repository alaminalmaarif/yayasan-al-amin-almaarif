import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const base64Url = (value: Uint8Array | string) => {
  const binary = typeof value === "string"
    ? new TextEncoder().encode(value)
    : value;
  let text = "";
  binary.forEach(byte => text += String.fromCharCode(byte));
  return btoa(text).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

const pemToBytes = (pem: string) => Uint8Array.from(
  atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "")),
  c => c.charCodeAt(0)
);

async function fcmAccessToken(service: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: service.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(service.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claim}`)
  );
  const assertion = `${header}.${claim}.${base64Url(new Uint8Array(signed))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || "Tidak dapat mengotorisasi Firebase.");
  return data.access_token as string;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Sesi Dashboard tidak valid." }, 401);

    const allowed = (Deno.env.get("ADMIN_NOTIFICATION_EMAILS") || "")
      .split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
    if (!allowed.includes((userData.user.email || "").toLowerCase())) {
      return json({ error: "Akun ini tidak diizinkan mengirim notifikasi." }, 403);
    }

    const { title, body, topic = "all" } = await req.json();
    const cleanTitle = String(title || "").trim();
    const cleanBody = String(body || "").trim();
    const allowedTopics = new Set(["all", "kb", "ra", "tpq", "mdt", "pesantren", "mts", "ma"]);
    if (!cleanTitle || cleanTitle.length > 100 || !cleanBody || cleanBody.length > 1000 || !allowedTopics.has(topic)) {
      return json({ error: "Judul atau isi notifikasi tidak valid." }, 400);
    }

    const rawService = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!rawService) return json({ error: "Firebase belum dikonfigurasi di server." }, 503);
    const service = JSON.parse(rawService);
    const accessToken = await fcmAccessToken(service);
    const send = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(service.project_id)}/messages:send`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          topic,
          notification: { title: cleanTitle, body: cleanBody },
          data: { title: cleanTitle, body: cleanBody, type: "announcement" },
          android: { priority: "high", notification: { channel_id: "pengumuman_yayasan" } },
        },
      }),
    });
    const result = await send.json();
    if (!send.ok) throw new Error(result?.error?.message || "Firebase menolak notifikasi.");

    await supabase.from("notifications").insert({
      title: cleanTitle, body: cleanBody, topic, sent_by: userData.user.id,
    });
    return json({ success: true, message_id: result.name });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Notifikasi gagal dikirim." }, 500);
  }
});
