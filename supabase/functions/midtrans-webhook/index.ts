import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const body = await req.json();
    const serverKey = Deno.env.get('MIDTRANS_SERVER_KEY');
    const expectedBase = `${String(body.order_id || '')}${String(body.status_code || '')}${String(body.gross_amount || '')}${serverKey || ''}`;
    const digest = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(expectedBase));
    const expectedSignature = Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
    if (!serverKey || String(body.signature_key || '').toLowerCase() !== expectedSignature) return json({ error: 'Signature tidak valid.' }, 401);
    const orderId = String(body.order_id || '').trim();
    if (!orderId) return json({ error: 'order_id wajib.' }, 400);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: payment, error: findError } = await supabase
      .from('payments').select('id,paid_at').eq('order_id', orderId).maybeSingle();
    if (findError) throw findError;
    if (!payment) return json({ error: 'order_id tidak ditemukan.' }, 404);
    const transactionStatus = String(body.transaction_status || '').toLowerCase();
    const fraudStatus = String(body.fraud_status || '').toLowerCase();
    let gatewayStatus = transactionStatus || 'pending';
    if (transactionStatus === 'capture' && fraudStatus === 'challenge') gatewayStatus = 'challenge';
    if (['settlement','capture'].includes(transactionStatus) && fraudStatus !== 'challenge') gatewayStatus = 'paid';
    const patch: Record<string, unknown> = {
      gateway_status: gatewayStatus,
      transaction_id: body.transaction_id || null,
      payment_type: body.payment_type || null,
      raw_response: body,
      updated_at: new Date().toISOString(),
    };
    // Repeated Midtrans notifications must not change the original payment time.
    if (gatewayStatus === 'paid') patch.paid_at = payment.paid_at || new Date().toISOString();
    const { error } = await supabase.from('payments').update(patch).eq('id', payment.id);
    if (error) throw error;
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : 'Webhook gagal.' }, 500);
  }
});
