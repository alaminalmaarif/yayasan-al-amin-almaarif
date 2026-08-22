import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const configured = Deno.env.get('UPLOAD_PIN');
  if (!configured) return json({ error: 'PIN upload belum dikonfigurasi.' }, 503);
  try {
    const { pin } = await req.json();
    if (String(pin || '') !== configured) return json({ error: 'PIN salah.' }, 401);
    return json({ ok: true, verified_at: Date.now(), token: crypto.randomUUID() });
  } catch { return json({ error: 'Permintaan tidak valid.' }, 400); }
});
