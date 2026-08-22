import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const body = await req.json();
    const message = String(body?.message ?? "").trim();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Pesan feedback wajib diisi." }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (message.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Pesan terlalu panjang." }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("feedback_messages")
      .insert({ message })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("Feedback insert error:", error);

      return new Response(
        JSON.stringify({ error: "Gagal menyimpan feedback." }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: data.id,
        created_at: data.created_at,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Feedback function error:", error);

    return new Response(
      JSON.stringify({ error: "Terjadi kesalahan pada server." }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});